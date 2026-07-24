/**
 * Real-browser verification for responsive layout, canonical branding, consent states, and player persistence.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(repositoryRoot, "test-results", "verify");
const baseUrl = "http://127.0.0.1:4322";
const catalogUrl = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const homeRoutes = new Set(["/", "/uk/", "/de/"]);
const routes = [
  "/",
  "/playlists/",
  "/about/",
  "/privacy/",
  "/uk/",
  "/uk/playlists/",
  "/uk/about/",
  "/uk/privacy/",
  "/de/",
  "/de/playlists/",
];
const viewports = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
];
const brandingAssets = [
  "/assets/branding/radiova-logo.png",
  "/assets/branding/radiova-logo-48.png",
  "/assets/branding/radiova-logo-128.png",
  "/icons/favicon-16.png",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
];

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="responsive-test" radio-endpoint-id="responsive-main" radio-codec="wav" radio-bitrate="128" group-title="global",Responsive Test Station
${baseUrl}/responsive-tone.wav
`;
const playlistSha256 = createHash("sha256").update(m3u).digest("hex");

function wavTone(seconds = 2, sampleRate = 44100) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * (index / sampleRate)) * 0x1fff);
    buffer.writeInt16LE(sample, 44 + index * 2);
  }
  return buffer;
}

async function installRoutes(page, counters) {
  await page.route(`${catalogUrl}/generated/playlists-manifest.json`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-01-01T00:00:00.000Z",
        source: "verify-responsive-branding",
        playlists: ["uk", "en", "de", "global", "all"].map((locale) => ({
          path: `playlists/${locale}.m3u`,
          stationCount: 1,
          endpointCount: 1,
          sha256: playlistSha256,
          generatedAt: "2026-01-01T00:00:00.000Z",
          source: "verify-responsive-branding",
        })),
      }),
    });
  });

  for (const locale of ["uk", "en", "de", "global", "all"]) {
    await page.route(`${catalogUrl}/playlists/${locale}.m3u`, async (route) => {
      await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
    });
  }

  await page.route(`${baseUrl}/responsive-tone.wav`, async (route) => {
    counters.streamRequests += 1;
    await route.fulfill({ contentType: "audio/wav", body: wavTone() });
  });
}

async function instrumentConsent(page) {
  await page.addInitScript(() => {
    window.__radiovaProbe = { indexedDbOpen: 0, serviceWorkerRegister: 0 };
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      window.__radiovaProbe.indexedDbOpen += 1;
      return originalOpen(...args);
    };
    if (navigator.serviceWorker) {
      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => {
        window.__radiovaProbe.serviceWorkerRegister += 1;
        return originalRegister(...args);
      };
    }
  });
}

async function installAcceptedConsent(context) {
  await context.addInitScript(() => {
    localStorage.setItem(
      "radiova-consent",
      JSON.stringify({ version: 1, status: "accepted", decidedAt: "2026-01-01T00:00:00.000Z" }),
    );
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Astro preview did not start on port 4322.");
}

function startServer() {
  const astroCli = path.join(repositoryRoot, "node_modules", "astro", "astro.js");
  return spawn(process.execPath, [astroCli, "preview", "--host", "127.0.0.1", "--port", "4322"], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outputDirectory, name), fullPage: true });
}

async function verifyDecodedBranding(page, failures) {
  const results = await page.evaluate(async (assets) => {
    return Promise.all(
      assets.map(async (asset) => {
        const response = await fetch(asset);
        const image = new Image();
        image.src = asset;
        await image.decode();
        return {
          asset,
          status: response.status,
          type: response.headers.get("content-type"),
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
      }),
    );
  }, brandingAssets);

  for (const result of results) {
    if (
      result.status !== 200 ||
      !result.type?.startsWith("image/png") ||
      result.width <= 0 ||
      result.height <= 0
    ) {
      failures.push(`branding decode failed: ${JSON.stringify(result)}`);
    }
  }
}

async function verifyLayout(page, route, width, failures) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  if (homeRoutes.has(route)) await page.waitForSelector(".station-row", { timeout: 10000 });
  await page.waitForTimeout(100);

  const result = await page.evaluate(
    ({ isHome, mobile, compactBelow }) => {
      const sidebar = document.getElementById("sidebar");
      const content = document.getElementById("content");
      const backdrop = document.getElementById("sidebar-backdrop");
      const compact = document.getElementById("header-player");
      const start = document.querySelector(".topbar-start");
      const stations = document.querySelector(".stations-layout");
      const compactStyle = compact ? getComputedStyle(compact) : null;
      const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
      const compactRect = compact?.getBoundingClientRect();
      const startRect = start?.getBoundingClientRect();
      const columns = stations
        ? getComputedStyle(stations).gridTemplateColumns.trim().split(/\s+/)
        : [];
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        compactCount: document.querySelectorAll("#header-player").length,
        audioCount: document.querySelectorAll("#persistent-audio").length,
        compactVisible: compactStyle?.display !== "none",
        compactBelow: Boolean(compactRect && startRect) && compactRect.top >= startRect.bottom - 1,
        sidebarLeft: sidebar?.getBoundingClientRect().left ?? null,
        sidebarPosition: sidebarStyle?.position,
        contentWidth: content?.getBoundingClientRect().width ?? 0,
        stationWidth: stations?.getBoundingClientRect().width ?? null,
        backdropDisplay: backdrop ? getComputedStyle(backdrop).display : null,
        stationColumns: columns.length,
        mobile,
        isHome,
        expectedCompactBelow: compactBelow,
      };
    },
    { isHome: homeRoutes.has(route), mobile: width <= 640, compactBelow: width <= 860 },
  );

  if (result.overflow > 1)
    failures.push(`${width}px ${route}: horizontal overflow ${result.overflow}px`);
  if (result.compactCount !== 1)
    failures.push(`${width}px ${route}: compact player count ${result.compactCount}`);
  if (result.audioCount !== 1)
    failures.push(`${width}px ${route}: persistent audio count ${result.audioCount}`);
  if (result.isHome && result.compactVisible)
    failures.push(`${width}px ${route}: compact player visible on Home`);
  if (!result.isHome && !result.compactVisible)
    failures.push(`${width}px ${route}: compact player hidden`);
  if (!result.isHome && result.compactBelow !== result.expectedCompactBelow) {
    failures.push(`${width}px ${route}: compact placement mismatch`);
  }
  if (
    !result.mobile &&
    (result.sidebarPosition !== "static" || result.sidebarLeft === null || result.sidebarLeft < 0)
  ) {
    failures.push(`${width}px ${route}: desktop sidebar is not in the left grid column`);
  }
  if (result.mobile && result.sidebarPosition !== "fixed") {
    failures.push(`${width}px ${route}: mobile sidebar is not fixed`);
  }
  if (result.backdropDisplay !== "none")
    failures.push(`${width}px ${route}: closed backdrop is visible`);
  if (result.mobile && result.contentWidth > width + 1)
    failures.push(`${width}px ${route}: mobile content reserves extra width`);
  if (result.mobile && result.contentWidth < width - 1)
    failures.push(`${width}px ${route}: mobile content is only ${result.contentWidth}px wide`);
  if (result.mobile && result.stationWidth !== null && result.stationWidth < width - 1) {
    failures.push(`${width}px ${route}: mobile dashboard is only ${result.stationWidth}px wide`);
  }
  if (result.mobile && result.stationColumns > 1)
    failures.push(`${width}px ${route}: mobile dashboard has multiple columns`);
}

async function verifyUnknown(browser, failures) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const counters = { streamRequests: 0 };
  await instrumentConsent(page);
  await installRoutes(page, counters);
  await page.goto(`${baseUrl}/uk/`);
  await page.waitForSelector("#consent-gate");
  await screenshot(page, "unknown-consent-mobile.png");
  await page.locator('[data-consent-locale="de"]').click();
  await page.locator('[data-consent-locale="en"]').click();
  await page.locator('[data-consent-locale="uk"]').click();
  const state = await page.evaluate(() => ({
    blocked: document.body.classList.contains("consent-blocked"),
    rows: document.querySelectorAll(".station-row").length,
    probe: window.__radiovaProbe,
    consent: localStorage.getItem("radiova-consent"),
  }));
  if (
    !state.blocked ||
    state.rows !== 0 ||
    state.probe.indexedDbOpen !== 0 ||
    state.probe.serviceWorkerRegister !== 0
  ) {
    failures.push(`unknown consent state invalid: ${JSON.stringify(state)}`);
  }
  if (state.consent !== null || counters.streamRequests !== 0)
    failures.push("unknown consent wrote storage or loaded stream");
  await context.close();
}

async function verifyAcceptedAndPersistence(browser, failures) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const counters = { streamRequests: 0 };
  await instrumentConsent(page);
  await installRoutes(page, counters);
  await page.goto(`${baseUrl}/`);
  await page.locator("#consent-accept").click();
  await page.waitForSelector(".station-row");
  await page.locator(".station-row__play").first().click();
  await page.waitForFunction(() => {
    const audio = document.getElementById("persistent-audio");
    return audio instanceof HTMLAudioElement && !audio.paused;
  });
  await page.evaluate(() => {
    window.__radiovaAudioReference = document.getElementById("persistent-audio");
  });
  await screenshot(page, "accepted-home-mobile.png");

  await page.locator("#sidebar-toggle").click();
  const openState = await page.evaluate(() => ({
    backdrop: getComputedStyle(document.getElementById("sidebar-backdrop")).display,
    locked: document.body.classList.contains("sidebar-open-mobile"),
  }));
  if (openState.backdrop === "none" || !openState.locked)
    failures.push("mobile drawer did not show backdrop or lock body");
  await page.locator('[data-sidebar-route="/playlists"]').click();
  await page.waitForSelector("#playlists-page");
  const persistence = await page.evaluate(() => {
    const audio = document.getElementById("persistent-audio");
    return {
      sameAudio: audio === window.__radiovaAudioReference,
      playing: audio instanceof HTMLAudioElement && !audio.paused,
      unlocked: !document.body.classList.contains("sidebar-open-mobile"),
      compactVisible: getComputedStyle(document.getElementById("header-player")).display !== "none",
    };
  });
  if (
    !persistence.sameAudio ||
    !persistence.playing ||
    !persistence.unlocked ||
    !persistence.compactVisible
  ) {
    failures.push(`accepted navigation persistence failed: ${JSON.stringify(persistence)}`);
  }
  await screenshot(page, "accepted-playlists-mobile.png");

  await page.goto(`${baseUrl}/about/`);
  await screenshot(page, "accepted-about-mobile.png");
  await page.goto(`${baseUrl}/privacy/`);
  await screenshot(page, "accepted-privacy-mobile.png");
  const acceptedState = await page.evaluate(() => ({
    consent: localStorage.getItem("radiova-consent"),
    indexedDbOpen: window.__radiovaProbe.indexedDbOpen,
  }));
  if (!acceptedState.consent?.includes('"status":"accepted"') || acceptedState.indexedDbOpen === 0) {
    failures.push(`accepted persistence state invalid: ${JSON.stringify(acceptedState)}`);
  }
  if (counters.streamRequests === 0)
    failures.push("accepted mode did not request the audio fixture");
  await verifyDecodedBranding(page, failures);
  await context.close();
}

async function verifyPrivate(browser, failures) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const counters = { streamRequests: 0 };
  await instrumentConsent(page);
  await installRoutes(page, counters);
  await page.goto(`${baseUrl}/`);
  await page.locator("#consent-continue-private").click();
  await page.waitForSelector(".station-row");
  await page.locator(".station-row__play").first().click();
  await page.waitForFunction(() => {
    const audio = document.getElementById("persistent-audio");
    return audio instanceof HTMLAudioElement && !audio.paused;
  });
  await screenshot(page, "private-home-mobile.png");
  const state = await page.evaluate(() => ({
    privateMode: document.body.classList.contains("privacy-mode"),
    consent: localStorage.getItem("radiova-consent"),
    probe: window.__radiovaProbe,
    rows: document.querySelectorAll(".station-row").length,
  }));
  if (
    !state.privateMode ||
    state.consent !== null ||
    state.probe.indexedDbOpen !== 0 ||
    state.probe.serviceWorkerRegister !== 0 ||
    state.rows === 0 ||
    counters.streamRequests === 0
  ) {
    failures.push(`private consent state invalid: ${JSON.stringify(state)}`);
  }
  await context.close();
}

async function verifyAcceptedServiceWorker(browser, failures) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await installAcceptedConsent(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/about/`);
  try {
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistrations()).length > 0,
      null,
      {
        timeout: 10000,
      },
    );
  } catch {
    failures.push("accepted mode did not register the service worker");
  }
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  });
  await context.close();
}

async function verifyMatrix(browser, failures) {
  let checked = 0;
  for (const [width, height] of viewports) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width, height },
    });
    await installAcceptedConsent(context);
    const page = await context.newPage();
    await installRoutes(page, { streamRequests: 0 });
    for (const route of routes) {
      await verifyLayout(page, route, width, failures);
      checked += 1;
    }

    if (width === 768) {
      await page.goto(`${baseUrl}/`);
      await page.waitForSelector(".station-row");
      await screenshot(page, "accepted-home-tablet.png");
      await page.goto(`${baseUrl}/playlists/`);
      await screenshot(page, "compact-player-below-header.png");
    }
    if (width === 1024) {
      await page.goto(`${baseUrl}/playlists/`);
      await screenshot(page, "compact-player-in-header.png");
    }
    if (width === 1366) {
      await page.goto(`${baseUrl}/playlists/`);
      await screenshot(page, "accepted-playlists-desktop.png");
      await page.goto(`${baseUrl}/`);
      await page.waitForSelector(".station-row");
      await screenshot(page, "accepted-home-desktop.png");
      await screenshot(page, "sidebar-expanded-desktop.png");
      await page.locator("#sidebar-toggle").click();
      await screenshot(page, "sidebar-collapsed-desktop.png");
    }
    await context.close();
  }
  return checked;
}

async function verifyManifestLineage(failures) {
  const source = await readFile(
    path.resolve(
      repositoryRoot,
      "..",
      "radiova-platform-private",
      "packages",
      "branding",
      "originals",
      "active.png",
    ),
  );
  const manifest = JSON.parse(
    await readFile(
      path.join(repositoryRoot, "public", "assets", "branding", "branding-manifest.json"),
      "utf8",
    ),
  );
  const hash = createHash("sha256").update(source).digest("hex");
  if (manifest.sourceSha256 !== hash || manifest.canonicalSourceFilename !== "active.png") {
    failures.push("branding manifest does not match the canonical source hash");
  }
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const server = startServer();
  const failures = [];
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    await verifyManifestLineage(failures);
    await verifyUnknown(browser, failures);
    await verifyAcceptedAndPersistence(browser, failures);
    await verifyPrivate(browser, failures);
    await verifyAcceptedServiceWorker(browser, failures);
    const checked = await verifyMatrix(browser, failures);
    console.log(`Checked ${checked} accepted viewport-route combinations.`);
    console.log(
      `Asset 404/decode failures: ${failures.filter((failure) => failure.includes("branding")).length}`,
    );
  } finally {
    await browser?.close();
    server.kill();
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log("Responsive branding verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
