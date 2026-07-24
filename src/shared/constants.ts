/** Milliseconds to wait before treating a stream load as failed. */
export const STREAM_TIMEOUT_MS = 12000;

/** Fallback image URL used when a station has no artwork. */
export const PLACEHOLDER_IMG = "/assets/images/station-placeholder.svg";

/** Current consent schema version. Bump to force re-consent on upgrade. */
export const CONSENT_VERSION = 1;

/**
 * Custom event name constants used throughout the app.
 * These are dispatched via document.dispatchEvent.
 */
export const EVENTS = {
  VOLUME_CHANGED: "radiova:volume-changed",
  MUTE_CHANGED: "radiova:mute-changed",
  STATION_SELECTED: "radiova:station-selected",
  PLAYER_TOGGLE: "radiova:player-toggle",
  STATIONS_CHANGED: "radiova:stations-changed",
  PLAYER_STATION_CHANGED: "radiova:player-station-changed",
  REFRESH: "radiova:refresh",
  CONSENT_RESOLVED: "radiova:consent-resolved",
  CONSENT_CHANGED: "radiova:consent-changed",
} as const;

/** IndexedDB and localStorage key constants. */
export const STORAGE = {
  LOCAL_DB_NAME: "radiova",
  LOCAL_DB_VERSION: 1,
  STORE_SETTINGS: "settings",
  STORE_PLAYLISTS: "playlists",
  STORE_FAVORITES: "favorites",
  STORE_CUSTOM: "custom",
  STORE_RECENTS: "recents",
} as const;

/** DOM element ID constants used throughout the app. */
export const SELECTORS = {
  HEADER_TOGGLE_ICON: "header-toggle-icon",
  HEADER_STATION_IMAGE: "header-station-image",
  HEADER_STATION_TITLE: "header-station-title",
  HEADER_VOLUME: "header-volume",
  HEADER_MUTE_BTN: "header-mute-btn",
  DASHBOARD_TOGGLE_ICON: "dashboard-toggle-icon",
  DASHBOARD_STATION_IMAGE: "dashboard-station-image",
  DASHBOARD_VOLUME: "dashboard-volume",
  DASHBOARD_MUTE_BTN: "dashboard-mute-btn",
  DASHBOARD_PLAYER: "dashboard-player",
  DASHBOARD_LEFT_LEVEL_FILL: "dashboard-left-level-fill",
  DASHBOARD_RIGHT_LEVEL_FILL: "dashboard-right-level-fill",
  PWA_INSTALL_BTN: "pwa-install-btn",
  UPGRADE_BTN: "upgrade-btn",
  UPDATE_STATUS: "update-status",
  STATION_COUNT: "station-count",
  LOADING_INDICATOR: "loading-indicator",
  EMPTY_STATE: "empty-state",
  STATIONS_LIST: "stations-list",
  STATIONS_PAGINATION: "stations-pagination",
  LIST_FOOTER: "list-footer",
  ERROR_STATE: "error-state",
} as const;
