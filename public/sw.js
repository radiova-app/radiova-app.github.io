const CACHE = 'radiova-v3';
const STATIC_URLS = [
  '/',
  '/playlists',
  '/downloads',
  '/about',
  '/help',
  '/privacy',
  '/uk/',
  '/uk/playlists',
  '/uk/downloads',
  '/uk/about',
  '/uk/help',
  '/uk/privacy',
  '/de/',
  '/de/playlists',
  '/de/downloads',
  '/de/about',
  '/de/help',
  '/de/privacy',
  '/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-192-maskable.png',
  '/assets/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => k !== CACHE ? caches.delete(k) : null));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass caching for audio/media streams
  const contentType = event.request.headers.get('Accept') || '';
  const isAudio = contentType.includes('audio/')
    || url.pathname.match(/\.(mp3|aac|ogg|wav|flac|opus|m3u8|m3u|pls|asx)$/i);
  if (isAudio || url.port === '8443' || url.port === '8000' || url.port === '8080') {
    return;
  }

  // Cache-first for static app shell
  if (url.origin === self.location.origin && isAppShell(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return fetchAndCache(event.request, cache);
      })()
    );
    return;
  }

  // Network-first for playlist data from GitHub
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('radiova-stations')) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request);
          const cache = await caches.open(CACHE);
          cache.put(event.request, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          const cached = await cache.match(event.request);
          return cached ?? new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // Network-first for everything else with cache fallback
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(event.request);
        return cached ?? new Response('Offline', { status: 503 });
      }
    })()
  );
});

function isAppShell(path) {
  if (path === '/' || path === '' || path.startsWith('/favicon') || path.startsWith('/assets/')) return true;
  const pages = [
    '/playlists', '/downloads', '/about', '/help', '/privacy', '/support',
    '/uk/', '/uk/playlists', '/uk/downloads', '/uk/about', '/uk/help', '/uk/privacy', '/uk/support',
    '/de/', '/de/playlists', '/de/downloads', '/de/about', '/de/help', '/de/privacy', '/de/support',
  ];
  return pages.some((p) => path === p || path === p + '/');
}

async function fetchAndCache(request, cache) {
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}
