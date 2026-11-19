/* StudySpace service worker.
   Strategy is chosen per file type:
     - app shell + code (page loads, .html/.css/.js/.json/.webmanifest)
       -> NETWORK FIRST: the newest version is used whenever the phone is online,
          and the saved copy is only used when the network fails or stalls.
     - icons and images -> CACHE FIRST: they never change inside a version.
     - pinned libraries (AI engine, PDF/DOCX readers, Google Fonts)
       -> CACHE FIRST so offline study keeps working.
     - everything else (the AI server, model downloads) -> straight to network.
   Bump CACHE whenever the shell changes; activate() deletes the old versions. */
const CACHE = "studyspace-v31";
const NET_WAIT_MS = 4000; // on a slow connection, use the saved copy after this long

const SHELL = ["./", "./index.html", "./css/motion.css", "./css/cool.css", "./css/buddies.css", "./js/motion.js", "./js/cool.js", "./js/buddies.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

const CODE_RE = /\.(?:html?|css|js|mjs|webmanifest|json)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;
const PINNED_HOSTS = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  // Save each file on its own, so one missing file never stops the rest from being saved.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
  );
  self.skipWaiting();
});

// Drop every older StudySpace cache. Never touch the AI model files that WebLLM saves.
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

// Newest version when online; the saved copy only when the network fails or is very slow.
function networkFirst(request, pageLoad) {
  return caches.open(CACHE).then((cache) => {
    const save = (res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    };
    const net = fetch(request).then(save, () => null);
    const slow = new Promise((done) => setTimeout(() => done(null), NET_WAIT_MS));
    const saved = () =>
      cache.match(request, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          // Only page loads fall back to the app page. Other files must not receive HTML.
          (pageLoad ? cache.match("./index.html") : null)
      );

    return Promise.race([net, slow])
      .then((res) => res || saved())
      // Nothing saved yet: keep waiting for the network instead of failing straight away.
      .then((res) => res || net)
      .then((res) => res || Response.error())
      .catch(() => saved().then((hit) => hit || Response.error()));
  });
}

// Icons, images and pinned libraries: serve the saved copy, download once on a miss.
function cacheFirst(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok || res.type === "opaque") cache.put(request, res.clone());
          return res;
        })
    )
  );
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // The app itself.
  if (u.origin === location.origin) {
    if (IMAGE_RE.test(u.pathname)) {
      e.respondWith(cacheFirst(r));
      return;
    }
    const isPageLoad = r.mode === "navigate";
    if (isPageLoad || CODE_RE.test(u.pathname) || u.pathname.endsWith("/")) {
      e.respondWith(networkFirst(r, isPageLoad));
      return;
    }
    e.respondWith(networkFirst(r, false));
    return;
  }

  // Pinned library files (AI engine, PDF reader, DOCX reader, fonts): save once, reuse offline.
  if (PINNED_HOSTS.includes(u.hostname)) {
    e.respondWith(cacheFirst(r));
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
