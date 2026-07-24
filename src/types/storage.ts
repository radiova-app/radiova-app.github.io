/** Volume and mute state persisted in settings. */
export interface VolumeState {
  volume: number;
  muted: boolean;
}

/** Persistent application settings. */
export interface AppSettings {
  language: string;
  lastStationId: string | null;
  lastEndpointId: string | null;
  lastPlaylist: string;
  sidebarCollapsed: boolean;
}

/** A playlist with stations, stored with integrity metadata. */
export interface PlaylistData {
  stations: import('./station').Station[];
  sha256: string;
  fetchedAt: number;
}

/** A user-created playlist with a name and station list. */
export interface CustomPlaylist {
  name: string;
  stations: import('./station').Station[];
  createdAt: number;
  updatedAt: number;
}

/** Aggregate user data model. */
export interface UserData {
  favorites: Set<string>;
  recentStationIds: string[];
  customPlaylistNames: string[];
  customPlaylists: Record<string, import('./station').Station[]>;
}

/** Default app settings used when no persisted settings exist. */
export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  lastStationId: null,
  lastEndpointId: null,
  lastPlaylist: 'all',
  sidebarCollapsed: true,
};

/** IndexedDB database name. */
export const LOCAL_DB_NAME = 'radiova';
/** IndexedDB schema version. */
export const LOCAL_DB_VERSION = 1;
/** IndexedDB object store name for settings. */
export const STORE_SETTINGS = 'settings';
/** IndexedDB object store name for cached playlists. */
export const STORE_PLAYLISTS = 'playlists';
/** IndexedDB object store name for favorites. */
export const STORE_FAVORITES = 'favorites';
/** IndexedDB object store name for custom playlists. */
export const STORE_CUSTOM = 'custom';
/** IndexedDB object store name for recently played stations. */
export const STORE_RECENTS = 'recents';
