// ラビリンスマーブル Service Worker v4
// Network First for index.html（更新を確実に反映）
// Cache First for assets（オフライン対応）

const CACHE = 'labyrinth-v4';
const PRECACHE_FILES = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './privacy-policy.html',
];

// インストール: アセット類をキャッシュに保存
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

// アクティベート: 旧バージョンのキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ処理
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // index.html と ルート（/）は Network First
  // → 更新後に古い HTML が残らないようにする
  const isNavigation =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 取得成功したらキャッシュにも保存
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          // ネットワーク失敗時はキャッシュから返す（オフライン対応）
          caches.match(e.request).then(r => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // その他: Cache First（アセット・manifest・アイコン）
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
