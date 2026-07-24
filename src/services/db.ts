import type { AppSettings, CustomPlaylist, PlaylistData } from '../types/storage';
import type { Station } from '../types/station';
import { DEFAULT_SETTINGS, LOCAL_DB_NAME, LOCAL_DB_VERSION, STORE_SETTINGS, STORE_PLAYLISTS, STORE_FAVORITES, STORE_CUSTOM, STORE_RECENTS } from '../types/storage';
import { hasConsent } from './consent';

let memorySettings: AppSettings = { ...DEFAULT_SETTINGS };
let memoryFavorites = new Set<string>();
let memoryCustomPlaylists: CustomPlaylist[] = [];
let memoryRecents: string[] = [];

function openDB(): Promise<IDBDatabase> {
  if (!hasConsent('preferences')) {
    return Promise.reject(new Error('Preferences storage is disabled by consent.'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM)) {
        db.createObjectStore(STORE_CUSTOM, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_RECENTS)) {
        db.createObjectStore(STORE_RECENTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { resolve(req.result); };
    req.onerror = () => { reject(req.error ?? new Error('IndexedDB open failed')); };
  });
}

/**
 * Read app settings from IndexedDB (or memory fallback).
 * Returns DEFAULT_SETTINGS on failure.
 * @returns The current AppSettings.
 */
export async function getSettings(): Promise<AppSettings> {
  if (!hasConsent('preferences')) return { ...memorySettings };
  try {
    const db = await openDB();
    return await new Promise<AppSettings>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get('app');
      req.onsuccess = () => {
        resolve((req.result as AppSettings | undefined) ?? DEFAULT_SETTINGS);
      };
      req.onerror = () => { resolve(DEFAULT_SETTINGS); };
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persist app settings to IndexedDB (or memory fallback).
 * @param settings - The settings to save.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!hasConsent('preferences')) {
    memorySettings = { ...settings };
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put(settings, 'app');
  } catch {
    // silent fail
  }
}

/**
 * Read a cached playlist for a locale from IndexedDB.
 * Returns null when consent is denied or the cache is missing.
 * @param locale - The playlist locale key.
 * @returns The cached PlaylistData, or null.
 */
export async function getCachedPlaylist(locale: string): Promise<PlaylistData | null> {
  if (!hasConsent('offline')) return null;
  try {
    const db = await openDB();
    return await new Promise<PlaylistData | null>((resolve) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readonly');
      const req = tx.objectStore(STORE_PLAYLISTS).get(locale);
      req.onsuccess = () => {
        resolve((req.result as PlaylistData | undefined) ?? null);
      };
      req.onerror = () => { resolve(null); };
    });
  } catch {
    return null;
  }
}

/**
 * Store a playlist in IndexedDB for offline access.
 * @param locale - The playlist locale key.
 * @param data - The playlist data to cache.
 */
export async function cachePlaylist(locale: string, data: PlaylistData): Promise<void> {
  if (!hasConsent('offline')) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
    tx.objectStore(STORE_PLAYLISTS).put({ id: locale, ...data });
  } catch {
    // silent fail
  }
}

/**
 * Return the set of favorite station IDs.
 * @returns The set of favourite station IDs.
 */
export async function getFavorites(): Promise<Set<string>> {
  if (!hasConsent('preferences')) return new Set(memoryFavorites);
  try {
    const db = await openDB();
    return await new Promise<Set<string>>((resolve) => {
      const tx = db.transaction(STORE_FAVORITES, 'readonly');
      const req = tx.objectStore(STORE_FAVORITES).getAllKeys();
      req.onsuccess = () => { resolve(new Set(req.result as string[])); };
      req.onerror = () => { resolve(new Set()); };
    });
  } catch {
    return new Set();
  }
}

/**
 * Add a station ID to favorites.
 * @param id - The station ID.
 */
export async function addFavorite(id: string): Promise<void> {
  if (!hasConsent('preferences')) {
    memoryFavorites.add(id);
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).put({ id });
  } catch {
    // silent fail
  }
}

/**
 * Remove a station ID from favorites.
 * @param id - The station ID.
 */
export async function removeFavorite(id: string): Promise<void> {
  if (!hasConsent('preferences')) {
    memoryFavorites.delete(id);
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).delete(id);
  } catch {
    // silent fail
  }
}

/**
 * Return recently played station IDs sorted by recency (newest first).
 * @returns Array of station IDs, most recent first.
 */
export async function getRecents(): Promise<string[]> {
  if (!hasConsent('preferences')) return [...memoryRecents];
  try {
    const db = await openDB();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE_RECENTS, 'readonly');
      const all = tx.objectStore(STORE_RECENTS).getAll();
      all.onsuccess = () => {
        const items = all.result as Array<{ id: string; ts: number }>;
        items.sort((a, b) => b.ts - a.ts);
        resolve(items.map((i) => i.id));
      };
      all.onerror = () => { resolve([]); };
    });
  } catch {
    return [];
  }
}

/**
 * Record a station as recently played.
 * @param stationId - The station ID to record.
 */
export async function addRecent(stationId: string): Promise<void> {
  if (!hasConsent('preferences')) {
    memoryRecents = [stationId, ...memoryRecents.filter((id) => id !== stationId)].slice(0, 20);
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECENTS, 'readwrite');
    tx.objectStore(STORE_RECENTS).put({ id: stationId, ts: Date.now() });
  } catch {
    // silent fail
  }
}

/**
 * Return names of all custom playlists.
 * @returns Array of playlist names.
 */
export async function getCustomPlaylistNames(): Promise<string[]> {
  if (!hasConsent('preferences')) return memoryCustomPlaylists.map((playlist) => playlist.name);
  try {
    const db = await openDB();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE_CUSTOM, 'readonly');
      const req = tx.objectStore(STORE_CUSTOM).getAllKeys();
      req.onsuccess = () => { resolve(req.result as string[]); };
      req.onerror = () => { resolve([]); };
    });
  } catch {
    return [];
  }
}

/**
 * Return all custom playlists sorted by updatedAt descending.
 * @returns Array of custom playlists.
 */
export async function getCustomPlaylists(): Promise<CustomPlaylist[]> {
  if (!hasConsent('preferences')) {
    return [...memoryCustomPlaylists].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  try {
    const db = await openDB();
    return await new Promise<CustomPlaylist[]>((resolve) => {
      const tx = db.transaction(STORE_CUSTOM, 'readonly');
      const req = tx.objectStore(STORE_CUSTOM).getAll();
      req.onsuccess = () => {
        const records = req.result as Array<CustomPlaylist | { name: string; stationIds?: string[] }>;
        resolve(records.map(normalizeCustomPlaylist).sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => { resolve([]); };
    });
  } catch {
    return [];
  }
}

/**
 * Return a single custom playlist by name, or null.
 * @param name - The playlist name.
 * @returns The CustomPlaylist, or null.
 */
export async function getCustomPlaylist(name: string): Promise<CustomPlaylist | null> {
  if (!hasConsent('preferences')) {
    return memoryCustomPlaylists.find((playlist) => playlist.name === name) ?? null;
  }
  try {
    const db = await openDB();
    return await new Promise<CustomPlaylist | null>((resolve) => {
      const tx = db.transaction(STORE_CUSTOM, 'readonly');
      const req = tx.objectStore(STORE_CUSTOM).get(name);
      req.onsuccess = () => {
        const record = req.result as CustomPlaylist | { name: string; stationIds?: string[] } | undefined;
        resolve(record ? normalizeCustomPlaylist(record) : null);
      };
      req.onerror = () => { resolve(null); };
    });
  } catch {
    return null;
  }
}

/**
 * Create or overwrite a custom playlist with the given stations.
 * @param name - The playlist name.
 * @param stations - The stations to include.
 */
export async function saveCustomPlaylist(name: string, stations: Station[]): Promise<void> {
  if (!hasConsent('preferences')) {
    const existing = memoryCustomPlaylists.find((playlist) => playlist.name === name);
    const now = Date.now();
    const next: CustomPlaylist = {
      name,
      stations,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    memoryCustomPlaylists = [next, ...memoryCustomPlaylists.filter((playlist) => playlist.name !== name)];
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM, 'readwrite');
    const existing = await getCustomPlaylist(name);
    const now = Date.now();
    tx.objectStore(STORE_CUSTOM).put({
      name,
      stations,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } satisfies CustomPlaylist);
  } catch {
    // silent fail
  }
}

/**
 * Rename a custom playlist.
 * @param currentName - The current playlist name.
 * @param nextName - The new playlist name.
 * @returns false if the new name is already taken.
 */
export async function renameCustomPlaylist(currentName: string, nextName: string): Promise<boolean> {
  if (currentName === nextName) return true;
  if (!hasConsent('preferences')) {
    const playlist = memoryCustomPlaylists.find((item) => item.name === currentName);
    if (!playlist || memoryCustomPlaylists.some((item) => item.name === nextName)) return false;
    playlist.name = nextName;
    playlist.updatedAt = Date.now();
    return true;
  }
  const playlist = await getCustomPlaylist(currentName);
  if (!playlist) return false;
  const existing = await getCustomPlaylist(nextName);
  if (existing) return false;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM, 'readwrite');
    tx.objectStore(STORE_CUSTOM).delete(currentName);
    tx.objectStore(STORE_CUSTOM).put({ ...playlist, name: nextName, updatedAt: Date.now() });
    return await completeTransaction(tx);
  } catch {
    return false;
  }
}

/**
 * Delete a custom playlist by name.
 * @param name - The playlist name to delete.
 */
export async function deleteCustomPlaylist(name: string): Promise<void> {
  if (!hasConsent('preferences')) {
    memoryCustomPlaylists = memoryCustomPlaylists.filter((playlist) => playlist.name !== name);
    return;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM, 'readwrite');
    tx.objectStore(STORE_CUSTOM).delete(name);
  } catch {
    // silent fail
  }
}

/**
 * Clear all IndexedDB stores and reset in-memory state.
 * Silently fails when consent is denied.
 */
export async function resetAllData(): Promise<void> {
  memorySettings = { ...DEFAULT_SETTINGS };
  memoryFavorites = new Set<string>();
  memoryCustomPlaylists = [];
  memoryRecents = [];
  if (!hasConsent('preferences')) return;
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_SETTINGS, STORE_PLAYLISTS, STORE_FAVORITES, STORE_CUSTOM, STORE_RECENTS], 'readwrite');
    tx.objectStore(STORE_SETTINGS).clear();
    tx.objectStore(STORE_PLAYLISTS).clear();
    tx.objectStore(STORE_FAVORITES).clear();
    tx.objectStore(STORE_CUSTOM).clear();
    tx.objectStore(STORE_RECENTS).clear();
    await completeTransaction(tx);
  } catch {
    // silent fail
  }
}

function normalizeCustomPlaylist(record: CustomPlaylist | { name: string; stationIds?: string[] }): CustomPlaylist {
  if ('stations' in record && Array.isArray(record.stations)) return record;
  return {
    name: record.name,
    stations: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function completeTransaction(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => { resolve(true); };
    tx.onabort = () => { resolve(false); };
    tx.onerror = () => { resolve(false); };
  });
}
