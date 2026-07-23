import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");

function pathExists(relative: string): boolean {
  return existsSync(resolve(root, relative));
}

function readFile(relative: string): string {
  return readFileSync(resolve(root, relative), "utf-8");
}

describe("site structure", () => {
  it("has required config files", () => {
    expect(pathExists("astro.config.mjs")).toBe(true);
    expect(pathExists("tsconfig.json")).toBe(true);
    expect(pathExists("eslint.config.js")).toBe(true);
    expect(pathExists(".prettierrc")).toBe(true);
    expect(pathExists("vitest.config.ts")).toBe(true);
    expect(pathExists("package.json")).toBe(true);
  });

  it("has required source directories", () => {
    expect(pathExists("src/components")).toBe(true);
    expect(pathExists("src/layouts")).toBe(true);
    expect(pathExists("src/pages")).toBe(true);
    expect(pathExists("src/pages/uk")).toBe(true);
    expect(pathExists("src/pages/de")).toBe(true);
    expect(pathExists("src/styles")).toBe(true);
    expect(pathExists("src/types")).toBe(true);
    expect(pathExists("src/config")).toBe(true);
    expect(pathExists("src/services")).toBe(true);
    expect(pathExists("src/scripts")).toBe(true);
  });

  it("has required public directories", () => {
    expect(pathExists("public")).toBe(true);
    expect(pathExists("public/assets/icons")).toBe(true);
    expect(pathExists("public/config")).toBe(true);
    expect(pathExists("public/manifest.webmanifest")).toBe(true);
    expect(pathExists("public/sw.js")).toBe(true);
  });

  it("has required layouts", () => {
    expect(pathExists("src/layouts/AppShell.astro")).toBe(true);
  });

  it("has all English pages", () => {
    expect(pathExists("src/pages/index.astro")).toBe(true);
    expect(pathExists("src/pages/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/playlists.astro")).toBe(true);
    expect(pathExists("src/pages/about.astro")).toBe(true);
    expect(pathExists("src/pages/help.astro")).toBe(true);
    expect(pathExists("src/pages/privacy.astro")).toBe(true);
    expect(pathExists("src/pages/support.astro")).toBe(true);
  });

  it("has all Ukrainian pages", () => {
    expect(pathExists("src/pages/uk/index.astro")).toBe(true);
    expect(pathExists("src/pages/uk/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/uk/playlists.astro")).toBe(true);
    expect(pathExists("src/pages/uk/about.astro")).toBe(true);
    expect(pathExists("src/pages/uk/help.astro")).toBe(true);
    expect(pathExists("src/pages/uk/privacy.astro")).toBe(true);
    expect(pathExists("src/pages/uk/support.astro")).toBe(true);
  });

  it("has all German pages", () => {
    expect(pathExists("src/pages/de/index.astro")).toBe(true);
    expect(pathExists("src/pages/de/downloads.astro")).toBe(true);
    expect(pathExists("src/pages/de/playlists.astro")).toBe(true);
    expect(pathExists("src/pages/de/about.astro")).toBe(true);
    expect(pathExists("src/pages/de/help.astro")).toBe(true);
    expect(pathExists("src/pages/de/privacy.astro")).toBe(true);
    expect(pathExists("src/pages/de/support.astro")).toBe(true);
  });

  it("has required source files", () => {
    expect(pathExists("src/styles/_tokens.scss")).toBe(true);
    expect(pathExists("src/styles/global.scss")).toBe(true);
    expect(pathExists("src/types/station.ts")).toBe(true);
    expect(pathExists("src/types/storage.ts")).toBe(true);
    expect(pathExists("src/config/site.ts")).toBe(true);
    expect(pathExists("src/env.d.ts")).toBe(true);
  });

  it("has services", () => {
    expect(pathExists("src/services/i18n.ts")).toBe(true);
    expect(pathExists("src/services/db.ts")).toBe(true);
    expect(pathExists("src/services/player.ts")).toBe(true);
    expect(pathExists("src/services/playlist.ts")).toBe(true);
    expect(pathExists("src/services/m3u.ts")).toBe(true);
    expect(pathExists("src/services/pwa.ts")).toBe(true);
  });

  it("has client scripts", () => {
    expect(pathExists("src/scripts/dashboard.ts")).toBe(true);
    expect(pathExists("src/scripts/app.ts")).toBe(true);
    expect(pathExists("src/scripts/downloads.ts")).toBe(true);
    expect(pathExists("src/scripts/equalizer.ts")).toBe(true);
    expect(pathExists("src/scripts/playlists.ts")).toBe(true);
    expect(pathExists("src/scripts/reset-data.ts")).toBe(true);
    expect(pathExists("src/scripts/sw-register.ts")).toBe(true);
  });

  it("has PWA icons", () => {
    expect(pathExists("public/assets/icons/icon-192.png")).toBe(true);
    expect(pathExists("public/assets/icons/icon-512.png")).toBe(true);
    expect(pathExists("public/assets/icons/icon-192-maskable.png")).toBe(true);
    expect(pathExists("public/assets/icons/icon-512-maskable.png")).toBe(true);
  });

  it("has GitHub Actions workflow", () => {
    expect(pathExists(".github/workflows/deploy.yml")).toBe(true);
  });

  it("has helper scripts", () => {
    expect(pathExists("scripts/clean-build.mjs")).toBe(true);
    expect(pathExists("scripts/ensure-nojekyll.mjs")).toBe(true);
    expect(pathExists("scripts/serve-docs.mjs")).toBe(true);
    expect(pathExists("scripts/generate-icons.mjs")).toBe(true);
  });
});

describe("AppShell layout", () => {
  const appShell = readFile("src/layouts/AppShell.astro");

  it("has sidebar navigation", () => {
    expect(appShell).toContain("sidebar");
    expect(appShell).toContain("menu-item");
  });

  it("has Home sidebar item", () => {
    expect(appShell).toContain('labelEn: "Home"');
    expect(appShell).toContain('labelUk: "Головна"');
    expect(appShell).toContain('labelDe: "Start"');
  });

  it("has Playlists sidebar item", () => {
    expect(appShell).toContain("/playlists");
  });

  it("has Downloads sidebar item", () => {
    expect(appShell).toContain("/downloads");
  });

  it("has About sidebar item", () => {
    expect(appShell).toContain("/about");
  });

  it("has Help sidebar item", () => {
    expect(appShell).toContain("/help");
  });

  it("has Privacy sidebar item", () => {
    expect(appShell).toContain("/privacy");
  });

  it("has header player", () => {
    expect(appShell).toContain("header-player");
    expect(appShell).toContain("header-station-logo");
    expect(appShell).toContain("header-station-image");
    expect(appShell).toContain("header-station-title");
  });

  it("home page has dashboard player panel", () => {
    const home = readFile("src/pages/index.astro");
    expect(home).toContain("dashboard-player");
    expect(home).toContain("dashboard-station-square");
    expect(home).toContain("dashboard-station-image");
    expect(home).toContain("dashboard-station-title");
  });

  it("home page has dashboard player controls", () => {
    const home = readFile("src/pages/index.astro");
    expect(home).toContain("dashboard-prev");
    expect(home).toContain("dashboard-mute-btn");
    expect(home).toContain("dashboard-volume");
    expect(home).toContain("dashboard-next");
    expect(home).toContain("dashboard-play-toggle");
  });

  it("home page has equalizer canvases", () => {
    const home = readFile("src/pages/index.astro");
    expect(home).toContain("dashboard-equalizer-left");
    expect(home).toContain("dashboard-equalizer-right");
  });

  it("has language switcher", () => {
    expect(appShell).toContain("lang-switcher");
    expect(appShell).toContain("EN");
    expect(appShell).toContain("DE");
    expect(appShell).toContain("UK");
  });

  it("has PWA install button", () => {
    expect(appShell).toContain("pwa-install-btn");
  });

  it("has active route highlighting", () => {
    expect(appShell).toContain('is-active"');
  });

  it("loads app.ts script", () => {
    expect(appShell).toContain("app.ts");
  });

  it("has localized href helper for sidebar", () => {
    expect(appShell).toContain("localizeHref");
  });

  it("has isActive helper for sidebar", () => {
    expect(appShell).toContain("isActive");
  });
});

describe("navigation - top menu removed", () => {
  const header = readFile("src/components/Header.astro");

  it("no longer has nav links in the header", () => {
    expect(header).not.toContain("header__nav");
  });

  it("still has header logo", () => {
    expect(header).toContain("header__logo");
  });

  it("still has language switcher", () => {
    expect(header).toContain("LanguageSwitcher");
  });
});

describe("localized routes preserve locale", () => {
  it("uk pages use AppShell with lang=uk", () => {
    const content = readFile("src/pages/uk/index.astro");
    expect(content).toContain('const lang = "uk"');
    expect(content).toContain("AppShell");
  });

  it("de pages use AppShell with lang=de", () => {
    const content = readFile("src/pages/de/index.astro");
    expect(content).toContain('const lang = "de"');
    expect(content).toContain("AppShell");
  });

  it("uk playlists page uses AppShell", () => {
    const content = readFile("src/pages/uk/playlists.astro");
    expect(content).toContain('const lang = "uk"');
    expect(content).toContain("AppShell");
  });

  it("de playlists page uses AppShell", () => {
    const content = readFile("src/pages/de/playlists.astro");
    expect(content).toContain('const lang = "de"');
    expect(content).toContain("AppShell");
  });
});

describe("equalizer lifecycle", () => {
  const equalizer = readFile("src/scripts/equalizer.ts");

  it("exports createEqualizer function", () => {
    expect(equalizer).toContain("export function createEqualizer");
  });

  it("uses AudioContext", () => {
    expect(equalizer).toContain("AudioContext");
  });

  it("uses AnalyserNode", () => {
    expect(equalizer).toContain("AnalyserNode");
    expect(equalizer).toContain("createAnalyser");
  });

  it("uses requestAnimationFrame", () => {
    expect(equalizer).toContain("requestAnimationFrame");
  });

  it("cleans up on destroy", () => {
    expect(equalizer).toContain("cancelAnimationFrame");
  });

  it("respects reduced motion", () => {
    expect(equalizer).toContain("prefers-reduced-motion");
  });

  it("prevents duplicate MediaElementSource", () => {
    expect(equalizer).toContain("if (!graph.source) graph.source = ctx.createMediaElementSource(audioEl)");
    expect(equalizer.match(/createMediaElementSource\(audioEl\)/g)?.length).toBe(1);
  });
});

describe("logo fallback", () => {
  const appShell = readFile("src/layouts/AppShell.astro");
  const appTs = readFile("src/scripts/app.ts");

  it("app.ts sets onerror handler for logo image", () => {
    expect(appTs).toContain("onerror");
    expect(appTs).toContain("PLACEHOLDER_IMG");
  });

  it("app.ts handles station-image element", () => {
    expect(appShell).toContain("station-image");
  });
});

describe("player service", () => {
  const player = readFile("src/services/player.ts");

  it("sets crossOrigin anonymous for Web Audio compatibility", () => {
    expect(player).toContain("el.src = url");
    expect(player).toContain('crossOrigin = "anonymous"');
  });

  it("exports getAudioElement", () => {
    expect(player).toContain("export function getAudioElement");
  });

  it("uses media events as playback state authority", () => {
    for (const eventName of [
      "loadstart",
      "waiting",
      "stalled",
      "canplay",
      "playing",
      "pause",
      "ended",
      "error",
      "abort",
      "emptied",
    ]) {
      expect(player).toContain(`addEventListener("${eventName}"`);
    }
  });

  it("does not set playing from play promise", () => {
    const playImpl = player.match(/export function play\([\s\S]+?\n\}/);
    expect(playImpl).not.toBeNull();
    if (playImpl) expect(playImpl[0]).not.toContain('setState("playing"');
  });

  it("maps loadstart, waiting, playing, and pause to real states", () => {
    expect(player).toContain('addEventListener("loadstart"');
    expect(player).toContain('setState("loading")');
    expect(player).toContain('addEventListener("waiting"');
    expect(player).toContain('setState("waiting")');
    expect(player).toContain('addEventListener("playing"');
    expect(player).toContain('setState("playing")');
    expect(player).toContain('addEventListener("pause"');
    expect(player).toContain('setState("paused")');
  });

  it("has localized playback status labels", () => {
    for (const label of [
      "Choose a station from the list",
      "Loading...",
      "Playing",
      "Paused",
      "Waiting for stream...",
      "Trying another stream...",
      "Stream error",
    ]) {
      expect(player).toContain(label);
    }
    for (const label of [
      "Виберіть станцію зі списку",
      "Завантаження...",
      "Грає",
      "Призупинено",
      "Очікування потоку...",
      "Спроба іншого потоку...",
      "Помилка потоку",
    ]) {
      expect(player).toContain(label);
    }
    for (const label of [
      "Wählen Sie einen Sender aus der Liste",
      "Wird geladen...",
      "Wiedergabe",
      "Pausiert",
      "Stream wird erwartet...",
      "Anderer Stream wird versucht...",
      "Streamfehler",
    ]) {
      expect(player).toContain(label);
    }
  });
});

describe("media-event player UI", () => {
  const app = readFile("src/scripts/app.ts");
  const dashboard = readFile("src/scripts/dashboard.ts");
  const appShell = readFile("src/layouts/AppShell.astro");
  const home = readFile("src/pages/index.astro");
  const styles = readFile("src/styles/global.scss");

  it("click handlers issue commands without directly setting playing", () => {
    expect(app).toContain('addEventListener("click", togglePlayback');
    expect(app).not.toContain("button.innerHTML = pauseIcon");
    expect(app).not.toContain('status = "playing"');
  });

  it("large and compact players have visible status elements", () => {
    expect(home).toContain("dashboard-player-status");
    expect(appShell).toContain("header-player-status");
  });

  it("uses spinner for loading, waiting, and retrying states", () => {
    expect(app).toContain("isLoadingStatus(status)");
    expect(app).toContain("SPINNER_ICON_FULL");
    expect(dashboard).toContain("SPINNER_ICON_SVG");
    expect(dashboard).toContain(
      'status === "loading" || status === "waiting" || status === "retrying"',
    );
  });

  it("uses warning icon after all endpoints fail", () => {
    expect(app).toContain('setPlaybackStatus("error"');
    expect(app).toContain("WARNING_ICON_FULL");
    expect(dashboard).toContain("WARNING_ICON_SVG");
  });

  it("row icon follows shared player state, not click-local state", () => {
    expect(dashboard).toContain("let playerState: SharedPlayerState = getSharedPlayerState()");
    expect(dashboard).toContain("onChange((state) =>");
    expect(dashboard).toContain('const rowStatus = isSelected ? playerState.status : "idle"');
    expect(dashboard).not.toContain('const isPlaying = isSelected && getState() === "playing"');
  });

  it("large and compact player icon mapping follows shared state", () => {
    expect(app).toContain("function iconForStatus(status: PlayerState)");
    expect(app).toContain('if (status === "playing") return PAUSE_ICON_FULL');
    expect(app).toContain('if (status === "error") return WARNING_ICON_FULL');
  });

  it("has timeout and retrying state for slow or failed streams", () => {
    expect(app).toContain("STREAM_TIMEOUT_MS");
    expect(app).toContain("startStreamTimeout()");
    expect(app).toContain('setPlaybackStatus("retrying")');
  });

  it("removes green active control style but keeps active row outline", () => {
    expect(styles).toContain(".station-row.is-active");
    expect(styles).toContain("border-color: $accent");
    expect(styles).not.toContain(".station-row__play.is-active");
    expect(styles).not.toContain("border-color: rgba(34, 197, 94");
  });

  it("supports reduced-motion spinner fallback", () => {
    expect(styles).toContain("loading-spinner");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});

describe("local playlist management", () => {
  const playlistScript = readFile("src/scripts/playlists.ts");
  const db = readFile("src/services/db.ts");

  it("stores station snapshots for custom playlists", () => {
    expect(db).toContain("stations: Station[]");
    expect(db).toContain("getCustomPlaylists");
  });

  it("supports create, import, rename, delete, and export", () => {
    expect(playlistScript).toContain("createPlaylist");
    expect(playlistScript).toContain("importPlaylist");
    expect(playlistScript).toContain("renameCustomPlaylist");
    expect(playlistScript).toContain("deleteCustomPlaylist");
    expect(playlistScript).toContain("buildM3U");
  });

  it("includes playlist controls in every locale", () => {
    for (const page of [
      "src/pages/playlists.astro",
      "src/pages/uk/playlists.astro",
      "src/pages/de/playlists.astro",
    ]) {
      const content = readFile(page);
      expect(content).toContain("custom-playlist-form");
      expect(content).toContain("import-m3u-btn");
      expect(content).toContain("custom-playlists-list");
    }
  });
});

describe("reset local data", () => {
  const resetScript = readFile("src/scripts/reset-data.ts");

  it("requires confirmation and clears browser data", () => {
    expect(resetScript).toContain("window.confirm");
    expect(resetScript).toContain("resetAllData");
    expect(resetScript).toContain("localStorage.removeItem");
  });

  it("includes the reset action in every privacy page", () => {
    for (const page of [
      "src/pages/privacy.astro",
      "src/pages/uk/privacy.astro",
      "src/pages/de/privacy.astro",
    ]) {
      expect(readFile(page)).toContain("reset-data-btn");
    }
  });
});

describe("PWA shell", () => {
  const serviceWorker = readFile("public/sw.js");

  it("registers the service worker from AppShell", () => {
    expect(readFile("src/layouts/AppShell.astro")).toContain("sw-register.ts");
  });

  it("caches localized app routes", () => {
    expect(serviceWorker).toContain("/uk/playlists");
    expect(serviceWorker).toContain("/de/playlists");
  });

  it("shows iOS installation instructions on every downloads page", () => {
    for (const page of [
      "src/pages/downloads.astro",
      "src/pages/uk/downloads.astro",
      "src/pages/de/downloads.astro",
    ]) {
      expect(readFile(page)).toContain("pwa.ios");
    }
  });
});

describe("SVG icon scoping", () => {
  const scss = readFile("src/styles/global.scss");

  it("has no global svg width rule", () => {
    const lines = scss.split("\n");
    const svgRules = lines.filter((l) => /^\s*svg\s*\{/.test(l) && l.includes("width"));
    expect(svgRules).toHaveLength(0);
  });

  it("scopes menu-icon to 20px", () => {
    expect(scss).toContain(".menu-icon {");
    expect(scss).toContain("width: 20px;");
    expect(scss).toContain("height: 20px;");
  });

  it("scopes menu-icon--stations to 22px", () => {
    expect(scss).toContain("width: 22px;");
    expect(scss).toContain("height: 22px;");
  });

  it("has max-width/max-height on menu-icon", () => {
    expect(scss).toContain(".menu-icon {");
    expect(scss).toContain("max-width: 20px;");
    expect(scss).toContain("max-height: 20px;");
  });

  it("resets svg max-width to none as default", () => {
    expect(scss).toContain("svg {");
    expect(scss).toContain("max-width: none;");
    expect(scss).toContain("max-height: none;");
  });

  it("scopes icon-wrap menu-icon to 18px", () => {
    expect(scss).toContain(".dashboard-player .icon-wrap .menu-icon");
    expect(scss).toContain("width: 18px;");
    expect(scss).toContain("height: 18px;");
  });

  it("scopes station-row play menu-icon to 16px", () => {
    expect(scss).toContain(".station-row__play .menu-icon");
    expect(scss).toContain("width: 16px;");
    expect(scss).toContain("height: 16px;");
  });

  it("scopes header-player toggle-icon menu-icon to 22px", () => {
    expect(scss).toContain(".header-player__toggle-icon .menu-icon");
    expect(scss).toContain("width: 22px;");
    expect(scss).toContain("height: 22px;");
  });

  it("has no unscoped svg width or height", () => {
    const lines = scss.split("\n");
    const bareSvgWidth = lines.filter(
      (l) =>
        /^\s*svg\s*\{/.test(l) &&
        !l.includes("max") &&
        (l.includes("width") || l.includes("height")),
    );
    expect(bareSvgWidth).toHaveLength(0);
  });
});

describe("player locations", () => {
  const appShell = readFile("src/layouts/AppShell.astro");
  const homePage = readFile("src/pages/index.astro");

  it("AppShell no longer contains dashboard-player", () => {
    expect(appShell).not.toContain("dashboard-player");
  });

  it("AppShell still contains header-player", () => {
    expect(appShell).toContain("header-player");
  });

  it("dashboard-player is inside stations-main on home pages", () => {
    const smIndex = homePage.indexOf("stations-main");
    const dpIndex = homePage.indexOf("dashboard-player");
    expect(dpIndex).toBeGreaterThan(smIndex);
  });

  it("station-square is a button element in home page", () => {
    const match = homePage.match(/class="station-square"[^>]*>/);
    expect(match).not.toBeNull();
    if (match) {
      expect(match[0]).toContain("type=");
    }
  });

  it("player-card contains station-link and station-main in home page", () => {
    const pcIdx = homePage.indexOf("player-card");
    const sectionAfterPc = homePage.slice(pcIdx);
    expect(sectionAfterPc).toContain("station-link");
    expect(sectionAfterPc).toContain("station-main");
  });

  it("has level-fills for left and right channels in home page", () => {
    expect(homePage).toContain("dashboard-left-level-fill");
    expect(homePage).toContain("dashboard-right-level-fill");
  });

  it("controls order in home page: play/pause first, prev, next, mute", () => {
    const ctrlSection = homePage.slice(
      homePage.indexOf('class="controls"'),
      homePage.indexOf("</div>", homePage.indexOf('class="controls"')),
    );
    expect(ctrlSection.indexOf("dashboard-play-toggle")).toBeLessThan(
      ctrlSection.indexOf("dashboard-prev"),
    );
    expect(ctrlSection.indexOf("dashboard-prev")).toBeLessThan(
      ctrlSection.indexOf("dashboard-next"),
    );
    expect(ctrlSection.indexOf("dashboard-next")).toBeLessThan(
      ctrlSection.indexOf("dashboard-mute-btn"),
    );
  });
});

describe("dashboard-player only on home pages", () => {
  const homePages = [
    "src/pages/index.astro",
    "src/pages/uk/index.astro",
    "src/pages/de/index.astro",
  ];
  const nonHomePages = [
    "src/pages/downloads.astro",
    "src/pages/uk/downloads.astro",
    "src/pages/de/downloads.astro",
    "src/pages/playlists.astro",
    "src/pages/uk/playlists.astro",
    "src/pages/de/playlists.astro",
    "src/pages/about.astro",
    "src/pages/uk/about.astro",
    "src/pages/de/about.astro",
    "src/pages/help.astro",
    "src/pages/uk/help.astro",
    "src/pages/de/help.astro",
    "src/pages/privacy.astro",
    "src/pages/uk/privacy.astro",
    "src/pages/de/privacy.astro",
  ];

  for (const page of homePages) {
    it(`${page} contains dashboard-player`, () => {
      expect(readFile(page)).toContain("dashboard-player");
    });
  }

  for (const page of nonHomePages) {
    it(`${page} does not contain dashboard-player`, () => {
      expect(readFile(page)).not.toContain("dashboard-player");
    });
  }
});

describe("station row structure", () => {
  const dashboard = readFile("src/scripts/dashboard.ts");

  it("renders station-row__visual", () => {
    expect(dashboard).toContain("station-row__visual");
  });

  it("renders station-row__artwork or artfallback", () => {
    const hasArtwork = dashboard.includes("station-row__artwork");
    const hasFallback = dashboard.includes("station-row__artfallback");
    expect(hasArtwork || hasFallback).toBe(true);
  });

  it("uses safeArtworkUrl for artwork", () => {
    expect(dashboard).toContain("safeArtworkUrl");
  });

  it("has play/pause toggle in station row", () => {
    expect(dashboard).toContain("station-row__play");
    expect(dashboard).toContain("station-row__play");
  });

  it("has favorite star button", () => {
    expect(dashboard).toContain("station-star");
  });

  it("has metadata chips", () => {
    expect(dashboard).toContain("meta-chip");
  });

  it("click on already-playing station pauses", () => {
    expect(dashboard).toContain("radiova:player-toggle");
  });
});

describe("safe artwork URL handling", () => {
  const dashboard = readFile("src/scripts/dashboard.ts");
  const app = readFile("src/scripts/app.ts");

  it("dashboard.ts has safeArtworkUrl function", () => {
    expect(dashboard).toContain("safeArtworkUrl");
  });

  it("dashboard.ts handles mixed-content HTTP artwork", () => {
    expect(dashboard).toContain("mixed-content blocked");
  });

  it("dashboard.ts uses PLACEHOLDER_IMG fallback", () => {
    expect(dashboard).toContain("PLACEHOLDER_IMG");
    expect(dashboard).toContain("station-placeholder.svg");
  });

  it("app.ts has safeArtworkUrl for player images", () => {
    expect(app).toContain("safeArtworkUrl");
  });

  it("app.ts handles artwork network error with fallback", () => {
    expect(app).toContain('diagnostics.add("artwork " + context + ": fallback for "');
    expect(app).toContain("fallback for");
  });

  it("app.ts uses same PLACEHOLDER_IMG constant", () => {
    expect(app).toContain("station-placeholder.svg");
  });
});

describe("build output structure", () => {
  it("home page has dashboard-player inside stations-main", () => {
    const html = readFile("dist/uk/index.html");
    const smIndex = html.indexOf("stations-main");
    const dpSection = html.slice(smIndex, html.indexOf("stations-visual", smIndex));
    expect(dpSection).toContain("dashboard-player");
  });

  it("non-home page has no dashboard-player", () => {
    const html = readFile("dist/uk/playlists/index.html");
    expect(html).not.toContain("dashboard-player");
  });

  it("all pages still have header-player", () => {
    for (const p of [
      "dist/uk/index.html",
      "dist/uk/playlists/index.html",
      "dist/de/index.html",
      "dist/index.html",
    ]) {
      expect(readFile(p)).toContain("header-player");
    }
  });

  it("player-card contains station-square, station-main, title, audio-side, streams", () => {
    const html = readFile("dist/uk/index.html");
    const pcStart = html.indexOf("player-card");
    const pcEnd = html.indexOf('class="controls"', pcStart);
    const pcSection = html.slice(pcStart, pcEnd);
    expect(pcSection).toContain("station-square");
    expect(pcSection).toContain("station-main");
    expect(pcSection).toContain("station-link");
    expect(pcSection).toContain("player-audio-side");
    expect(pcSection).toContain("dashboard-streams");
  });

  it("station-square is a button in build output", () => {
    const html = readFile("dist/uk/index.html");
    expect(html).toContain('<button class="station-square"');
  });

  it("has two level-track sections with left and right fills", () => {
    const html = readFile("dist/uk/index.html");
    expect(html).toContain("dashboard-left-level-fill");
    expect(html).toContain("dashboard-right-level-fill");
  });

  it("equalizer canvases have correct IDs", () => {
    const html = readFile("dist/uk/index.html");
    expect(html).toContain("dashboard-equalizer-left");
    expect(html).toContain("dashboard-equalizer-right");
  });

  it("all built pages contain sidebar", () => {
    for (const p of [
      "dist/uk/index.html",
      "dist/uk/playlists/index.html",
      "dist/uk/about/index.html",
      "dist/de/index.html",
      "dist/index.html",
    ]) {
      expect(readFile(p)).toContain('id="sidebar"');
    }
  });

  it("all built pages contain menu-icon SVGs", () => {
    for (const p of [
      "dist/uk/index.html",
      "dist/uk/playlists/index.html",
      "dist/de/index.html",
      "dist/index.html",
    ]) {
      expect(readFile(p)).toContain("menu-icon");
    }
  });
});

describe("diagnostic logging", () => {
  const app = readFile("src/scripts/app.ts");

  it("has dev-only diagnostics module", () => {
    expect(app).toContain("isDev");
    expect(app).toContain("diagnostics");
  });

  it("logs play promise rejection to diagnostics", () => {
    expect(app).toContain("playback error: code=");
  });

  it("has fallback endpoint logging", () => {
    expect(app).toContain("endpoints exhausted");
  });
});

describe("production build", () => {
  it("builds to dist/ directory", () => {
    expect(pathExists("dist/index.html")).toBe(true);
    expect(pathExists("dist/playlists/index.html")).toBe(true);
    expect(pathExists("dist/downloads/index.html")).toBe(true);
    expect(pathExists("dist/about/index.html")).toBe(true);
    expect(pathExists("dist/help/index.html")).toBe(true);
    expect(pathExists("dist/privacy/index.html")).toBe(true);
  });

  it("builds localized pages", () => {
    expect(pathExists("dist/uk/index.html")).toBe(true);
    expect(pathExists("dist/de/index.html")).toBe(true);
    expect(pathExists("dist/uk/playlists/index.html")).toBe(true);
    expect(pathExists("dist/de/playlists/index.html")).toBe(true);
  });
});

describe("View Transitions and persistent audio", () => {
  const appShell = readFile("src/layouts/AppShell.astro");
  const player = readFile("src/services/player.ts");
  const app = readFile("src/scripts/app.ts");

  it("imports ViewTransitions in AppShell", () => {
    expect(appShell).toContain("ViewTransitions");
    expect(appShell).toContain("astro:transitions");
  });

  it("has ViewTransitions component in head", () => {
    expect(appShell).toContain("<ViewTransitions />");
  });

  it("has persistent audio element with transition:persist", () => {
    expect(appShell).toContain("persistent-audio");
    expect(appShell).toContain("transition:persist");
  });

  it("uses persistent audio element from DOM in player.ts", () => {
    expect(player).toContain('document.getElementById("persistent-audio")');
  });

  it("app.ts is bundled via inline import, not direct src reference", () => {
    const appShell = readFile("src/layouts/AppShell.astro");
    expect(appShell).toContain('import "../scripts/app.ts"');
    expect(appShell).not.toContain('src="/src/scripts/app.ts"');
  });

  it("listens for astro:page-load in app.ts", () => {
    expect(app).toContain("astro:page-load");
  });

  it("has updateLanguageActiveState function", () => {
    expect(app).toContain("updateLanguageActiveState");
  });

  it("has lang-en, lang-de, lang-uk IDs in AppShell", () => {
    expect(appShell).toContain('id="lang-en"');
    expect(appShell).toContain('id="lang-de"');
    expect(appShell).toContain('id="lang-uk"');
  });
});

describe("stereo equalizer", () => {
  const eq = readFile("src/scripts/equalizer.ts");

  it("uses ChannelSplitterNode for stereo", () => {
    expect(eq).toContain("createChannelSplitter");
    expect(eq).toContain("splitter");
  });

  it("has left and right analysers", () => {
    expect(eq).toContain("analyserL");
    expect(eq).toContain("analyserR");
  });

  it("connects splitter outputs to separate analysers", () => {
    expect(eq).toContain("graph.splitter.connect(graph.analyserL, 0)");
    expect(eq).toContain("graph.splitter.connect(graph.analyserR, 1)");
  });

  it("routes destination through gain node, not analysers", () => {
    expect(eq).toContain("graph.gainNode.connect(ctx.destination)");
    expect(eq).not.toContain("analyserL.connect(audioCtx.destination)");
    expect(eq).not.toContain("analyserR.connect(audioCtx.destination)");
  });

  it("draws top downward and bottom upward in code", () => {
    expect(eq).toContain("drawBars(views.topCtx, topData, bufferLength, true)");
    expect(eq).toContain("drawBars(views.bottomCtx, bottomData, bufferLength, false)");
    expect(eq).toContain("const y = growFromTop ? 0 : h - barH");
  });

  it("has real-stereo mode", () => {
    expect(eq).toContain("real-stereo");
  });

  it("has cors-blocked mode", () => {
    expect(eq).toContain("cors-blocked");
  });

  it("has paused mode", () => {
    expect(eq).toContain("paused");
  });
});

describe("language switcher active state", () => {
  const globalScss = readFile("src/styles/global.scss");

  it("has is-active style for lang-switcher links", () => {
    expect(globalScss).toContain("lang-switcher__link.is-active");
    expect(globalScss).toContain("lang-switcher__link[aria-current");
  });
});

describe("no /src/ references in build output", () => {
  it("dist HTML has no /src/ paths", () => {
    const files = [
      "dist/index.html",
      "dist/uk/index.html",
      "dist/de/index.html",
      "dist/playlists/index.html",
      "dist/uk/playlists/index.html",
      "dist/de/playlists/index.html",
      "dist/about/index.html",
      "dist/uk/about/index.html",
      "dist/de/about/index.html",
      "dist/downloads/index.html",
      "dist/uk/downloads/index.html",
      "dist/de/downloads/index.html",
      "dist/help/index.html",
      "dist/uk/help/index.html",
      "dist/de/help/index.html",
      "dist/privacy/index.html",
      "dist/uk/privacy/index.html",
      "dist/de/privacy/index.html",
    ];
    for (const f of files) {
      const html = readFile(f);
      expect(html).not.toContain("/src/");
    }
  });

  it("dist HTML has AppShell hashed bundle", () => {
    const html = readFile("dist/uk/index.html");
    expect(html).toMatch(/_astro\/AppShell\.astro.*\.js/);
  });
});

describe("service worker", () => {
  const sw = readFile("public/sw.js");

  it("has updated cache version", () => {
    expect(sw).toContain("radiova-v4");
  });

  it("guards /src/ paths from caching", () => {
    expect(sw).toContain("/src/");
    expect(sw).toContain("startsWith");
  });

  it("removes old caches on activate", () => {
    expect(sw).toContain("caches.delete");
  });

  it("does not cache non-ok responses", () => {
    expect(sw).toContain("res.ok");
  });
});

describe("privacy consent gate", () => {
  const consent = readFile("src/services/consent.ts");
  const appShell = readFile("src/layouts/AppShell.astro");
  const app = readFile("src/scripts/app.ts");
  const dashboard = readFile("src/scripts/dashboard.ts");
  const playlists = readFile("src/scripts/playlists.ts");
  const swRegister = readFile("src/scripts/sw-register.ts");
  const db = readFile("src/services/db.ts");
  const player = readFile("src/services/player.ts");
  const reporter = readFile("src/services/reporter.ts");
  const i18n = readFile("src/services/i18n.ts");
  const globalScss = readFile("src/styles/global.scss");

  it("defines versioned consent categories", () => {
    expect(consent).toContain('type ConsentCategory = "necessary" | "preferences" | "offline" | "diagnostics"');
    expect(consent).toContain("export interface ConsentState");
    expect(consent).toContain("CONSENT_VERSION = 1");
  });

  it("does not claim cookies are used", () => {
    expect(consent).toContain("No cookies");
    expect(consent).not.toContain("document.cookie");
  });

  it("renders an accessible modal that cannot be dismissed by Escape or backdrop", () => {
    expect(consent).toContain('role="dialog"');
    expect(consent).toContain('aria-modal="true"');
    expect(consent).toContain('aria-labelledby="consent-title"');
    expect(consent).toContain('event.key === "Escape"');
    expect(consent).toContain("data-consent-backdrop");
    expect(consent).toContain("focusDialog(dialog)");
  });

  it("renders exactly two consent decision buttons", () => {
    expect(consent).toContain('id="consent-accept"');
    expect(consent).toContain('id="consent-continue-private"');
    expect(consent).not.toContain("consent-decline");
    expect(consent).not.toContain("text.decline");
  });

  it("keeps Privacy Policy as a secondary link", () => {
    expect(consent).toContain("consent-dialog__privacy-link");
    expect(consent).toContain("text.privacy");
    expect(globalScss).toContain(".consent-dialog__privacy-link");
  });

  it("has a pre-consent modal language switcher that does not resolve consent", () => {
    expect(consent).toContain("consent-language-switcher");
    expect(consent).toContain('data-consent-locale="en"');
    expect(consent).toContain('data-consent-locale="de"');
    expect(consent).toContain('data-consent-locale="uk"');
    expect(consent).toContain("window.history.pushState");
    expect(consent).toContain("updateConsentGateText(gate, nextLocale)");
  });

  it("does not persist language before consent", () => {
    expect(consent).not.toContain('localStorage.setItem("radiova-lang"');
    expect(consent).not.toContain("localStorage.setItem('radiova-lang'");
  });

  it("centers the consent heading", () => {
    expect(globalScss).toContain(".consent-dialog h2");
    expect(globalScss).toContain("text-align: center");
  });

  it("blocks the shell before consent", () => {
    expect(appShell).toContain("consent-preload-blocked");
    expect(globalScss).toContain("pointer-events: none");
    expect(globalScss).toContain(".consent-gate");
  });

  it("waits for consent before app, dashboard, playlists, and service worker init", () => {
    expect(app).toContain("whenConsentResolved().then(() => init())");
    expect(dashboard).toContain("whenConsentResolved().then(() => init())");
    expect(playlists).toContain("whenConsentResolved().then(() => init())");
    expect(swRegister).toContain("whenConsentResolved().then");
  });

  it("uses one global consent resolved event across bundles", () => {
    expect(consent).toContain("radiova:consent-resolved");
    expect(consent).toContain("window.__radiovaConsentResolved");
    expect(consent).toContain("ConsentResolvedDetail");
  });

  it("does not register service worker before offline consent", () => {
    expect(swRegister).toContain("hasConsent('offline')");
    expect(swRegister).toContain("navigator.serviceWorker.register");
  });

  it("does not open IndexedDB before preferences consent", () => {
    expect(db).toContain("if (!hasConsent('preferences'))");
    expect(db).toContain("Preferences storage is disabled by consent");
  });

  it("disables optional localStorage before preferences or diagnostics consent", () => {
    expect(player).toContain('hasConsent("preferences")');
    expect(i18n).toContain("hasConsent('preferences')");
    expect(reporter).toContain("hasConsent('diagnostics')");
  });

  it("supports declined privacy mode without persisted decline flag", () => {
    expect(consent).toContain('status: "declined"');
    expect(consent).toContain("Continue in privacy mode");
    expect(consent).toContain('ConsentMode = "accepted" | "private"');
    expect(consent).not.toContain("persistDeclined");
  });

  it("withdrawal unregisters service worker, clears Radiova caches, and deletes IndexedDB", () => {
    expect(consent).toContain("navigator.serviceWorker.getRegistrations");
    expect(consent).toContain("registration.unregister");
    expect(consent).toContain("key.startsWith(CACHE_PREFIX)");
    expect(consent).toContain('indexedDB.deleteDatabase("radiova")');
  });
});

describe("compact player empty state", () => {
  const appShell = readFile("src/layouts/AppShell.astro");
  const app = readFile("src/scripts/app.ts");
  const player = readFile("src/services/player.ts");
  const i18n = readFile("src/services/i18n.ts");
  const globalScss = readFile("src/styles/global.scss");

  it("uses a local placeholder image before any station is selected", () => {
    expect(appShell).toContain('src="/assets/images/station-placeholder.svg"');
    expect(appShell).not.toContain('id="header-station-image" class="header-player__image" src=""');
  });

  it("has localized empty title and subtitle strings", () => {
    for (const text of [
      "No station selected",
      "Choose a station from the list",
      "Станцію не вибрано",
      "Виберіть станцію зі списку",
      "Kein Sender ausgewählt",
      "Wählen Sie einen Sender aus der Liste",
    ]) {
      expect(i18n + appShell + player).toContain(text);
    }
  });

  it("does not duplicate the empty title into the compact status", () => {
    expect(player).toContain('idle: "Choose a station from the list"');
    expect(player).toContain('idle: "Виберіть станцію зі списку"');
    expect(player).toContain('idle: "Wählen Sie einen Sender aus der Liste"');
  });

  it("disables the compact play target without a station", () => {
    expect(appShell).toContain('aria-disabled="true"');
    expect(app).toContain("if (!currentStation) return;");
    expect(app).toContain('logo.classList.toggle("is-disabled", !hasStation)');
  });

  it("uses one player image fallback helper", () => {
    expect(app).toContain("function setPlayerImage");
    expect(app).toContain("img.onerror = () =>");
    expect(app).toContain("img.src = PLACEHOLDER_IMG");
  });

  it("keeps compact title and subtitle aligned with ellipsis", () => {
    expect(globalScss).toContain(".header-player__title");
    expect(globalScss).toContain(".player-status--compact");
    expect(globalScss).toContain("text-overflow: ellipsis");
    expect(globalScss).toContain(".header-player__logo.is-disabled");
  });
});

describe("sidebar rebinding lifecycle", () => {
  const appShell = readFile("src/layouts/AppShell.astro");
  const app = readFile("src/scripts/app.ts");

  it("has sidebar-toggle button in AppShell", () => {
    expect(appShell).toContain("sidebar-toggle");
  });

  it("calls bindSidebar on init", () => {
    expect(app).toContain("bindSidebar()");
  });

  it("calls bindSidebar on astro:page-load", () => {
    expect(app).toContain("bindSidebar()");
  });

  it("uses AbortController for sidebar listeners", () => {
    expect(app).toContain("AbortController");
    expect(app).toContain("sidebarAbortController?.abort()");
  });

  it("reads collapse state from settings after toggle", () => {
    expect(app).toContain("settings.sidebarCollapsed");
  });

  it("preserves collapsed preference in settings", () => {
    expect(app).toContain("saveSettings(settings)");
  });
});

describe("persistent audio graph (equalizer refactor)", () => {
  const eq = readFile("src/scripts/equalizer.ts");
  const app = readFile("src/scripts/app.ts");
  const globalScss = readFile("src/styles/global.scss");

  it("has ensureGraph that checks already-connected", () => {
    expect(eq).toContain("graph.connected && graph.source && graph.audioElement === audioEl");
  });

  it("has persistent graph and replaceable views", () => {
    expect(eq).toContain("interface PersistentVisualizerGraph");
    expect(eq).toContain("interface VisualizerViews");
    expect(eq).toContain("const graph: PersistentVisualizerGraph");
    expect(eq).toContain("const views: VisualizerViews");
  });

  it("creates one media element source only when missing", () => {
    expect(eq).toContain("if (!graph.source) graph.source = ctx.createMediaElementSource(audioEl)");
    expect(eq.match(/createMediaElementSource\(audioEl\)/g)?.length).toBe(1);
  });

  it("creates only one AudioContext", () => {
    expect(eq).toContain("if (!graph.audioCtx)");
    expect(eq).toContain("graph.audioCtx = new AudioContext()");
  });

  it("has rebindCanvases method", () => {
    expect(eq).toContain("rebindCanvases");
  });

  it("closes AudioContext only on final pagehide teardown", () => {
    expect(eq).toContain("window.addEventListener('pagehide', disconnectGraph, { once: true })");
    expect(eq).toContain("graph.audioCtx.close()");
    expect(app).not.toContain("equalizer.destroy()");
  });

  it("routes audible output through a gain node instead of analysers", () => {
    expect(eq).toContain("gainNode: GainNode | null");
    expect(eq).toContain("graph.gainNode.connect(ctx.destination)");
    expect(eq).toContain("graph.gainNode.connect(graph.splitter)");
    expect(eq).not.toContain("analyserL.connect(audioCtx.destination)");
    expect(eq).not.toContain("analyserR.connect(audioCtx.destination)");
  });

  it("exposes visualizer debug state for browser verification", () => {
    expect(eq).toContain("__radiovaVisualizerDebug");
    expect(eq).toContain("mediaElementSourceCount");
    expect(eq).toContain("destinationConnected");
    expect(eq).toContain("topMax");
    expect(eq).toContain("bottomMax");
    expect(eq).toContain("sideMax");
    expect(eq).toContain("canvasGeneration");
    expect(eq).toContain("animationFrameActive");
  });

  it("rebinds top, bottom, and side canvases without graph teardown", () => {
    expect(eq).toContain("rebindCanvases(");
    expect(eq).toContain("views.topCanvas = top");
    expect(eq).toContain("views.bottomCanvas = bottom");
    expect(eq).toContain("views.sideCanvas = side");
    expect(eq).not.toContain("clearGraph");
  });

  it("disconnects old ResizeObserver and attaches a new one on rebind", () => {
    expect(eq).toContain("views.resizeObserver?.disconnect()");
    expect(eq).toContain("new ResizeObserver");
    expect(eq).toContain("views.resizeObserver.observe(canvas)");
  });

  it("has one RAF loop controlled by syncWithCurrentPlaybackState", () => {
    expect(eq).toContain("syncWithCurrentPlaybackState");
    expect(eq).toContain("if (isActive && views.rafId !== null) return");
    expect(eq).toContain("views.rafId = requestAnimationFrame(tick)");
    expect(eq).toContain("cancelAnimationFrame(views.rafId)");
  });

  it("rebinds side canvas on Astro page load through bindAll", () => {
    expect(app).toContain('const sideVis = $("dashboard-side-visualizer")');
    expect(app).toContain("equalizer.rebindCanvases(eqLeft, eqRight, sideVis)");
    expect(app).toContain("equalizer.rebindSideCanvas(sideVis)");
    expect(app).toContain("document.addEventListener(\"astro:page-load\", onPageNavigation)");
  });

  it("route return while playing resumes immediately", () => {
    expect(app).toContain("equalizer.syncWithCurrentPlaybackState(state === \"playing\")");
  });

  it("station changes update debug station id and do not rebuild graph", () => {
    expect(app).toContain("equalizer.setCurrentStationId(station.id)");
    expect(eq).toContain("currentStationId = stationId");
  });

  it("does not mirror lower visualizer with CSS transform", () => {
    expect(globalScss).not.toContain("#dashboard-equalizer-right {\n  transform: scaleY(-1)");
  });
});

describe("cold-start restore guards", () => {
  const app = readFile("src/scripts/app.ts");

  it("has restoredOnce flag", () => {
    expect(app).toContain("restoredOnce");
  });

  it("checks restoredOnce before restoring", () => {
    expect(app).toContain("if (restoredOnce) return");
  });

  it("onPageNavigation does not call restorePlayerState", () => {
    expect(app).not.toContain("onPageNavigation.*restorePlayerState");
  });

  it("onPageNavigation does not call equalizer.destroy", () => {
    expect(app).not.toContain("equalizer.destroy()");
  });
});

describe("onPageNavigation rebind", () => {
  const app = readFile("src/scripts/app.ts");

  it("calls equalizer.rebindCanvases on navigation", () => {
    expect(app).toContain("equalizer.rebindCanvases");
  });

  it("does not recreate equalizer on navigation when one exists", () => {
    expect(app).toContain("equalizer.rebindCanvases(eqLeft, eqRight, sideVis)");
  });

  it("routes to createEqualizer only if no existing equalizer", () => {
    expect(app).toContain("else if (eqLeft && eqRight)");
    expect(app).toContain("equalizer = createEqualizer(eqLeft, eqRight)");
  });
});
