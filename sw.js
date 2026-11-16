const CACHE = "studyspace-v20";
const SHELL = ["./", "./index.html", "./motion.css", "./motion.js", "./cool.css", "./cool.js", "./buddies.css", "./buddies.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const NET_WAIT_MS = 4000; // on a slow connection, use the saved copy after this long

self.addEventListener("install", (e) => {
  // Save each file on its own, so one missing file never stops the rest from being saved.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
  );
  self.skipWaiting();
});

// Only remove old StudySpace caches. Never touch the AI model files that WebLLM saves.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith("studyspace-") && k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // The app itself: newest version when online, saved copy when offline or very slow.
  if (u.origin === location.origin) {
    const fallback = () =>
      caches.match(r, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          // Only page loads fall back to the app page. Other files must not receive HTML.
          (r.mode === "navigate" ? caches.match("./index.html") : undefined) ||
          Response.error()
      );

    const net = fetch(r).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(r, copy));
      }
      return res;
    });
    const slow = new Promise((ok) => setTimeout(() => ok(null), NET_WAIT_MS));

    e.respondWith(
      Promise.race([net, slow])
        .then((res) =>
          res ||
          caches.match(r, { ignoreSearch: true }).then((hit) => hit || net) // nothing saved: keep waiting for the network
        )
        .catch(fallback)
    );
    return;
  }

  // Pinned library files (AI engine, PDF reader, DOCX reader): save once, reuse offline.
  if (u.hostname === "cdn.jsdelivr.net" || u.hostname === "cdnjs.cloudflare.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(r).then(
        (hit) =>
          hit ||
          fetch(r).then((res) => {
            if (res.ok || res.type === "opaque") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(r, copy));
            }
            return res;
          })
      )
    );
  }
  // Everything else (the AI server, model downloads) passes straight through.
});

// Tapping an alert opens (or returns to) the app.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
