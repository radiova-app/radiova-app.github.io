import type { AppSettings, CustomPlaylist, PlaylistData } from '../types/storage';
import type { Station } from '../types/station';
import { DEFAULT_SETTINGS, LOCAL_DB_NAME, LOCAL_DB_VERSION, STORE_SETTINGS, STORE_PLAYLISTS, STORE_FAVORITES, STORE_CUSTOM, STORE_RECENTS } from '../types/storage';

function openDB(): Promise<IDBDatabase> {
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

// Settings
export async function getSettings(): Promise<AppSettings> {
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

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put(settings, 'app');
  } catch {
    // silent fail
  }
}

// Playlists
export async function getCachedPlaylist(locale: string): Promise<PlaylistData | null> {
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

export async function cachePlaylist(locale: string, data: PlaylistData): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
    tx.objectStore(STORE_PLAYLISTS).put({ id: locale, ...data });
  } catch {
    // silent fail
  }
}

// Favorites
export async function getFavorites(): Promise<Set<string>> {
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

export async function addFavorite(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).put({ id });
  } catch {
    // silent fail
  }
}

export async function removeFavorite(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).delete(id);
  } catch {
    // silent fail
  }
}

// Recents
export async function getRecents(): Promise<string[]> {
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

export async function addRecent(stationId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECENTS, 'readwrite');
    tx.objectStore(STORE_RECENTS).put({ id: stationId, ts: Date.now() });
  } catch {
    // silent fail
  }
}

// Custom playlists
export async function getCustomPlaylistNames(): Promise<string[]> {
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

export async function getCustomPlaylists(): Promise<CustomPlaylist[]> {
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

export async function getCustomPlaylist(name: string): Promise<CustomPlaylist | null> {
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

export async function saveCustomPlaylist(name: string, stations: Station[]): Promise<void> {
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

export async function renameCustomPlaylist(currentName: string, nextName: string): Promise<boolean> {
  if (currentName === nextName) return true;
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

export async function deleteCustomPlaylist(name: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CUSTOM, 'readwrite');
    tx.objectStore(STORE_CUSTOM).delete(name);
  } catch {
    // silent fail
  }
}

// Reset
export async function resetAllData(): Promise<void> {
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
