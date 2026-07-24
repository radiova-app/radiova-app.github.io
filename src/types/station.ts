/** A single stream endpoint for a radio station. */
export interface StationEndpoint {
  id: string;
  url: string;
  codec?: string;
  bitrate?: number;
}

/** A radio station with metadata and stream endpoints. */
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

/** A Station that is currently playing, with a reference to the active endpoint. */
export interface StationWithStream extends Station {
  currentEndpointId?: string;
}

/** A single entry in the playlist manifest describing one locale's playlist. */
export interface PlaylistManifestEntry {
  path: string;
  stationCount: number;
  endpointCount: number;
  sha256: string;
  generatedAt: string;
  source: string;
}

/** The full playlist manifest fetched from the remote catalog. */
export interface PlaylistManifest {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  playlists: PlaylistManifestEntry[];
}

/** A playlist stored in the IndexedDB cache. */
export interface CachedPlaylist {
  sha256: string;
  stations: Station[];
  fetchedAt: number;
}
