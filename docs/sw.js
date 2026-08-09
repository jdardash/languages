// Offline support. Navigations are network-first (a deploy always wins when
// online); everything else same-origin is stale-while-revalidate, so audio,
// data and code accumulate in the cache as they are used and keep working on
// a flight. No precache manifest to maintain: the shell list below is the
// minimum to open the app cold while offline.
const CACHE = "languages-v1";
const SHELL = [
  "index.html", "drill.html", "vocab.html", "cloze.html", "conj.html",
  "pairs.html", "shadow.html", "reader.html", "input.html", "capture.html",
  "method.html", "progress.html", "css/site.css",
  "js/app.js", "js/scheduler.js", "js/dictation.js", "js/readerlib.js",
  "js/plan.js", "js/deck.js", "js/stats.js",
  "js/today.js", "js/drill.js", "js/vocab.js", "js/cloze.js", "js/conj.js",
  "js/pairs.js", "js/shadow.js", "js/reader.js", "js/input.js",
  "js/capture.js", "js/method.js", "js/progress.js",
  "data/manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then(hit => hit ?? caches.match("index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      const refresh = fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit ?? refresh;
    })
  );
});
