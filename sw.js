const CACHE = "studyspace-v13";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
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

  // The app itself: newest version when online, saved copy when offline.
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(r, copy));
          }
          return res;
        })
        .catch(() => caches.match(r).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Pinned library files (AI engine, PDF reader): save once, reuse offline.
  if (u.hostname === "cdn.jsdelivr.net" || u.hostname === "cdnjs.cloudflare.com") {
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
