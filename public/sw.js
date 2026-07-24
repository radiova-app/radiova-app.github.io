const CACHE = 'radiova-v5';
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
  '/icons/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
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
  const requestUrl = new URL(event.request.url);

  // Never cache or serve source TypeScript/JS files
  if (requestUrl.pathname.startsWith('/src/')) {
    return;
  }

  // Bypass caching for audio/media streams
  const contentType = event.request.headers.get('Accept') || '';
  const isAudio = contentType.includes('audio/')
    || requestUrl.pathname.match(/\.(mp3|aac|ogg|wav|flac|opus|m3u8|m3u|pls|asx)$/i);
  if (isAudio || requestUrl.port === '8443' || requestUrl.port === '8000' || requestUrl.port === '8080') {
    return;
  }

  // Cache-first for static app shell
  if (requestUrl.origin === self.location.origin && isAppShell(requestUrl.pathname)) {
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
  if (requestUrl.hostname === 'raw.githubusercontent.com' && requestUrl.pathname.includes('radiova-stations')) {
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
  if (path === '/' || path === '' || path.startsWith('/icons/') || path.startsWith('/assets/')) return true;
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
