import { SITE, PLAYLIST_LABELS, type PlaylistLocale } from '../config/site';
import type { PlaylistManifest, PlaylistManifestEntry, Station } from '../types/station';
import type { PlaylistData } from '../types/storage';
import { parseM3U, validateM3U } from './m3u';
import { cachePlaylist, getCachedPlaylist } from './db';

const CATALOG_BASE = SITE.stationsUrl;
const MANIFEST_PATH = 'generated/playlists-manifest.json';

let cachedManifest: PlaylistManifest | null = null;
let manifestPromise: Promise<PlaylistManifest | null> | null = null;

/**
 * Return the base URL for station catalog files.
 * @returns The catalog base URL.
 */
export function getCatalogBase(): string {
  return CATALOG_BASE;
}

/**
 * Return the human-readable label for a playlist locale in the given language.
 * @param locale - The playlist locale key.
 * @param lang - The target language code.
 * @returns The localised label.
 */
export function getPlaylistLabel(locale: PlaylistLocale, lang: string): string {
  const labels = PLAYLIST_LABELS[locale];
  if (lang === 'uk') return labels.uk;
  if (lang === 'de') return labels.de;
  return labels.en;
}

/**
 * Fetch the playlist manifest from the remote catalog.
 * Results are cached in memory for the session.
 * @returns The manifest, or null on failure.
 */
export async function fetchManifest(): Promise<PlaylistManifest | null> {
  if (cachedManifest) return cachedManifest;
  if (manifestPromise) return manifestPromise;

  manifestPromise = (async () => {
    try {
      const url = `${CATALOG_BASE}/${MANIFEST_PATH}`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (!isValidManifest(data)) return null;
      cachedManifest = data;
      return cachedManifest;
    } catch {
      return null;
    }
  })();

  return manifestPromise;
}

/**
 * Look up a manifest entry for a given locale.
 * @param manifest - The playlist manifest.
 * @param locale - The locale key to look up.
 * @returns The manifest entry, or undefined.
 */
export function getPlaylistEntry(manifest: PlaylistManifest, locale: string): PlaylistManifestEntry | undefined {
  const path = `playlists/${locale}.m3u`;
  return manifest.playlists.find((p) => p.path === path);
}

/**
 * Fetch and validate a playlist M3U from the remote catalog.
 * Optionally verifies the SHA-256 hash of the content.
 * @param locale - The playlist locale key.
 * @param sha256 - Optional expected SHA-256 hash.
 * @returns Array of stations, or null on failure.
 */
export async function fetchPlaylist(locale: string, sha256?: string): Promise<Station[] | null> {
  try {
    const url = `${CATALOG_BASE}/playlists/${locale}.m3u`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = await res.text();

    if (!validateM3U(text)) return null;

    const stations = parseM3U(text);

    if (sha256) {
      const actualSha = await sha256Hex(text);
      if (actualSha !== sha256) return null;
    }

    return stations;
  } catch {
    return null;
  }
}

/**
 * Load stations for a locale with cache-aware logic.
 * Returns cached data when the SHA-256 matches and falls back to cache on fetch failure.
 * @param locale - The playlist locale key.
 * @returns An object with stations and a fromCache flag.
 */
export async function loadPlaylist(locale: string): Promise<{ stations: Station[]; fromCache: boolean }> {
  const cached = await getCachedPlaylist(locale);

  const manifest = await fetchManifest();
  let remoteSha: string | undefined;
  let stations: Station[] | null = null;

  if (manifest) {
    const entry = getPlaylistEntry(manifest, locale);
    if (entry) {
      remoteSha = entry.sha256;
      if (cached && cached.sha256 === remoteSha) {
        return { stations: cached.stations, fromCache: true };
      }

      stations = await fetchPlaylist(locale, remoteSha);

      if (stations) {
        const data: PlaylistData = { stations, sha256: remoteSha, fetchedAt: Date.now() };
        await cachePlaylist(locale, data);
        return { stations, fromCache: false };
      }
    }
  }

  if (cached) {
    return { stations: cached.stations, fromCache: true };
  }

  return { stations: [], fromCache: false };
}

function isValidManifest(data: unknown): data is PlaylistManifest {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  if (typeof m['schemaVersion'] !== 'number') return false;
  if (!Array.isArray(m['playlists'])) return false;
  for (const p of m['playlists']) {
    if (!p || typeof p !== 'object') return false;
    const entry = p as Record<string, unknown>;
    if (typeof entry['path'] !== 'string') return false;
    if (typeof entry['sha256'] !== 'string') return false;
    if (typeof entry['stationCount'] !== 'number') return false;
  }
  return true;
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
