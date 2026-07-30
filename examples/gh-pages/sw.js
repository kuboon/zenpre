/**
 * 最小の Service Worker。PWA(ホーム画面に追加)を成立させるためと、
 * 同一オリジンのシェル(HTML/md/設定/アイコン)をオフライン用にキャッシュする。
 *
 * クロスオリジン(esm.sh の JS、relay 本体サイトの CSS、WebSocket)は
 * 素通し。実行は常にネットワーク優先で、失敗時だけキャッシュにフォールバック。
 */
const CACHE = "zenpre-selfhost-v1";
const SHELL = [
  "./",
  "./index.html",
  "./present.html",
  "./slides.md",
  "./config.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() =>
      self.skipWaiting()
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 同一オリジンの GET だけ面倒を見る。それ以外(esm.sh / relay / WS)は素通し。
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r ?? Response.error())),
  );
});
