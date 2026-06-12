/* Pro Race Ready — offline cache. Bump CACHE version when files change. */
const CACHE = "wnr-v35";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./pro-race-ready-logo.jpg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];
/* config.json is deliberately NOT precached — it carries the access codes and
   must always be read fresh from the network so a changed code locks people out. */

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // only handle same-origin GETs; let analytics POSTs and cross-origin pass straight through
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // access config: network-first, fall back to last cached copy when offline
  if (url.pathname.endsWith("/config.json") || url.pathname.endsWith("config.json")) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./config.json", copy));
        return res;
      }).catch(() => caches.match("./config.json"))
    );
    return;
  }

  // everything else: cache-first (instant + offline), fall back to network
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});
