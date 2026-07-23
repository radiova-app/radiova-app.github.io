import { loadLocale, applyI18n } from '../services/i18n';
import { getAudioElement, getCurrentUrl, getState, getVolume, onError, onStateChange, onChange, pause, play, setVolume, setMuted, toggleMute, isMuted, setStationInfo, type SharedPlayerState, type PlayerStationInfo } from '../services/player';
import { addRecent, getSettings, saveSettings } from '../services/db';
import { initPWA, getPWAState, onPWAStateChange, promptInstall, isStandalone } from '../services/pwa';
import { createEqualizer, createSideVisualizer, type EqualizerHandle } from './equalizer';
import type { Station } from '../types/station';

const PLAY_ICON = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>';
const PAUSE_ICON = '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>';

const PLAY_ICON_FULL = `<svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">${PLAY_ICON}</svg>`;
const PAUSE_ICON_FULL = `<svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">${PAUSE_ICON}</svg>`;

let currentPlayId: string | null = null;
let currentStation: Station | null = null;
let currentStations: Station[] = [];
let currentEndpointIndex = 0;
let settings: Awaited<ReturnType<typeof getSettings>>;
let equalizer: EqualizerHandle | null = null;
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const diagnostics: { logs: string[]; add: (msg: string) => void; clear: () => void; render: () => void } = {
  logs: [],
  add(msg: string): void {
    this.logs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    if (this.logs.length > 200) this.logs.shift();
    if (isDev && this.logs.length <= 50) console.log('radiova:', msg);
  },
  clear(): void { this.logs = []; },
  render(): void {
    const el = $('dev-diagnostics');
    if (!el) return;
    el.innerHTML = this.logs.slice(-30).join('\n');
  },
};

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function isHomePage(): boolean {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '' || path === '/' || path === '/uk' || path === '/de';
}

async function init(): Promise<void> {
  loadLocale();
  applyI18n();

  settings = await getSettings();

  initPWA();
  setupSidebar();
  setupPlayerListeners();
  setupHeaderControls();
  setupDashboardControls();

  applyPlayerVisibility();

  const eqLeft = $('dashboard-equalizer-left') as HTMLCanvasElement | null;
  const eqRight = $('dashboard-equalizer-right') as HTMLCanvasElement | null;
  if (eqLeft && eqRight) {
    equalizer = createEqualizer(eqLeft, eqRight);
    const audioEl = getAudioElement();
    if (audioEl) equalizer.setAudioElement(audioEl);
  }

  const sideVis = $('dashboard-side-visualizer') as HTMLCanvasElement | null;
  if (sideVis) createSideVisualizer(sideVis);

  syncAllVolumeSliders();
  syncAllMuteButtons();

  applyDesktopCollapse();
  setupResizeHandler();
  updatePWAButton();

  await restorePlayerState();

  window.addEventListener('beforeunload', persistPlayerState);
  document.addEventListener('radiova:volume-changed', () => { syncAllVolumeSliders(); });
  document.addEventListener('radiova:mute-changed', () => { syncAllMuteButtons(); });

  onChange(handlePlayerChange);
}

function applyPlayerVisibility(): void {
  const home = isHomePage();
  const dp = $('dashboard-player');
  const hp = $('header-player');

  if (dp) dp.classList.toggle('is-route-hidden', !home);
  if (hp) hp.classList.toggle('is-route-hidden', home);
}

async function restorePlayerState(): Promise<void> {
  if (!settings.lastStationId) return;

  const stationId = settings.lastStationId;
  const endpointId = settings.lastEndpointId;

  diagnostics.add('restorePlayerState: attempting restore of stationId=' + stationId + ' endpointId=' + (endpointId || '?'));

  const locale = settings.lastPlaylist || 'all';
  try {
    const { loadPlaylist } = await import('../services/playlist');
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
      endpointLabel: [station.endpoints[epIndex]?.codec, station.endpoints[epIndex]?.bitrate ? String(station.endpoints[epIndex]?.bitrate) + 'k' : ''].filter(Boolean).join(' ') || null,
    };
    setStationInfo(info);

    updateStationInfo(station);
    setStationImages(station);
    updateStreamSelector(station);

    setVolume(savedVol);
    setMuted(savedMuted);

    syncAllVolumeSliders();
    syncAllMuteButtons();

    diagnostics.add('restorePlayerState: restored station="' + station.name + '" endpoint=' + (info.endpointUrl?.slice(0, 50) || '?'));
  } catch (err) {
    diagnostics.add('restorePlayerState error: ' + String(err));
  }
}

function persistPlayerState(): void {
  if (currentStation) {
    settings.lastStationId = currentStation.id;
    settings.lastEndpointId = currentStation.endpoints[currentEndpointIndex]?.id || null;
  }
  void saveSettings(settings);
}

function handlePlayerChange(state: SharedPlayerState): void {
  updateHeaderPlayer(state.status);
  updateDashboardPlayer(state.status);
  updateEqualizer(state.status);

  const info = state.station;
  if (info.stationId && info.stationId !== currentStation?.id) {
    diagnostics.add('playerChange: station=' + info.stationName + ' state=' + state.status);
  }
}

function applyDesktopCollapse(): void {
  const shell = $('shell');
  if (!shell) return;
  if (window.innerWidth < 640) {
    shell.classList.remove('shell-collapsed');
  } else if (settings.sidebarCollapsed) {
    shell.classList.add('shell-collapsed');
  } else {
    shell.classList.remove('shell-collapsed');
  }
}

function setupResizeHandler(): void {
  let prevWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    if ((prevWidth < 640) !== (w < 640)) {
      applyDesktopCollapse();
    }
    prevWidth = w;
  });
}

function setupSidebar(): void {
  const shell = $('shell');
  const sidebar = $('sidebar');

  function isMobile(): boolean {
    return window.innerWidth < 640;
  }

  function toggleSidebar(): void {
    const s = shell;
    const b = sidebar;
    if (!s || !b) return;
    if (isMobile()) {
      b.classList.toggle('is-open-mobile');
    } else {
      s.classList.toggle('shell-collapsed');
      settings.sidebarCollapsed = s.classList.contains('shell-collapsed');
      void saveSettings(settings);
    }
  }

  if (!shell || !sidebar) return;

  const toggleBtn = $('sidebar-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);

  document.querySelectorAll('[data-sidebar-route]').forEach((link) => {
    link.addEventListener('click', () => {
      if (isMobile()) sidebar.classList.remove('is-open-mobile');
    });
  });
}

function setupPlayerListeners(): void {
  onStateChange(updatePlayerUI);
  onError(handlePlaybackError);

  document.addEventListener('radiova:station-selected', (event) => {
    const station = (event as CustomEvent<Station>).detail;
    if (station.endpoints.length) selectStation(station);
  });

  document.addEventListener('radiova:player-toggle', () => {
    if (getState() === 'playing') {
      pause();
    } else if (currentStation) {
      selectStation(currentStation, currentEndpointIndex);
    }
  });

  document.addEventListener('radiova:stations-changed', (event) => {
    currentStations = (event as CustomEvent<Station[]>).detail;
  });
}

function setupHeaderControls(): void {
  const headerLogo = $('header-station-logo');
  if (headerLogo) {
    headerLogo.addEventListener('click', () => {
      if (getState() === 'playing') {
        pause();
      } else if (currentStation) {
        selectStation(currentStation, currentEndpointIndex);
      }
    });
  }

  const headerVol = $('header-volume') as HTMLInputElement | null;
  if (headerVol) {
    headerVol.addEventListener('input', () => {
      setVolume(parseFloat(headerVol.value));
    });
  }

  const headerMute = $('header-mute-btn');
  if (headerMute) headerMute.addEventListener('click', toggleMute);
}

function setupDashboardControls(): void {
  const toggleBtn = $('dashboard-station-square');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (getState() === 'playing') {
        pause();
      } else if (currentStation) {
        selectStation(currentStation, currentEndpointIndex);
      }
    });
  }

  const prevBtn = $('dashboard-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => { navigateStation(-1); });

  const nextBtn = $('dashboard-next');
  if (nextBtn) nextBtn.addEventListener('click', () => { navigateStation(1); });

  const playToggle = $('dashboard-play-toggle');
  if (playToggle) {
    playToggle.addEventListener('click', () => {
      if (getState() === 'playing') {
        pause();
      } else if (currentStation) {
        selectStation(currentStation, currentEndpointIndex);
      }
    });
  }

  const dbVol = $('dashboard-volume') as HTMLInputElement | null;
  if (dbVol) {
    dbVol.addEventListener('input', () => {
      setVolume(parseFloat(dbVol.value));
    });
  }

  const dbMute = $('dashboard-mute-btn');
  if (dbMute) dbMute.addEventListener('click', toggleMute);

  const refreshBtn = $('refresh-playlists');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const statusEl = $('update-status');
      if (statusEl) statusEl.textContent = 'Updating...';
      document.dispatchEvent(new CustomEvent('radiova:refresh'));
    });
  }

  const pwaBtn = $('pwa-install-btn');
  if (pwaBtn) {
    pwaBtn.addEventListener('click', () => { void promptInstall(); });
  }

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('stream-btn') && currentStation) {
      const stationId = target.dataset['stationId'];
      const endpointUrl = target.dataset['url'];
      if (stationId === currentStation.id && endpointUrl) {
        const endpointIndex = currentStation.endpoints.findIndex((ep) => ep.url === endpointUrl);
        if (endpointIndex >= 0) selectStation(currentStation, endpointIndex);
      }
    }
  });
}

const PLACEHOLDER_IMG = '/assets/images/station-placeholder.svg';

const siteIsSecure = window.location.protocol === 'https:';

function safeArtworkUrl(url: string | undefined, context: string): string {
  if (!url) return '';
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) {
    if (siteIsSecure) {
      diagnostics.add('artwork ' + context + ': mixed-content blocked ' + url.slice(0, 60));
      return '';
    }
    return url;
  }
  diagnostics.add('artwork ' + context + ': invalid scheme ' + url.slice(0, 60));
  return '';
}

function updatePlayerUI(state: string): void {
  updateHeaderPlayer(state);
  updateDashboardPlayer(state);
  updateEqualizer(state);
}

function updateHeaderPlayer(state: string): void {
  const toggleIcon = $('header-toggle-icon');
  if (toggleIcon) {
    toggleIcon.innerHTML = state === 'playing' ? PAUSE_ICON_FULL : PLAY_ICON_FULL;
  }
}

function updateDashboardPlayer(state: string): void {
  const dp = $('dashboard-player');
  if (!dp) return;

  const playIconEl = $('dashboard-play-icon');
  if (playIconEl) {
    playIconEl.innerHTML = state === 'playing' ? PAUSE_ICON_FULL : PLAY_ICON_FULL;
  }

  const toggleIcon = $('dashboard-toggle-icon');
  if (toggleIcon) {
    toggleIcon.innerHTML = state === 'playing' ? PAUSE_ICON_FULL : PLAY_ICON_FULL;
  }

  const toggleAttr = $('dashboard-station-square');
  if (toggleAttr) {
    toggleAttr.setAttribute('aria-label', state === 'playing' ? 'Pause' : 'Play');
  }
}

function updateEqualizer(state: string): void {
  const audioEl = getAudioElement();
  if (audioEl && equalizer) {
    equalizer.setAudioElement(audioEl);
  }
  if (equalizer) {
    if (state === 'playing') {
      equalizer.start();
    } else {
      equalizer.stop();
    }
  }
}

function setStationImages(station: Station): void {
  const logoUrl = safeArtworkUrl(station.logo, 'player');

  function setImg(imgId: string, alt: string): void {
    const img = $(imgId) as HTMLImageElement | null;
    if (!img) return;
    if (logoUrl) {
      img.src = logoUrl;
      img.alt = alt;
      img.onerror = () => { diagnostics.add('artwork player: network error for ' + logoUrl.slice(0, 60)); img.src = PLACEHOLDER_IMG; img.onerror = null; };
      img.onload = () => { img.style.display = ''; };
      img.style.display = '';
    } else {
      img.src = PLACEHOLDER_IMG;
      img.alt = alt;
      img.onerror = null;
      img.style.display = '';
    }
  }

  setImg('header-station-image', station.name);
  setImg('dashboard-station-image', station.name);

  const sq = $('dashboard-station-square');
  if (sq) {
    if (logoUrl) {
      sq.classList.remove('no-image');
    } else {
      sq.classList.add('no-image');
    }
  }
}

function selectStation(station: Station, endpointIndex = 0): void {
  const ep = station.endpoints[endpointIndex];
  if (!ep) {
    diagnostics.add('selectStation: no endpoint at index ' + String(endpointIndex) + ' for "' + station.name + '"');
    return;
  }

  const bitrateStr = ep.bitrate ? String(ep.bitrate) + 'k' : '?';
  diagnostics.add('selectStation: "' + station.name + '" -> ' + ep.url + ' (' + (ep.codec || '?') + '/' + bitrateStr + ')');

  currentStation = station;
  currentPlayId = station.id;
  currentEndpointIndex = endpointIndex;

  const info: PlayerStationInfo = {
    stationId: station.id,
    stationName: station.name,
    artworkUrl: station.logo || null,
    endpointId: ep.id,
    endpointUrl: ep.url,
    endpointLabel: [ep.codec, ep.bitrate ? String(ep.bitrate) + 'k' : ''].filter(Boolean).join(' ') || null,
  };
  setStationInfo(info);

  const audioEl = getAudioElement();
  if (audioEl) {
    diagnostics.add('audio readyState=' + String(audioEl.readyState) + ' networkState=' + String(audioEl.networkState) + ' src="' + (audioEl.src.slice(0, 60) || '') + '"');
  }

  if (equalizer) {
    equalizer.prepare();
  }

  play(ep.url);

  updateStationInfo(station);
  setStationImages(station);

  settings.lastStationId = station.id;
  settings.lastEndpointId = ep.id;
  void saveSettings(settings);
  void addRecent(station.id);
  updateStreamSelector(station);
  document.dispatchEvent(new CustomEvent('radiova:player-station-changed', { detail: station.id }));
}

function updateStationInfo(station: Station): void {
  const headerTitle = $('header-station-title');
  if (headerTitle) headerTitle.textContent = station.name;

  const dashboardTitle = $('dashboard-station-title');
  if (dashboardTitle) dashboardTitle.textContent = station.name;

  const linkHref = station.logo || '#';

  const headerLink = $('header-station-link') as HTMLAnchorElement | null;
  if (headerLink) headerLink.href = linkHref;

  const dashboardLink = $('dashboard-station-link') as HTMLAnchorElement | null;
  if (dashboardLink) dashboardLink.href = linkHref;
}

function updateStreamSelector(station: Station): void {
  updateSelector('header-stream-selector', station);
  updateSelector('dashboard-streams', station);
}

function updateSelector(elId: string, station: Station): void {
  const el = $(elId);
  if (!el) return;
  if (station.endpoints.length <= 1) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = station.endpoints.map((ep) => {
    const isActive = getCurrentUrl() === ep.url;
    const label = [ep.codec, ep.bitrate ? String(ep.bitrate) + 'k' : ''].filter(Boolean).join(' ') || 'Stream';
    return '<button class="stream-btn' + (isActive ? ' is-active' : '') + '" data-station-id="' + station.id + '" data-url="' + ep.url + '" type="button">' + escapeHtml(label) + '</button>';
  }).join('');
}

function navigateStation(dir: number): void {
  if (currentStations.length === 0) return;
  const idx = currentPlayId ? currentStations.findIndex((station) => station.id === currentPlayId) : -1;
  let nextIdx: number;
  if (idx === -1) {
    nextIdx = 0;
  } else {
    nextIdx = (idx + dir + currentStations.length) % currentStations.length;
  }
  const nextStation = currentStations[nextIdx];
  if (nextStation) selectStation(nextStation);
}

function handlePlaybackError(): void {
  const audioEl = getAudioElement();
  if (audioEl) {
    const mc = audioEl.error;
    const code = mc ? String(mc.code) : '?';
    const msg = mc ? (mc.message || '?') : '?';
    diagnostics.add('playback error: code=' + code + ' message="' + msg + '" readyState=' + String(audioEl.readyState) + ' networkState=' + String(audioEl.networkState));
  } else {
    diagnostics.add('playback error: no audio element');
  }

  if (currentStation && currentEndpointIndex < currentStation.endpoints.length - 1) {
    const nextIdx = currentEndpointIndex + 1;
    const nextEp = currentStation.endpoints[nextIdx];
    const nextUrl = nextEp ? nextEp.url.slice(0, 60) : '?';
    diagnostics.add('fallback: endpoint ' + String(currentEndpointIndex) + ' failed, trying ' + String(nextIdx) + ' (' + nextUrl + ')');
    selectStation(currentStation, nextIdx);
    return;
  }

  if (currentStation) {
    diagnostics.add('all ' + String(currentStation.endpoints.length) + ' endpoints exhausted for "' + currentStation.name + '"');
  }

  const status = $('update-status');
  if (status) status.textContent = 'Unable to play this stream';
}

function updatePWAButton(): void {
  const btn = $('pwa-install-btn');
  if (!btn) return;

  if (isStandalone()) {
    btn.classList.add('is-hidden');
    return;
  }

  const state = getPWAState();
  if (state === 'installable') {
    btn.classList.remove('is-hidden');
  }
}

function syncAllVolumeSliders(): void {
  const vol = getVolume();
  const sliders = ['header-volume', 'dashboard-volume'];
  for (const id of sliders) {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.value = String(vol);
  }
}

function syncAllMuteButtons(): void {
  const muted = isMuted();
  const muteBtns = ['header-mute-btn', 'dashboard-mute-btn'];
  for (const id of muteBtns) {
    const btn = $(id);
    if (!btn) continue;
    btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    btn.classList.toggle('is-muted', muted);
  }
}

onPWAStateChange(updatePWAButton);

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => { void init(); });
