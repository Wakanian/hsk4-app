/* =====================================================================
   HSK4級単語帳 — Service Worker（オフライン対応）
   ・初回アクセス時にアプリ本体・単語データ・アイコンを保存
   ・以降はネットがなくても保存済みのファイルで動く
   ・ファイルを更新したら CACHE_VERSION の数字を1つ上げてからアップロードすると確実
   ===================================================================== */
const CACHE_VERSION = 'hsk4-v4';
const APP_CACHE  = `${CACHE_VERSION}-app`;
const FONT_CACHE = 'hsk4-fonts';

// 最初に保存しておくファイル（sw.js から見た相対パス）
const PRECACHE_FILES = [
  './',
  './index.html',
  './words.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-32.png',
  './icons/favicon.ico'
];

// インストール：必要なファイルをまとめて保存
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(PRECACHE_FILES))
      .then(() => self.skipWaiting())
  );
});

// 有効化：古いバージョンの保存データを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith('hsk4-') && key !== APP_CACHE && key !== FONT_CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts：一度読み込んだフォントを保存して、オフラインでも同じ見た目に
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(cached => {
          if (cached) return cached;
          return fetch(req).then(res => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // 自分のサイトのファイル：保存版をすぐ表示しつつ、裏で最新版を取得して保存し直す
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP_CACHE).then(cache =>
        cache.match(req, { ignoreSearch: true }).then(cached => {
          const network = fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached || cache.match('./index.html'));
          return cached || network;
        })
      )
    );
  }
});
