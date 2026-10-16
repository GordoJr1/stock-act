const CACHE = "stock-act-v9";
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
  "./qc.js",
  "./chart.js",
  "./refresh.js",
  "./manifest.webmanifest",
  "./city.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dest = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (let i = 0; i < list.length; i++) {
        const client = list[i];
        if (client.url && client.url.indexOf(dest) >= 0 && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(dest);
    })
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
  const isTrade = /(?:^|\/)(trades|trades-lite|landed|heat|backtest|analysis|tells)\.json$/.test(url.pathname)
    || /\/tape\/(?:page|filers)\.json$/.test(url.pathname)
    || /\/tape\/kind\/[^/]+\.json$/.test(url.pathname)
    || /\/tape\/politicians\/[^/]+\.json$/.test(url.pathname)
    || /\/tape\/tickers\/[^/]+\.json$/.test(url.pathname);
  const isData = isTrade
    || /(?:^|\/)(bios|tickers|traders|filing-notes)\.json$/.test(url.pathname)
    || /(?:^|\/)prices\/[^/]+\.json$/.test(url.pathname);
  const isDoc = event.request.mode === "navigate"
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith("/")
    || url.pathname.endsWith("/refresh.js")
    || url.pathname.endsWith("/sw.js")
    || url.pathname.endsWith("/shell.css")
    || url.pathname.endsWith("/qc.js")
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
      const network = fetch(event.request).then((res) => {
        storeIfOk(res, event);
        return res;
      }).catch(() => cached);
      return cached || network;
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
