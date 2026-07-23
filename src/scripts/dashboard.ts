import { loadLocale, t, applyI18n } from "../services/i18n";
import { loadPlaylist } from "../services/playlist";
import { whenConsentResolved } from "../services/consent";
import {
  getSharedPlayerState,
  onChange,
  type PlayerState,
  type SharedPlayerState,
} from "../services/player";
import {
  getSettings,
  saveSettings,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../services/db";
import type { Station } from "../types/station";
import type { AppSettings } from "../types/storage";

const PLAY_ICON_SVG =
  '<svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>';
const PAUSE_ICON_SVG =
  '<svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>';
const SPINNER_ICON_SVG =
  '<svg viewBox="0 0 24 24" class="menu-icon loading-spinner" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" opacity="0.25"/><path d="M20 12a8 8 0 00-8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const WARNING_ICON_SVG =
  '<svg viewBox="0 0 24 24" class="menu-icon warning-icon" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const STAR_FILL = "\u2605";
const STAR_EMPTY = "\u2606";

let allStations: Station[] = [];
let currentStations: Station[] = [];
let currentLocale = "all";
let currentPage = 0;
let pageSize = 10;
let currentPlayId: string | null = null;
let playerState: SharedPlayerState = getSharedPlayerState();
let favoritesSet = new Set<string>();
let settings: AppSettings;
let search = "";

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

let tabAbortController: AbortController | null = null;

async function init(): Promise<void> {
  loadLocale();
  applyI18n();

  settings = await getSettings();
  favoritesSet = await getFavorites();
  currentLocale = settings.lastPlaylist || "all";

  setupPersistentListeners();
  bindDashboardUI();
  updateFavoritesTabVisibility();
  await loadStations(currentLocale);
}

function setupPersistentListeners(): void {
  onChange((state) => {
    playerState = state;
    currentPlayId = state.station.stationId;
    renderStationList();
  });

  document.addEventListener("radiova:player-station-changed", (event) => {
    currentPlayId = (event as CustomEvent<string>).detail;
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const row: HTMLElement | null = target.closest(".station-row");
    if (!row) return;
    const id = row.dataset["stationId"];
    if (!id) return;

    if (target.closest(".station-star")) {
      void toggleFav(id);
      return;
    }

    if (target.closest(".station-row__play")) {
      if (id === currentPlayId && isPendingStatus(playerState.status)) return;
      if (id === currentPlayId) {
        document.dispatchEvent(new CustomEvent("radiova:player-toggle"));
      } else {
        const st = findStation(id);
        if (st) playStation(st);
      }
      return;
    }
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("page-btn") && !(target as HTMLButtonElement).disabled) {
      const page = parseInt(target.dataset["page"] || "0", 10);
      if (!isNaN(page)) {
        currentPage = page;
        renderStationList();
      }
    }
  });

  document.addEventListener("radiova:refresh", () => {
    void loadStations(currentLocale);
    const statusEl = $("update-status");
    if (statusEl) {
      statusEl.textContent = t("status.updating");
      setTimeout(() => {
        statusEl.textContent = "";
      }, 3000);
    }
  });
}

function bindDashboardUI(): void {
  if (typeof settings === "undefined") return;
  tabAbortController?.abort();
  tabAbortController = new AbortController();
  const signal = tabAbortController.signal;

  currentLocale = settings.lastPlaylist || "all";

  document.querySelectorAll(".station-tab").forEach((tab) => {
    const locale = tab.getAttribute("data-locale") || "";
    const isActive = locale === currentLocale;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");

    tab.addEventListener(
      "click",
      () => {
        const loc = locale;
        document.querySelectorAll(".station-tab").forEach((t) => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        currentLocale = loc;
        if (loc !== "favorites") {
          settings.lastPlaylist = loc;
          void saveSettings(settings);
        }
        currentPage = 0;
        void loadStations(loc);
      },
      { signal },
    );
  });

  const searchInput = $("station-search") as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      () => {
        search = searchInput.value.toLowerCase();
        currentPage = 0;
        renderStationList();
      },
      { signal },
    );
  }

  const retryBtn = $("retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener(
      "click",
      () => {
        void loadStations(currentLocale);
      },
      { signal },
    );
  }

  const pageSizeSelect = $("page-size-select") as HTMLSelectElement | null;
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener(
      "change",
      () => {
        pageSize = parseInt(pageSizeSelect.value, 10) || 10;
        currentPage = 0;
        renderStationList();
      },
      { signal },
    );
  }
}

async function loadStations(locale: string): Promise<void> {
  showLoading(true);
  hideError();

  const playlistLocale = locale === "favorites" ? "all" : locale;
  const { stations, fromCache } = await loadPlaylist(playlistLocale);

  if (stations.length === 0) {
    showLoading(false);
    showEmpty();
    return;
  }

  allStations = stations;
  showLoading(false);
  updateStatus(fromCache);
  renderStationList();
  updateStationCount();
}

function renderStationList(): void {
  const list = $("stations-list");
  if (!list) return;

  let filtered = allStations;
  if (currentLocale === "favorites") {
    filtered = filtered.filter((s) => favoritesSet.has(s.id));
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
  }

  currentStations = filtered;
  document.dispatchEvent(new CustomEvent("radiova:stations-changed", { detail: currentStations }));
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(0, Math.min(currentPage, pages - 1));
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const shown = filtered.slice(start, end);

  if (total === 0) {
    list.innerHTML = "";
    showEmpty();
    renderPagination(0, 0);
    renderListFooter(0, 0, 0);
    return;
  }

  hideEmpty();
  list.innerHTML = shown.map((st) => renderStationRow(st)).join("");
  renderPagination(page, pages);
  renderListFooter(total, start, end);

  updateStationCount();
}

const PLACEHOLDER_IMG = "/assets/images/station-placeholder.svg";
const isSecure = window.location.protocol === "https:";

const dashboardDiag = {
  add: (_msg: string): void => {
    /* noop */
  },
};

(function setupDashboardDiagnostics(): void {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    dashboardDiag.add = (msg: string) => {
      console.log("🎨", msg);
    };
  }
})();

function safeArtworkUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) {
    if (isSecure) {
      dashboardDiag.add("artwork: mixed-content blocked " + url.slice(0, 60));
      return "";
    }
    return url;
  }
  dashboardDiag.add("artwork: invalid scheme " + url.slice(0, 60));
  return "";
}

function renderStationRow(st: Station): string {
  const isSelected = currentPlayId === st.id;
  const rowStatus = isSelected ? playerState.status : "idle";
  const statusLabel = isSelected ? playerState.statusLabel : "Play";
  const isFav = favoritesSet.has(st.id);
  const epCount = st.endpoints.length;
  const codecs = [...new Set(st.endpoints.map((ep) => ep.codec).filter(Boolean))];
  const artwork = safeArtworkUrl(st.logo);

  const artworkHtml = artwork
    ? `<img class="station-row__artwork" src="${escapeHtml(artwork)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';this.onerror=null" />`
    : `<div class="station-row__artfallback"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>`;

  return `<div class="station-row${isSelected ? " is-active" : ""}" data-station-id="${st.id}">
    <div class="station-row__info">
      <button class="station-row__play${rowStatus === "error" ? " has-error" : ""}" type="button" aria-label="${escapeHtml(statusLabel)}" title="${escapeHtml(statusLabel)}">
        ${iconForStatus(rowStatus)}
      </button>
      <div class="station-row__visual">${artworkHtml}</div>
      <div>
        <div class="station-row__name">${escapeHtml(st.name)}</div>
        <div class="station-row__meta">
          ${epCount > 1 ? `<span class="meta-chip">${String(epCount)} streams</span>` : ""}
          ${codecs.length ? `<span class="meta-chip">${escapeHtml(codecs.join(", "))}</span>` : ""}
          ${st.countryCode ? `<span class="meta-chip">${escapeHtml(st.countryCode)}</span>` : ""}
        </div>
      </div>
    </div>
    <div class="station-row__actions">
      <button class="station-icon-btn station-star${isFav ? " is-active" : ""}" type="button" aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">${isFav ? STAR_FILL : STAR_EMPTY}</button>
    </div>
  </div>`;
}

function renderPagination(page: number, total: number): void {
  const el = $("stations-pagination");
  if (!el) return;
  if (total <= 1) {
    el.classList.remove("is-visible");
    return;
  }
  el.classList.add("is-visible");

  let html = "";
  html += `<button class="page-btn" data-page="${String(page - 1)}" ${page === 0 ? "disabled" : ""}>\u2039</button>`;

  const pages: (number | ".")[] = [];
  if (total <= 9) {
    for (let i = 0; i < total; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 3) pages.push(".");
    const start = Math.max(1, page - 1);
    const end = Math.min(total - 2, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < total - 4) pages.push(".");
    pages.push(total - 1);
  }

  for (const p of pages) {
    if (p === ".") {
      html += '<span class="page-dots">·</span>';
    } else {
      html += `<button class="page-btn${p === page ? " is-active" : ""}" data-page="${String(p)}">${String(p + 1)}</button>`;
    }
  }

  html += `<button class="page-btn" data-page="${String(page + 1)}" ${page + 1 >= total ? "disabled" : ""}>\u203A</button>`;
  el.innerHTML = html;
}

function renderListFooter(total: number, start: number, end: number): void {
  const footer = $("list-footer");
  const count = $("list-count");
  const sizeSelect = $("page-size-select") as HTMLSelectElement | null;
  if (!footer || !count) return;
  if (total === 0) {
    footer.classList.add("is-hidden");
    return;
  }
  footer.classList.remove("is-hidden");
  count.textContent = `${String(start + 1)}-${String(end)} / ${String(total)}`;
  if (sizeSelect) sizeSelect.value = String(pageSize);
}

function findStation(id: string): Station | undefined {
  return allStations.find((s) => s.id === id);
}

function playStation(st: Station): void {
  currentPlayId = st.id;
  document.dispatchEvent(new CustomEvent("radiova:station-selected", { detail: st }));
}

function iconForStatus(status: PlayerState): string {
  if (status === "playing") return PAUSE_ICON_SVG;
  if (isPendingStatus(status)) return SPINNER_ICON_SVG;
  if (status === "error") return WARNING_ICON_SVG;
  return PLAY_ICON_SVG;
}

function isPendingStatus(status: PlayerState): boolean {
  return status === "loading" || status === "waiting" || status === "retrying";
}

function updateFavoritesTabVisibility(): void {
  const favTab = document.querySelector<HTMLElement>('.station-tab[data-locale="favorites"]');
  if (favTab) {
    favTab.classList.toggle("is-hidden", favoritesSet.size === 0);
  }
}

async function toggleFav(id: string): Promise<void> {
  if (favoritesSet.has(id)) {
    favoritesSet.delete(id);
    await removeFavorite(id);
  } else {
    favoritesSet.add(id);
    await addFavorite(id);
  }
  updateFavoritesTabVisibility();
  if (currentLocale === "favorites" && favoritesSet.size === 0) {
    const allTab = document.querySelector<HTMLElement>('.station-tab[data-locale="all"]');
    if (allTab) allTab.click();
  } else {
    renderStationList();
  }
}

function updateStatus(fromCache: boolean): void {
  const statusEl = $("update-status");
  if (!statusEl) return;
  if (fromCache) {
    statusEl.textContent = t("status.cached");
  } else {
    statusEl.textContent = t("status.updated");
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
  }
}

function updateStationCount(): void {
  const el = $("station-count");
  if (!el) return;
  el.textContent = t("filter.count", { count: allStations.length });
}

function showLoading(show: boolean): void {
  const el = $("loading-indicator");
  if (el) el.classList.toggle("is-hidden", !show);
  if (show) {
    hideEmpty();
    hideError();
  }
}

function showEmpty(): void {
  const el = $("empty-state");
  if (el) el.classList.remove("is-hidden");
  const list = $("stations-list");
  if (list) list.innerHTML = "";
  const pagination = $("stations-pagination");
  if (pagination) pagination.classList.remove("is-visible");
  const footer = $("list-footer");
  if (footer) footer.classList.add("is-hidden");
}

function hideEmpty(): void {
  const el = $("empty-state");
  if (el) el.classList.add("is-hidden");
}

function hideError(): void {
  const el = $("error-state");
  if (el) el.classList.add("is-hidden");
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function reinitOnNavigation(): void {
  if (document.getElementById("stations-list")) {
    loadLocale();
    applyI18n();
    bindDashboardUI();
    renderStationList();
    updateFavoritesTabVisibility();
  }
}

document.addEventListener("astro:page-load", reinitOnNavigation);

document.addEventListener("DOMContentLoaded", () => {
  void whenConsentResolved().then(() => init());
});
