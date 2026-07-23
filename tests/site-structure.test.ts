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
    expect(appShell).toContain("labelEn: \"Home\"");
    expect(appShell).toContain("labelUk: \"Головна\"");
    expect(appShell).toContain("labelDe: \"Start\"");
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
    expect(header).not.toContain('header__nav');
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
    expect(equalizer).toContain("source.mediaElement === audioEl");
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
    expect(player).toContain("crossOrigin = 'anonymous'");
  });

  it("exports getAudioElement", () => {
    expect(player).toContain("export function getAudioElement");
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
    for (const page of ["src/pages/playlists.astro", "src/pages/uk/playlists.astro", "src/pages/de/playlists.astro"]) {
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
    for (const page of ["src/pages/privacy.astro", "src/pages/uk/privacy.astro", "src/pages/de/privacy.astro"]) {
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
    for (const page of ["src/pages/downloads.astro", "src/pages/uk/downloads.astro", "src/pages/de/downloads.astro"]) {
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
    const bareSvgWidth = lines.filter((l) => /^\s*svg\s*\{/.test(l) && !l.includes("max") && (l.includes("width") || l.includes("height")));
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
    const ctrlSection = homePage.slice(homePage.indexOf('class="controls"'), homePage.indexOf('</div>', homePage.indexOf('class="controls"')));
    expect(ctrlSection.indexOf("dashboard-play-toggle")).toBeLessThan(ctrlSection.indexOf("dashboard-prev"));
    expect(ctrlSection.indexOf("dashboard-prev")).toBeLessThan(ctrlSection.indexOf("dashboard-next"));
    expect(ctrlSection.indexOf("dashboard-next")).toBeLessThan(ctrlSection.indexOf("dashboard-mute-btn"));
  });
});

describe("dashboard-player only on home pages", () => {
  const homePages = ["src/pages/index.astro", "src/pages/uk/index.astro", "src/pages/de/index.astro"];
  const nonHomePages = [
    "src/pages/downloads.astro", "src/pages/uk/downloads.astro", "src/pages/de/downloads.astro",
    "src/pages/playlists.astro", "src/pages/uk/playlists.astro", "src/pages/de/playlists.astro",
    "src/pages/about.astro", "src/pages/uk/about.astro", "src/pages/de/about.astro",
    "src/pages/help.astro", "src/pages/uk/help.astro", "src/pages/de/help.astro",
    "src/pages/privacy.astro", "src/pages/uk/privacy.astro", "src/pages/de/privacy.astro",
  ];

  for (const page of homePages) {
    it(`${page} contains dashboard-player`, () => {
      expect(readFile(page)).toContain('dashboard-player');
    });
  }

  for (const page of nonHomePages) {
    it(`${page} does not contain dashboard-player`, () => {
      expect(readFile(page)).not.toContain('dashboard-player');
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
    expect(dashboard).toContain('mixed-content blocked');
  });

  it("dashboard.ts uses PLACEHOLDER_IMG fallback", () => {
    expect(dashboard).toContain("PLACEHOLDER_IMG");
    expect(dashboard).toContain("station-placeholder.svg");
  });

  it("app.ts has safeArtworkUrl for player images", () => {
    expect(app).toContain("safeArtworkUrl");
  });

  it("app.ts handles artwork network error with fallback", () => {
    expect(app).toContain("artwork player: network error for");
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
    for (const p of ["dist/uk/index.html", "dist/uk/playlists/index.html", "dist/de/index.html", "dist/index.html"]) {
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
    for (const p of ["dist/uk/index.html", "dist/uk/playlists/index.html", "dist/uk/about/index.html", "dist/de/index.html", "dist/index.html"]) {
      expect(readFile(p)).toContain("id=\"sidebar\"");
    }
  });

  it("all built pages contain menu-icon SVGs", () => {
    for (const p of ["dist/uk/index.html", "dist/uk/playlists/index.html", "dist/de/index.html", "dist/index.html"]) {
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
