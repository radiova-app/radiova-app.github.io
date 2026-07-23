export interface VolumeState {
  volume: number;
  muted: boolean;
}

export interface AppSettings {
  language: string;
  lastStationId: string | null;
  lastEndpointId: string | null;
  lastPlaylist: string;
  sidebarCollapsed: boolean;
}

export interface PlaylistData {
  stations: import('./station').Station[];
  sha256: string;
  fetchedAt: number;
}

export interface CustomPlaylist {
  name: string;
  stations: import('./station').Station[];
  createdAt: number;
  updatedAt: number;
}

export interface UserData {
  favorites: Set<string>;
  recentStationIds: string[];
  customPlaylistNames: string[];
  customPlaylists: Record<string, import('./station').Station[]>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  lastStationId: null,
  lastEndpointId: null,
  lastPlaylist: 'all',
  sidebarCollapsed: true,
};

export const LOCAL_DB_NAME = 'radiova';
export const LOCAL_DB_VERSION = 1;
export const STORE_SETTINGS = 'settings';
export const STORE_PLAYLISTS = 'playlists';
export const STORE_FAVORITES = 'favorites';
export const STORE_CUSTOM = 'custom';
export const STORE_RECENTS = 'recents';
