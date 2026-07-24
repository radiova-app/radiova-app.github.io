import { loadLocale, t, applyI18n } from "../services/i18n";
import { loadPlaylist } from "../services/playlist";
import { whenConsentResolved } from "../services/consent";
import {
  getSharedPlayerState,
  onChange,
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
import { $, escapeHtml, safeArtworkUrl, isLoadingStatus, iconForStatus } from "../shared/dom";
import { EVENTS, PLACEHOLDER_IMG } from "../shared/constants";
import { STAR_FILL, STAR_EMPTY } from "../shared/icons";

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

let tabAbortController: AbortController | null = null;

/** Initialise the dashboard page: load settings, favourites, stations. */
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

/** Set up global listeners that survive view transitions. */
function setupPersistentListeners(): void {
  onChange((state) => {
    playerState = state;
    currentPlayId = state.station.stationId;
    renderStationList();
  });

  document.addEventListener(EVENTS.PLAYER_STATION_CHANGED, (event) => {
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
      if (id === currentPlayId && isLoadingStatus(playerState.status)) return;
      if (id === currentPlayId) {
        document.dispatchEvent(new CustomEvent(EVENTS.PLAYER_TOGGLE));
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

  document.addEventListener(EVENTS.REFRESH, () => {
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

/** Bind tab, search, retry, and page-size controls. */
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

/**
 * Load stations for a given playlist locale and render the list.
 * @param locale - The playlist locale key.
 */
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

/** Render the filtered and paginated station list to the DOM. */
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
  document.dispatchEvent(new CustomEvent(EVENTS.STATIONS_CHANGED, { detail: currentStations }));
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

/**
 * Render a single station row as an HTML string.
 * @param st - The station to render.
 * @returns The HTML string for the station row.
 */
function renderStationRow(st: Station): string {
  const isSelected = currentPlayId === st.id;
  const rowStatus = isSelected ? playerState.status : "idle";
  const statusLabel = isSelected ? playerState.statusLabel : "Play";
  const isFav = favoritesSet.has(st.id);
  const epCount = st.endpoints.length;
  const codecs = [...new Set(st.endpoints.map((ep) => ep.codec).filter(Boolean))];
  const artwork = safeArtworkUrl(st.logo);
  const statusIcon = iconForStatus(rowStatus);

  const artworkHtml = artwork
    ? `<img class="station-row__artwork" src="${escapeHtml(artwork)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';this.onerror=null" />`
    : `<div class="station-row__artfallback"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>`;

  return `<div class="station-row${isSelected ? " is-active" : ""}" data-station-id="${st.id}">
    <div class="station-row__info">
      <button class="station-row__play${rowStatus === "error" ? " has-error" : ""}" type="button" aria-label="${escapeHtml(statusLabel)}" title="${escapeHtml(statusLabel)}">
        ${statusIcon}
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

/**
 * Render pagination controls with ellipsis for large page counts.
 * @param page - The current page index (0-based).
 * @param total - Total number of pages.
 */
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

/**
 * Update the list footer with count display and page size selector.
 * @param total - Total number of stations.
 * @param start - Start index of the current page.
 * @param end - End index of the current page.
 */
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

/**
 * Find a station by ID in the loaded station list.
 * @param id - The station ID.
 * @returns The Station, or undefined.
 */
function findStation(id: string): Station | undefined {
  return allStations.find((s) => s.id === id);
}

/**
 * Dispatch STATION_SELECTED event to trigger playback.
 * @param st - The station to play.
 */
function playStation(st: Station): void {
  currentPlayId = st.id;
  document.dispatchEvent(new CustomEvent(EVENTS.STATION_SELECTED, { detail: st }));
}

/** Show/hide the Favorites tab based on whether any favourites exist. */
function updateFavoritesTabVisibility(): void {
  const favTab = document.querySelector<HTMLElement>('.station-tab[data-locale="favorites"]');
  if (favTab) {
    favTab.classList.toggle("is-hidden", favoritesSet.size === 0);
  }
}

/**
 * Toggle a station's favourite status and re-render.
 * @param id - The station ID.
 */
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

/**
 * Update the status display after playlist load.
 * @param fromCache - true if the playlist was loaded from cache.
 */
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

/** Update the station count display. */
function updateStationCount(): void {
  const el = $("station-count");
  if (!el) return;
  el.textContent = t("filter.count", { count: allStations.length });
}

/**
 * Show/hide the loading indicator.
 * @param show - true to show, false to hide.
 */
function showLoading(show: boolean): void {
  const el = $("loading-indicator");
  if (el) el.classList.toggle("is-hidden", !show);
  if (show) {
    hideEmpty();
    hideError();
  }
}

/** Show the empty state and clear the station list. */
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

/** Hide the empty state. */
function hideEmpty(): void {
  const el = $("empty-state");
  if (el) el.classList.add("is-hidden");
}

/** Hide the error state. */
function hideError(): void {
  const el = $("error-state");
  if (el) el.classList.add("is-hidden");
}

/** Re-bind dashboard UI after an Astro view transition. */
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
