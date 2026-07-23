export interface StationEndpoint {
  id: string;
  url: string;
  codec?: string;
  bitrate?: number;
}

export interface Station {
  id: string;
  name: string;
  logo?: string;
  countryCode?: string;
  languageCodes?: string[];
  genre?: string;
  tags?: string[];
  endpoints: StationEndpoint[];
  locale?: string;
}

export interface StationWithStream extends Station {
  currentEndpointId?: string;
}

export interface PlaylistManifestEntry {
  path: string;
  stationCount: number;
  endpointCount: number;
  sha256: string;
  generatedAt: string;
  source: string;
}

export interface PlaylistManifest {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  playlists: PlaylistManifestEntry[];
}

export interface CachedPlaylist {
  sha256: string;
  stations: Station[];
  fetchedAt: number;
}
