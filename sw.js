const CACHE = "stock-act-v25";
const SHELL = [
  "./",
  "./index.html",
  "./politician.html",
  "./ticker.html",
  "./signals.html",
  "./landed.html",
  "./tells.html",
  "./paper.html",
  "./shell.css",
  "./stock-act.js",
  "./chart.js",
  "./refresh.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./fonts/big-shoulders-display.woff2?v=2",
  "./fonts/figtree.woff2?v=2",
  "./fonts/red-hat-mono.woff2?v=2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE && key.indexOf("stock-act-") === 0).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // tickers.json stamps filtered rows in the browser, so a stale copy would mis-name the tape.
  const isTrade = /(?:^|\/)(trades|trades-lite|tickers|landed|heat|backtest|analysis|tells)\.json$/.test(url.pathname)
    || /\/tape\/(?:page|filers)\.json$/.test(url.pathname)
    || /\/tape\/kind\/[^/]+\.json$/.test(url.pathname)
    || /\/tape\/politicians\/[^/]+\.json$/.test(url.pathname)
    || /\/tape\/tickers\/[^/]+\.json$/.test(url.pathname);
  const isData = isTrade
    || /(?:^|\/)(bios|traders|filing-notes)\.json$/.test(url.pathname)
    || /(?:^|\/)prices\/[^/]+\.json$/.test(url.pathname);
  const isDoc = event.request.mode === "navigate"
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith("/")
    || url.pathname.endsWith("/refresh.js")
    || url.pathname.endsWith("/sw.js")
    || url.pathname.endsWith("/shell.css")
    || url.pathname.endsWith("/stock-act.js")
    || url.pathname.endsWith("/chart.js");
  function storeIfOk(res, event) {
    if (res && res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
    }
    return res;
  }
  // Trade files are network-first. A cached body must not win, and a failed
  // response must not be stored.
  if (isTrade) {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request, { cache: "no-cache" });
        storeIfOk(res, event);
        if(!res.ok){const c=await caches.match(event.request); if(c) return c;}
        return res;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }
  if (isData) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      const update = fetch(event.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          return caches.open(CACHE).then((cache) => cache.put(event.request, copy)).then(() => res);
        }
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(update.then(() => {}));
        return cached;
      }
      const res = await update;
      if (res) return res;
      const loose = await caches.match(event.request, { ignoreSearch: true });
      if (loose) return loose;
      throw new Error("data");
    })());
    return;
  }
  if (isDoc) {
    // Revalidate with the server (ETag, usually a 304) instead of taking the
    // browser's 10-minute HTTP cache copy, so a publish shows on the next load.
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .catch(() => fetch(event.request))
        .then((res) => {
          storeIfOk(res, event);
          return res;
        })
        // A versioned ?v= URL must still find the plain cached copy when offline.
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => storeIfOk(res, event))
        .catch(() => caches.match(event.request, { ignoreSearch: true }));
    })
  );
});
