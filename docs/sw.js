// Radiova service worker.
//
// The build (scripts/sw-build-version.mjs, run from astro.config.mjs) replaces the two
// quoted markers below in dist/sw.js: the cache version is a hash of the built output and the
// asset list names every built script and style. Because the file differs on every build with
// changed assets, browsers install the new worker, which pre-caches one consistent set of
// pages and assets and removes the caches of older deployments.
const BUILD_VERSION = 'a43a054e3b';
const PRECACHE_ASSETS = '/_astro/AppShell.DCUJktQF.css,/_astro/AppShell.astro_astro_type_script_index_0_lang.CVcrG7nJ.js,/_astro/AppShell.astro_astro_type_script_index_1_lang.DT667Th5.js,/_astro/AppShell.astro_astro_type_script_index_2_lang.CM0tDl1b.js,/_astro/ClientRouter.astro_astro_type_script_index_0_lang.CnDxeVtR.js,/_astro/consent.BB2jiEEt.js,/_astro/dashboard.Dc8YWRmM.js,/_astro/db.BJK-03PJ.js,/_astro/dom.BF_B5gD-.js,/_astro/downloads.DK5DDtlE.js,/_astro/downloads.astro_astro_type_script_index_0_lang.DGKNJdKE.js,/_astro/downloads.astro_astro_type_script_index_0_lang.L8s78NgL.js,/_astro/downloads.astro_astro_type_script_index_0_lang.X7qUDl4l.js,/_astro/index.astro_astro_type_script_index_0_lang.Bds-teTq.js,/_astro/index.astro_astro_type_script_index_0_lang.Dj6FxBmo.js,/_astro/index.astro_astro_type_script_index_0_lang.DrAvj8Hw.js,/_astro/player.8pC0YQac.js,/_astro/playlist.DYdfgp5O.js,/_astro/playlists.1lthHkHv.js,/_astro/playlists.astro_astro_type_script_index_0_lang.BCNmcQwM.js,/_astro/playlists.astro_astro_type_script_index_0_lang.BQWA8neQ.js,/_astro/playlists.astro_astro_type_script_index_0_lang.BS3HJGUr.js,/_astro/privacy.astro_astro_type_script_index_0_lang.BptSH0Sj.js,/_astro/privacy.astro_astro_type_script_index_0_lang.Bv_2Wkfj.js,/_astro/privacy.astro_astro_type_script_index_0_lang.D3gs0a33.js,/_astro/pwa.B4pHCPtS.js,/_astro/reset-data.DnJ0mRV2.js';

const CACHE_PREFIX = 'radiova-';
const CACHE = cacheNameFor(BUILD_VERSION);

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

const PAGE_PATHS = [
  '/', '/uk', '/de',
  '/playlists', '/downloads', '/about', '/help', '/privacy', '/support',
  '/uk/playlists', '/uk/downloads', '/uk/about', '/uk/help', '/uk/privacy', '/uk/support',
  '/de/playlists', '/de/downloads', '/de/about', '/de/help', '/de/privacy', '/de/support',
];

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(selectStaleCaches(keys, CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = decideStrategy(event.request, self.location.origin);
  if (strategy === 'bypass') return;

  if (strategy === 'asset' || strategy === 'static') {
    event.respondWith(cacheFirst(event.request));
  } else if (strategy === 'page' || strategy === 'catalog') {
    event.respondWith(networkFirst(event.request, true));
  } else {
    event.respondWith(networkFirst(event.request, false));
  }
});

/**
 * Cache name for a build version. Falls back to a development name when the build
 * did not stamp a valid version (for example `astro dev`).
 * @param {unknown} version - The version string substituted at build time.
 * @returns {string} The cache name.
 */
function cacheNameFor(version) {
  return typeof version === 'string' && /^[0-9a-f]{8,64}$/.test(version)
    ? CACHE_PREFIX + version
    : CACHE_PREFIX + 'dev';
}

/**
 * Pick the caches of older deployments. Caches without the worker prefix are never selected.
 * @param {string[]} keys - All cache names.
 * @param {string} current - The cache name of this worker.
 * @returns {string[]} Cache names to delete.
 */
function selectStaleCaches(keys, current) {
  return keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== current);
}

/**
 * Choose how a request is handled.
 * @param {{ url: string, method: string, headers: Headers }} request - The request.
 * @param {string} origin - The origin of the site.
 * @returns {'bypass' | 'page' | 'asset' | 'static' | 'catalog' | 'network'} The strategy.
 */
function decideStrategy(request, origin) {
  if (request.method !== 'GET') return 'bypass';
  const url = new URL(request.url);

  // Never cache or serve source TypeScript/JS files
  if (url.pathname.startsWith('/src/')) return 'bypass';

  // Bypass caching for audio/media streams
  const accept = request.headers.get('Accept') || '';
  const isAudio = accept.includes('audio/')
    || /\.(mp3|aac|ogg|wav|flac|opus|m3u8|m3u|pls|asx)$/i.test(url.pathname);
  if (isAudio || url.port === '8443' || url.port === '8000' || url.port === '8080') return 'bypass';

  if (url.origin === origin) {
    if (url.pathname.startsWith('/_astro/')) return 'asset';
    if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/')) return 'static';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (PAGE_PATHS.includes(path)) return 'page';
  }

  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('radiova-stations')) {
    return 'catalog';
  }

  return 'network';
}

/**
 * Parse the build-time list of built assets. An unstamped marker yields an empty list.
 * @param {string} raw - Comma-separated URL paths.
 * @returns {string[]} The `/_astro/` paths.
 */
function parseAssetList(raw) {
  return raw.split(',').filter((path) => path.startsWith('/_astro/'));
}

/**
 * Pre-cache pages, icons and built assets of this build, bypassing the HTTP cache so that
 * the HTML and its assets come from the same deployment. One failing file fails the install,
 * so the previous worker and its cache stay active.
 * @returns {Promise<void>} Resolves when all files are cached.
 */
async function precache() {
  const cache = await caches.open(CACHE);
  const urls = STATIC_URLS.concat(parseAssetList(PRECACHE_ASSETS));
  await cache.addAll(
    urls.map((path) => new Request(new URL(path, self.location.origin).href, { cache: 'reload' }))
  );
}

/**
 * Answer from the current cache first, then from the network, caching successful responses.
 * @param {Request} request - The request.
 * @returns {Promise<Response>} The response.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    return offlineResponse();
  }
}

/**
 * Answer from the network first and fall back to the cache when the network fails.
 * @param {Request} request - The request.
 * @param {boolean} store - Whether successful responses refresh the cache.
 * @returns {Promise<Response>} The response.
 */
async function networkFirst(request, store) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (store && res.ok) {
      try {
        await cache.put(request, res.clone());
      } catch {
        // A full or unavailable cache must not break a successful response.
      }
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached ?? offlineResponse();
  }
}

/**
 * Response used when neither the network nor the cache can answer.
 * @returns {Response} A 503 response.
 */
function offlineResponse() {
  return new Response('Offline', { status: 503 });
}
