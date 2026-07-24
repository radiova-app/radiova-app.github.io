import { loadLocale, applyI18n, t } from "../services/i18n";
import {
  getAudioElement,
  getCurrentUrl,
  getState,
  getVolume,
  getSharedPlayerState,
  onError,
  onChange,
  play,
  togglePlayback,
  setVolume,
  setMuted,
  toggleMute,
  isMuted,
  setStationInfo,
  setPlaybackStatus,
  type SharedPlayerState,
  type PlayerStationInfo,
  type PlayerState,
} from "../services/player";
import { addRecent, getSettings, saveSettings } from "../services/db";
import { queueStreamReport } from "../services/reporter";
import { openPrivacySettings, whenConsentResolved } from "../services/consent";
import {
  initPWA,
  getPWAState,
  onPWAStateChange,
  promptInstall,
  isStandalone,
} from "../services/pwa";
import { createEqualizer, type EqualizerHandle } from "./equalizer";
import type { Station } from "../types/station";
import { $, escapeHtml, iconForStatus, isLoadingStatus, ariaLabelForStatus, safeArtworkUrl } from "../shared/dom";
import { EVENTS, STREAM_TIMEOUT_MS, PLACEHOLDER_IMG } from "../shared/constants";

let currentPlayId: string | null = null;
let currentStation: Station | null = null;
let currentStations: Station[] = [];
let currentEndpointIndex = 0;
let settings: Awaited<ReturnType<typeof getSettings>>;
let equalizer: EqualizerHandle | null = null;
let sidebarAbortController: AbortController | null = null;
let restoredOnce = false;
let streamTimeoutId: number | null = null;
const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const diagnostics: {
  logs: string[];
  add: (msg: string) => void;
  clear: () => void;
  render: () => void;
} = {
  logs: [],
  add(msg: string): void {
    this.logs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    if (this.logs.length > 200) this.logs.shift();
    if (isDev && this.logs.length <= 50) console.log("radiova:", msg);
  },
  clear(): void {
    this.logs = [];
  },
  render(): void {
    const el = $("dev-diagnostics");
    if (!el) return;
    el.innerHTML = this.logs.slice(-30).join("\n");
  },
};

/** True when the current route is the home page in any locale. */
function isHomePage(): boolean {
  const path = window.location.pathname.replace(/\/$/, "");
  return path === "" || path === "/" || path === "/uk" || path === "/de";
}

/**
 * App initialisation entry point.
 * Called once after consent is resolved and on every route change via onPageNavigation.
 */
async function init(): Promise<void> {
  loadLocale();
  applyI18n();

  settings = await getSettings();

  initPWA();
  setupPlayerListeners();
  bindAll();

  setupResizeHandler();

  await restorePlayerState();

  window.addEventListener("beforeunload", persistPlayerState);
  document.addEventListener(EVENTS.VOLUME_CHANGED, () => {
    syncAllVolumeSliders();
  });
  document.addEventListener(EVENTS.MUTE_CHANGED, () => {
    syncAllMuteButtons();
  });

  onChange(handlePlayerChange);

  handlePlayerChange(getSharedPlayerState());
}

/** Show/hide the dashboard and header player sections based on current route. */
function applyPlayerVisibility(): void {
  const home = isHomePage();
  const dp = $("dashboard-player");
  const hp = $("header-player");

  if (dp) dp.classList.toggle("is-route-hidden", !home);
  if (hp) hp.classList.toggle("is-route-hidden", home);
}

/**
 * Restore the last played station and endpoint from settings on first load.
 * Does nothing if already restored.
 */
async function restorePlayerState(): Promise<void> {
  if (restoredOnce) return;
  restoredOnce = true;
  if (!settings.lastStationId) return;

  const stationId = settings.lastStationId;
  const endpointId = settings.lastEndpointId;

  diagnostics.add(
    "restorePlayerState: attempting restore of stationId=" +
      stationId +
      " endpointId=" +
      (endpointId || "?"),
  );

  const locale = settings.lastPlaylist || "all";
  try {
    const { loadPlaylist } = await import("../services/playlist");
    const { stations } = await loadPlaylist(locale);
    if (stations.length === 0) return;

    const station = stations.find((s: Station) => s.id === stationId);
    if (!station) {
      diagnostics.add('restorePlayerState: station not found in playlist "' + locale + '"');
      return;
    }

    let epIndex = 0;
    if (endpointId) {
      const found = station.endpoints.findIndex((ep) => ep.id === endpointId);
      if (found >= 0) epIndex = found;
    }

    currentStation = station;
    currentPlayId = station.id;
    currentEndpointIndex = epIndex;

    const savedVol = getVolume();
    const savedMuted = isMuted();

    const info: PlayerStationInfo = {
      stationId: station.id,
      stationName: station.name,
      artworkUrl: station.logo || null,
      endpointId: station.endpoints[epIndex]?.id || null,
      endpointUrl: station.endpoints[epIndex]?.url || null,
      endpointLabel:
        [
          station.endpoints[epIndex]?.codec,
          station.endpoints[epIndex]?.bitrate
            ? String(station.endpoints[epIndex]?.bitrate) + "k"
            : "",
        ]
          .filter(Boolean)
          .join(" ") || null,
    };
    setStationInfo(info);

    updateStationInfo(station);
    setStationImages(station);
    updateStreamSelector(station);

    setVolume(savedVol);
    setMuted(savedMuted);

    syncAllVolumeSliders();
    syncAllMuteButtons();

    diagnostics.add(
      'restorePlayerState: restored station="' +
        station.name +
        '" endpoint=' +
        (info.endpointUrl?.slice(0, 50) || "?"),
    );
  } catch (err) {
    diagnostics.add("restorePlayerState error: " + String(err));
  }
}

/** Save the current station and endpoint to settings on unload. */
function persistPlayerState(): void {
  if (currentStation) {
    settings.lastStationId = currentStation.id;
    settings.lastEndpointId = currentStation.endpoints[currentEndpointIndex]?.id || null;
  }
  void saveSettings(settings);
}

/** React to player state changes: update UI, equaliser, stream timeout. */
function handlePlayerChange(state: SharedPlayerState): void {
  updateHeaderPlayer(state);
  updateDashboardPlayer(state);
  updateEqualizer(state.status);
  updateStreamTimeout(state.status);

  const info = state.station;
  if (info.stationId && info.stationId !== currentStation?.id) {
    diagnostics.add("playerChange: station=" + info.stationName + " state=" + state.status);
  }
}

/** Toggle the sidebar collapsed class based on settings and viewport. */
function applyDesktopCollapse(): void {
  const shell = $("shell");
  if (!shell) return;
  if (typeof settings === "undefined") return;
  if (window.innerWidth < 640) {
    shell.classList.remove("shell-collapsed");
  } else if (settings.sidebarCollapsed) {
    shell.classList.add("shell-collapsed");
  } else {
    shell.classList.remove("shell-collapsed");
  }
}

let domAbortController: AbortController | null = null;

/** Attach event listeners for header player controls. */
function bindHeaderPlayer(signal: AbortSignal): void {
  const headerLogo = $("header-station-logo");
  if (headerLogo) {
    headerLogo.addEventListener(
      "click",
      () => {
        if (!currentStation) return;
        togglePlayback();
      },
      { signal },
    );
  }

  const headerVol = $("header-volume") as HTMLInputElement | null;
  if (headerVol) {
    headerVol.addEventListener(
      "input",
      () => {
        setVolume(parseFloat(headerVol.value));
      },
      { signal },
    );
  }

  const headerMute = $("header-mute-btn");
  if (headerMute) headerMute.addEventListener("click", toggleMute, { signal });
}

/** Attach event listeners for dashboard player controls. */
function bindDashboardPlayer(signal: AbortSignal): void {
  const toggleBtn = $("dashboard-station-square");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", togglePlayback, { signal });
  }

  const prevBtn = $("dashboard-prev");
  if (prevBtn)
    prevBtn.addEventListener(
      "click",
      () => {
        navigateStation(-1);
      },
      { signal },
    );

  const nextBtn = $("dashboard-next");
  if (nextBtn)
    nextBtn.addEventListener(
      "click",
      () => {
        navigateStation(1);
      },
      { signal },
    );

  const playToggle = $("dashboard-play-toggle");
  if (playToggle) {
    playToggle.addEventListener("click", togglePlayback, { signal });
  }

  const dbVol = $("dashboard-volume") as HTMLInputElement | null;
  if (dbVol) {
    dbVol.addEventListener(
      "input",
      () => {
        setVolume(parseFloat(dbVol.value));
      },
      { signal },
    );
  }

  const dbMute = $("dashboard-mute-btn");
  if (dbMute) dbMute.addEventListener("click", toggleMute, { signal });

  const refreshBtn = $("refresh-playlists");
  if (refreshBtn) {
    refreshBtn.addEventListener(
      "click",
      () => {
        const statusEl = $("update-status");
        if (statusEl) statusEl.textContent = "Updating...";
        document.dispatchEvent(new CustomEvent(EVENTS.REFRESH));
      },
      { signal },
    );
  }

  const pwaBtn = $("pwa-install-btn");
  if (pwaBtn) {
    pwaBtn.addEventListener(
      "click",
      () => {
        void promptInstall();
      },
      { signal },
    );
  }

  const privacyBtn = $("privacy-settings-btn");
  if (privacyBtn) privacyBtn.addEventListener("click", openPrivacySettings, { signal });

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("stream-btn") && currentStation) {
        const stationId = target.dataset["stationId"];
        const endpointUrl = target.dataset["url"];
        if (stationId === currentStation.id && endpointUrl) {
          const endpointIndex = currentStation.endpoints.findIndex((ep) => ep.url === endpointUrl);
          if (endpointIndex >= 0) selectStation(currentStation, endpointIndex);
        }
      }
    },
    { signal },
  );
}

/** Refresh player UI elements from the current station state after navigation. */
function restorePlayerUI(): void {
  if (!currentStation) return;
  const state = getSharedPlayerState();
  setStationImages(currentStation);
  updateStationInfo(currentStation);
  updateStreamSelector(currentStation);
  updateHeaderPlayer(state);
  updateDashboardPlayer(state);
}

/** Create or rebind the equaliser to the current DOM canvas elements. */
function rebindEqualizer(): void {
  const eqLeft = $("dashboard-equalizer-left") as HTMLCanvasElement | null;
  const eqRight = $("dashboard-equalizer-right") as HTMLCanvasElement | null;
  const sideVis = $("dashboard-side-visualizer") as HTMLCanvasElement | null;
  const leftMeter = $("dashboard-left-level-fill");
  const rightMeter = $("dashboard-right-level-fill");

  if (equalizer) {
    equalizer.rebindCanvases(eqLeft, eqRight, sideVis);
    equalizer.rebindMeters(leftMeter, rightMeter);
    const audioEl = getAudioElement();
    if (audioEl) equalizer.setAudioElement(audioEl);
    const state = getState();
    equalizer.syncWithCurrentPlaybackState(state === "playing");
  } else if (eqLeft && eqRight) {
    equalizer = createEqualizer(eqLeft, eqRight);
    equalizer.rebindSideCanvas(sideVis);
    equalizer.rebindMeters(leftMeter, rightMeter);
    const audioEl = getAudioElement();
    if (audioEl) equalizer.setAudioElement(audioEl);
    const state = getState();
    equalizer.syncWithCurrentPlaybackState(state === "playing");
  }
}

/** Re-bind all UI controls after a route change (astro:page-load). */
function bindAll(): void {
  domAbortController?.abort();
  domAbortController = new AbortController();
  const signal = domAbortController.signal;

  bindHeaderPlayer(signal);
  bindDashboardPlayer(signal);
  bindSidebar();
  applyPlayerVisibility();
  applyDesktopCollapse();
  syncAllVolumeSliders();
  syncAllMuteButtons();
  restorePlayerUI();
  rebindEqualizer();
  updatePWAButton();

  if (currentStation) {
    document.dispatchEvent(
      new CustomEvent(EVENTS.PLAYER_STATION_CHANGED, { detail: currentStation.id }),
    );
  }
}

/** Track resize events to toggle mobile/desktop sidebar collapse. */
function setupResizeHandler(): void {
  let prevWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    if (prevWidth < 640 !== w < 640) {
      applyDesktopCollapse();
    }
    prevWidth = w;
  });
}

/** Attach sidebar toggle and route link listeners. */
function bindSidebar(): void {
  sidebarAbortController?.abort();
  sidebarAbortController = new AbortController();
  const signal = sidebarAbortController.signal;

  const shell = $("shell");
  const sidebar = $("sidebar");
  const toggleBtn = $("sidebar-toggle");
  if (!shell || !sidebar || !toggleBtn) return;

  function isMobile(): boolean {
    return window.innerWidth < 640;
  }

  toggleBtn.addEventListener(
    "click",
    () => {
      if (isMobile()) {
        sidebar.classList.toggle("is-open-mobile");
      } else {
        shell.classList.toggle("shell-collapsed");
        settings.sidebarCollapsed = shell.classList.contains("shell-collapsed");
        void saveSettings(settings);
      }
    },
    { signal },
  );

  document.querySelectorAll("[data-sidebar-route]").forEach((link) => {
    link.addEventListener(
      "click",
      () => {
        if (isMobile()) sidebar.classList.remove("is-open-mobile");
      },
      { signal },
    );
  });
}

/** Set up global player event listeners (station selected, toggle, error). */
function setupPlayerListeners(): void {
  onError(handlePlaybackError);

  document.addEventListener(EVENTS.STATION_SELECTED, (event) => {
    const station = (event as CustomEvent<Station>).detail;
    if (station.endpoints.length) selectStation(station);
  });

  document.addEventListener(EVENTS.PLAYER_TOGGLE, togglePlayback);

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".stream-error__retry")) {
      retryCurrentStation();
    }
  });

  document.addEventListener(EVENTS.STATIONS_CHANGED, (event) => {
    currentStations = (event as CustomEvent<Station[]>).detail;
  });
}

/** Update the compact header player controls from player state. */
function updateHeaderPlayer(state: SharedPlayerState): void {
  const hasStation = Boolean(state.station.stationId);
  const emptyTitle = t("player.noStation");
  const emptySubtitle = t("player.chooseStation");
  const stationTitle = $("header-station-title");
  if (stationTitle && !hasStation) {
    stationTitle.textContent = emptyTitle;
    stationTitle.setAttribute("title", emptyTitle);
  }

  const toggleIcon = $("header-toggle-icon");
  if (toggleIcon) {
    toggleIcon.innerHTML = iconForStatus(state.status);
    toggleIcon.classList.toggle("is-loading", isLoadingStatus(state.status));
    toggleIcon.classList.toggle("has-error", state.status === "error");
  }
  const logo = $("header-station-logo");
  if (logo) {
    logo.classList.toggle("is-disabled", !hasStation);
    logo.setAttribute("aria-disabled", hasStation ? "false" : "true");
    logo.setAttribute("aria-label", hasStation ? ariaLabelForStatus(state.status) : emptySubtitle);
  }
  const status = $("header-player-status");
  if (status) {
    const statusText = hasStation ? state.statusLabel : emptySubtitle;
    status.textContent = statusText;
    status.setAttribute("title", statusText);
  }
  if (!hasStation) setPlayerImage("header-station-image", PLACEHOLDER_IMG, emptyTitle, "empty header");
}

/** Update the full dashboard player section from player state. */
function updateDashboardPlayer(state: SharedPlayerState): void {
  const dp = $("dashboard-player");
  if (!dp) return;
  dp.dataset["playerState"] = state.status;

  const playIconEl = $("dashboard-play-icon");
  if (playIconEl) {
    playIconEl.innerHTML = iconForStatus(state.status);
    playIconEl.classList.toggle("is-loading", isLoadingStatus(state.status));
    playIconEl.classList.toggle("has-error", state.status === "error");
  }

  const toggleIcon = $("dashboard-toggle-icon");
  if (toggleIcon) {
    toggleIcon.innerHTML = iconForStatus(state.status);
    toggleIcon.classList.toggle("is-loading", isLoadingStatus(state.status));
    toggleIcon.classList.toggle("has-error", state.status === "error");
  }

  const toggleAttr = $("dashboard-station-square");
  if (toggleAttr) {
    toggleAttr.setAttribute("aria-label", ariaLabelForStatus(state.status));
    if (toggleAttr instanceof HTMLButtonElement) toggleAttr.disabled = !state.station.stationId;
  }

  for (const id of ["dashboard-play-toggle", "dashboard-prev", "dashboard-next"]) {
    const button = $(id) as HTMLButtonElement | null;
    if (button) button.disabled = !state.station.stationId;
  }

  const status = $("dashboard-player-status");
  if (status) {
    const statusText = state.station.stationId ? state.statusLabel : t("player.chooseStation");
    status.textContent = statusText;
    status.setAttribute("title", statusText);
  }
  if (!state.station.stationId) setPlayerImage("dashboard-station-image", PLACEHOLDER_IMG, t("player.noStation"), "empty dashboard");
}

/** Sync the equaliser start/stop with the playback state. */
function updateEqualizer(state: string): void {
  const audioEl = getAudioElement();
  if (audioEl && equalizer) {
    equalizer.setAudioElement(audioEl);
  }
  if (equalizer) {
    equalizer.syncWithCurrentPlaybackState(state === "playing");
  }
}

/** Set a player image with onerror fallback to PLACEHOLDER_IMG. */
function setPlayerImage(imgId: string, src: string, alt: string, context: string): void {
  const img = $(imgId) as HTMLImageElement | null;
  if (!img) return;
  img.onerror = () => {
    diagnostics.add("artwork " + context + ": fallback for " + src.slice(0, 60));
    img.onerror = null;
    img.src = PLACEHOLDER_IMG;
  };
  img.src = src || PLACEHOLDER_IMG;
  img.alt = alt;
  img.style.display = "";
}

/** Update all player station image elements for a given station. */
function setStationImages(station: Station): void {
  const logoUrl = safeArtworkUrl(station.logo, (msg) => { diagnostics.add(msg); });

  function setImg(imgId: string, alt: string): void {
    setPlayerImage(imgId, logoUrl || PLACEHOLDER_IMG, alt, "player");
  }

  setImg("header-station-image", station.name);
  setImg("dashboard-station-image", station.name);

  const sq = $("dashboard-station-square");
  if (sq) {
    if (logoUrl) {
      sq.classList.remove("no-image");
    } else {
      sq.classList.add("no-image");
    }
  }
}

/**
 * Select and start playing a station at the given endpoint index.
 * Falls back through endpoints on failure.
 */
function selectStation(station: Station, endpointIndex = 0): void {
  const ep = station.endpoints[endpointIndex];
  if (!ep) {
    diagnostics.add(
      "selectStation: no endpoint at index " +
        String(endpointIndex) +
        ' for "' +
        station.name +
        '"',
    );
    return;
  }

  const bitrateStr = ep.bitrate ? String(ep.bitrate) + "k" : "?";
  diagnostics.add(
    'selectStation: "' +
      station.name +
      '" -> ' +
      ep.url +
      " (" +
      (ep.codec || "?") +
      "/" +
      bitrateStr +
      ")",
  );

  currentStation = station;
  currentPlayId = station.id;
  currentEndpointIndex = endpointIndex;
  if (equalizer) equalizer.setCurrentStationId(station.id);
  setPlaybackStatus(endpointIndex > 0 ? "retrying" : "loading");

  const info: PlayerStationInfo = {
    stationId: station.id,
    stationName: station.name,
    artworkUrl: station.logo || null,
    endpointId: ep.id,
    endpointUrl: ep.url,
    endpointLabel:
      [ep.codec, ep.bitrate ? String(ep.bitrate) + "k" : ""].filter(Boolean).join(" ") || null,
  };
  setStationInfo(info);

  const audioEl = getAudioElement();
  if (audioEl) {
    diagnostics.add(
      "audio readyState=" +
        String(audioEl.readyState) +
        " networkState=" +
        String(audioEl.networkState) +
        ' src="' +
        (audioEl.src.slice(0, 60) || "") +
        '"',
    );
  }

  clearStreamError();

  if (equalizer) {
    equalizer.prepare();
  }

  startStreamTimeout();
  play(ep.url);

  updateStationInfo(station);
  setStationImages(station);

  settings.lastStationId = station.id;
  settings.lastEndpointId = ep.id;
  void saveSettings(settings);
  void addRecent(station.id);
  updateStreamSelector(station);
  document.dispatchEvent(new CustomEvent(EVENTS.PLAYER_STATION_CHANGED, { detail: station.id }));
}

/** Update header and dashboard station title elements. */
function updateStationInfo(station: Station): void {
  const headerTitle = $("header-station-title");
  if (headerTitle) headerTitle.textContent = station.name;

  const dashboardTitle = $("dashboard-station-title");
  if (dashboardTitle) dashboardTitle.textContent = station.name;
}

/** Update stream selector buttons for both header and dashboard. */
function updateStreamSelector(station: Station): void {
  updateSelector("header-stream-selector", station);
  updateSelector("dashboard-streams", station);
}

/** Render stream selector buttons for a single element. */
function updateSelector(elId: string, station: Station): void {
  const el = $(elId);
  if (!el) return;
  if (station.endpoints.length <= 1) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = station.endpoints
    .map((ep) => {
      const isActive = getCurrentUrl() === ep.url;
      const label =
        [ep.codec, ep.bitrate ? String(ep.bitrate) + "k" : ""].filter(Boolean).join(" ") ||
        "Stream";
      return (
        '<button class="stream-btn' +
        (isActive ? " is-active" : "") +
        '" data-station-id="' +
        station.id +
        '" data-url="' +
        ep.url +
        '" type="button">' +
        escapeHtml(label) +
        "</button>"
      );
    })
    .join("");
}

/** Move to the next or previous station in the current station list. */
function navigateStation(dir: number): void {
  if (currentStations.length === 0) return;
  const idx = currentPlayId
    ? currentStations.findIndex((station) => station.id === currentPlayId)
    : -1;
  let nextIdx: number;
  if (idx === -1) {
    nextIdx = 0;
  } else {
    nextIdx = (idx + dir + currentStations.length) % currentStations.length;
  }
  const nextStation = currentStations[nextIdx];
  if (nextStation) selectStation(nextStation);
}

/**
 * Handle a stream playback error.
 * Attempts fallback to the next endpoint; after all are exhausted shows error UI.
 */
function handlePlaybackError(): void {
  clearStreamTimeout();
  const audioEl = getAudioElement();
  let errorCode = "?";
  let errorMessage = "?";
  if (audioEl) {
    const mc = audioEl.error;
    errorCode = mc ? String(mc.code) : "?";
    errorMessage = mc ? mc.message || "?" : "?";
    diagnostics.add(
      "playback error: code=" +
        errorCode +
        ' message="' +
        errorMessage +
        '" readyState=' +
        String(audioEl.readyState) +
        " networkState=" +
        String(audioEl.networkState),
    );
  } else {
    diagnostics.add("playback error: no audio element");
  }

  const currentEndpoint = currentStation?.endpoints[currentEndpointIndex] ?? null;
  queueStreamReport({
    stationId: currentStation?.id ?? null,
    stationName: currentStation?.name ?? null,
    endpointId: currentEndpoint?.id ?? null,
    endpointUrl: currentEndpoint?.url ?? null,
    errorCode,
    errorMessage,
    createdAt: new Date().toISOString(),
  });

  if (currentStation && currentEndpointIndex < currentStation.endpoints.length - 1) {
    const nextIdx = currentEndpointIndex + 1;
    const nextEp = currentStation.endpoints[nextIdx];
    const nextUrl = nextEp ? nextEp.url.slice(0, 60) : "?";
    diagnostics.add(
      "fallback: endpoint " +
        String(currentEndpointIndex) +
        " failed, trying " +
        String(nextIdx) +
        " (" +
        nextUrl +
        ")",
    );
    setPlaybackStatus("retrying");
    selectStation(currentStation, nextIdx);
    return;
  }

  if (currentStation) {
    diagnostics.add(
      "all " +
        String(currentStation.endpoints.length) +
        ' endpoints exhausted for "' +
        currentStation.name +
        '"',
    );
  }

  setPlaybackStatus("error", "Unable to play this stream");
  showStreamError("Unable to play this stream");
}

/** Render an inline stream error message with a retry button. */
function showStreamError(msg: string): void {
  const status = $("update-status");
  if (!status) return;
  status.innerHTML =
    '<span class="stream-error">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
    " " +
    escapeHtml(msg) +
    ' <button class="stream-error__retry" type="button">Retry</button>' +
    "</span>";
}

/** Clear the stream error UI. */
function clearStreamError(): void {
  const status = $("update-status");
  if (status) status.innerHTML = "";
}

/** Retry the current station from its first endpoint. */
function retryCurrentStation(): void {
  if (!currentStation) return;
  selectStation(currentStation, 0);
}

/** Timeout callback: treat as a playback error to trigger fallback. */
function handlePlaybackTimeout(): void {
  diagnostics.add(
    "playback timeout: endpoint=" +
      String(currentEndpointIndex) +
      " url=" +
      (currentStation?.endpoints[currentEndpointIndex]?.url.slice(0, 60) || "?"),
  );
  handlePlaybackError();
}

/** Start the stream startup timeout. */
function startStreamTimeout(): void {
  clearStreamTimeout();
  streamTimeoutId = window.setTimeout(handlePlaybackTimeout, STREAM_TIMEOUT_MS);
}

/** Cancel the stream startup timeout if active. */
function clearStreamTimeout(): void {
  if (streamTimeoutId === null) return;
  window.clearTimeout(streamTimeoutId);
  streamTimeoutId = null;
}

/** Clear the timeout when a terminal or playing state is reached. */
function updateStreamTimeout(status: PlayerState): void {
  if (status === "playing" || status === "paused" || status === "idle" || status === "error") {
    clearStreamTimeout();
  }
}

/** Show/hide the PWA install button based on installability. */
function updatePWAButton(): void {
  const btn = $("pwa-install-btn");
  if (!btn) return;

  if (isStandalone()) {
    btn.classList.add("is-hidden");
    return;
  }

  const state = getPWAState();
  if (state === "installable") {
    btn.classList.remove("is-hidden");
  }
}

/** Sync all volume slider elements to the current volume. */
function syncAllVolumeSliders(): void {
  const vol = getVolume();
  const sliders = ["header-volume", "dashboard-volume"];
  for (const id of sliders) {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.value = String(vol);
  }
}

/** Sync all mute button elements to the current mute state. */
function syncAllMuteButtons(): void {
  const muted = isMuted();
  const muteBtns = ["header-mute-btn", "dashboard-mute-btn"];
  for (const id of muteBtns) {
    const btn = $(id);
    if (!btn) continue;
    btn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    btn.classList.toggle("is-muted", muted);
  }
}

onPWAStateChange(updatePWAButton);

/** Mark the current language link as active in the language switcher. */
function updateLanguageActiveState(): void {
  const path = window.location.pathname;
  const locale =
    path.startsWith("/uk/") || path === "/uk"
      ? "uk"
      : path.startsWith("/de/") || path === "/de"
        ? "de"
        : "en";
  for (const l of ["en", "de", "uk"]) {
    const link = document.getElementById("lang-" + l);
    if (!link) continue;
    const isActive = l === locale;
    link.setAttribute("aria-current", isActive ? "true" : "");
    link.classList.toggle("is-active", isActive);
  }
}

/** Re-bind UI after an Astro view transition. */
function onPageNavigation(): void {
  bindAll();
  updateLanguageActiveState();
}

document.addEventListener("astro:page-load", onPageNavigation);

document.addEventListener("DOMContentLoaded", () => {
  void whenConsentResolved().then(() => init());
});
