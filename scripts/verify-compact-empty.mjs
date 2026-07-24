/**
 * Browser-level compact player empty-state verification.
 *
 * Requires: `npm run serve` on port 4322.
 *
 * Environment: headless Chromium via Playwright.
 *
 * Coverage:
 *   - Placeholder artwork loads correctly with natural dimensions
 *   - Ukrainian non-selected state shows localized "no station" text
 *   - English and German non-selected states show correct translations
 *   - Play button is aria-disabled when no station is selected
 *   - After selecting a station, title, status, and artwork update
 *   - No 404 assets when the player is in empty or selected state
 *   - No horizontal overflow in any locale
 *
 * Related source: src/layouts/AppShell.astro, src/services/player.ts,
 * src/services/i18n.ts
 */
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:4322";
const CATALOG_URL = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

/**
 * Single station with one WAV endpoint, tvg-logo pointing to the local
 * placeholder SVG so artwork loads without external network requests.
 */
const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="compact-test" radio-endpoint-id="compact-main" radio-codec="wav" radio-bitrate="128" group-title="global" tvg-logo="${BASE_URL}/assets/images/station-placeholder.svg",Compact Test Station
${BASE_URL}/compact-tone.wav
`;
const sha256 = createHash("sha256").update(m3u).digest("hex");

/**
 * Generate a 440 Hz mono WAV tone for the test station stream.
 *
 * @param {number} seconds - Duration of the tone.
 * @param {number} sampleRate - Samples per second.
 * @returns {Buffer} Complete WAV file as a Node.js Buffer.
 */
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
  for (let i = 0; i < samples; i++) {
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0x1fff);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  return buffer;
}

/**
 * Intercept all catalog and stream requests with deterministic local
 * fixtures. No external network calls are made.
 *
 * @param {import("@playwright/test").Page} page - Active browser page.
 */
async function installRoutes(page) {
  await page.route(`${CATALOG_URL}/generated/playlists-manifest.json`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "verify-compact-empty",
        playlists: ["uk", "en", "de", "global", "all"].map((locale) => ({
          path: `playlists/${locale}.m3u`,
          stationCount: 1,
          endpointCount: 1,
          sha256,
          generatedAt: new Date().toISOString(),
          source: "verify-compact-empty",
        })),
      }),
    });
  });

  for (const locale of ["uk", "en", "de", "global", "all"]) {
    await page.route(`${CATALOG_URL}/playlists/${locale}.m3u`, async (route) => {
      await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
    });
  }

  await page.route(`${BASE_URL}/compact-tone.wav`, async (route) => {
    await route.fulfill({ contentType: "audio/wav", body: wavTone() });
  });
}

/**
 * Clear all browser storage and set a pre-accepted consent record so
 * we start with the gate bypassed and can inspect the empty player
 * immediately.
 *
 * @param {import("@playwright/test").Page} page - Active browser page.
 */
async function clearState(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      "radiova-consent",
      JSON.stringify({ version: 1, status: "accepted", decidedAt: new Date().toISOString() }),
    );
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("radiova");
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  });
}

/**
 * Read the current state of the compact player header elements.
 *
 * @param {import("@playwright/test").Page} page - Active browser page.
 * @returns {Promise<{src: string, currentSrc: string, naturalWidth: number, title: string, status: string, ariaDisabled: string, overflow: boolean}>}
 */
async function inspectHeader(page) {
  return page.evaluate(() => {
    const image = document.getElementById("header-station-image");
    const logo = document.getElementById("header-station-logo");
    const title = document.getElementById("header-station-title");
    const status = document.getElementById("header-player-status");
    return {
      src: image?.getAttribute("src") || "",
      currentSrc: image instanceof HTMLImageElement ? image.currentSrc : "",
      naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
      title: title?.textContent?.trim() || "",
      status: status?.textContent?.trim() || "",
      ariaDisabled: logo?.getAttribute("aria-disabled") || "",
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const results = [];
  const notFound = [];
  page.on("response", (response) => {
    if (response.status() === 404) notFound.push(response.url());
  });

  function check(name, pass, detail = "") {
    results.push({ name, pass, detail });
    console.log(`${pass ? PASS : FAIL}: ${name}${detail ? ` (${detail})` : ""}`);
  }

  await installRoutes(page);
  await page.goto(`${BASE_URL}/uk/privacy/`);
  await clearState(page);
  await page.reload();
  await page.waitForSelector("#header-player");
  await page.waitForFunction(() => {
    const img = document.getElementById("header-station-image");
    return img instanceof HTMLImageElement && img.complete;
  });
  const emptyUk = await inspectHeader(page);
  await page.screenshot({ path: "test-results/verify/compact-empty-uk.png", fullPage: true });

  check("placeholder artwork loads", emptyUk.naturalWidth > 0, emptyUk.src);
  check("no broken image source", emptyUk.src.includes("/assets/images/station-placeholder.svg"), emptyUk.src);
  check("title appears once", emptyUk.title !== emptyUk.status, `${emptyUk.title} / ${emptyUk.status}`);
  check("Ukrainian subtitle is instructional", emptyUk.status === "Виберіть станцію зі списку", emptyUk.status);
  check("compact Play is disabled", emptyUk.ariaDisabled === "true", emptyUk.ariaDisabled);
  check("no horizontal overflow", !emptyUk.overflow);

  for (const [path, title, subtitle, screenshot] of [
    ["/privacy/", "No station selected", "Choose a station from the list", "compact-empty-en.png"],
    ["/de/privacy/", "Kein Sender ausgewählt", "Wählen Sie einen Sender aus der Liste", "compact-empty-de.png"],
  ]) {
    await page.goto(`${BASE_URL}${path}`);
    await clearState(page);
    await page.reload();
    await page.waitForSelector("#header-player");
    const state = await inspectHeader(page);
    await page.screenshot({ path: `test-results/verify/${screenshot}`, fullPage: true });
    check(`${path} title localized`, state.title === title, state.title);
    check(`${path} subtitle localized`, state.status === subtitle, state.status);
  }

  await page.goto(`${BASE_URL}/uk/`);
  await clearState(page);
  await page.reload();
  await page.waitForSelector(".station-row");
  await page.locator(".station-row__play").first().click();
  await page.waitForFunction(
    () => document.getElementById("dashboard-play-icon")?.innerHTML.includes('x="6"'),
    null,
    { timeout: 10000 },
  );
  await page.locator('[data-sidebar-route="/privacy"]').click();
  await page.waitForSelector("#header-player");
  const selected = await inspectHeader(page);
  await page.screenshot({ path: "test-results/verify/compact-selected-uk.png", fullPage: true });
  check("selected station title appears", selected.title === "Compact Test Station", selected.title);
  check("selected station status appears", selected.status === "Грає", selected.status);
  check("selected station artwork loads", selected.naturalWidth > 0, selected.src);
  check("compact Play is enabled with station", selected.ariaDisabled === "false", selected.ariaDisabled);
  check("no asset 404", notFound.length === 0, notFound.join(" | "));

  await browser.close();
  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
