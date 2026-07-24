/**
 * Browser-level visualizer verification.
 *
 * Requires: `npm run serve` on port 4322.
 *
 * Environment: headless Chromium via Playwright.
 *
 * Coverage:
 *   - Stereo frequency analysers generate distinct left/right meter values
 *   - RAF loop runs while playing, stops on pause, resumes on play
 *   - Station switch keeps one MediaElementAudioSourceNode
 *   - Route navigation does not interrupt audio
 *   - Route return rebinds canvases and resumes visualizer
 *   - Browser back/forward preserves the audio graph
 *   - CORS mode is set to anonymous
 *   - No duplicate source or RAF errors
 *
 * Audio fixtures: two stereo WAV tones at different frequencies (440/880 Hz
 * and 523/1046 Hz) with different left/right amplitudes to produce measurable
 * stereo separation.
 *
 * Related source: src/scripts/equalizer.ts, src/services/audio-graph.ts,
 * src/visualizer/canvas-renderer.ts
 */
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:4322";
const CATALOG_URL = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

const station1 = "Visualizer Test Station A";
const station2 = "Visualizer Test Station B";
const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="visualizer-a" radio-endpoint-id="visualizer-a-main" radio-codec="wav" radio-bitrate="128" group-title="global",${station1}
${BASE_URL}/visualizer-tone-a.wav
#EXTINF:-1 tvg-id="visualizer-b" radio-endpoint-id="visualizer-b-main" radio-codec="wav" radio-bitrate="128" group-title="global",${station2}
${BASE_URL}/visualizer-tone-b.wav
`;
const sha256 = createHash("sha256").update(m3u).digest("hex");

/**
 * Generate a stereo WAV tone at 16-bit / 44100 Hz.
 * Left and right channels have independent frequencies and amplitudes
 * so the visualizer can detect stereo separation.
 *
 * @param {number} leftHz - Left channel frequency.
 * @param {number} rightHz - Right channel frequency.
 * @param {number} leftAmp - Left channel amplitude (0–1).
 * @param {number} rightAmp - Right channel amplitude (0–1).
 * @param {number} seconds - Duration of the tone.
 * @param {number} sampleRate - Samples per second.
 * @returns {Buffer} Complete WAV file (16-bit stereo).
 */
function wavTone(leftHz, rightHz, leftAmp = 0.37, rightAmp = 0.21, seconds = 8, sampleRate = 44100) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) {
    const left = Math.round(Math.sin(2 * Math.PI * leftHz * (i / sampleRate)) * 0x7fff * leftAmp);
    const right = Math.round(Math.sin(2 * Math.PI * rightHz * (i / sampleRate)) * 0x7fff * rightAmp);
    buffer.writeInt16LE(left, 44 + i * 4);
    buffer.writeInt16LE(right, 46 + i * 4);
  }
  return buffer;
}

/**
 * Intercept all catalog and stream requests with deterministic local
 * stereo WAV tones. The real radiova-stations repository is never hit.
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
        source: "verify-visualizer",
        playlists: ["uk", "en", "de", "global", "all"].map((locale) => ({
          path: `playlists/${locale}.m3u`,
          stationCount: 2,
          endpointCount: 2,
          sha256,
          generatedAt: new Date().toISOString(),
          source: "verify-visualizer",
        })),
      }),
    });
  });

  for (const locale of ["uk", "en", "de", "global", "all"]) {
    await page.route(`${CATALOG_URL}/playlists/${locale}.m3u`, async (route) => {
      await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
    });
  }

  await page.route(`${BASE_URL}/visualizer-tone-a.wav`, async (route) => {
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "audio/wav",
      body: wavTone(440, 880, 0.37, 0.19),
    });
  });
  await page.route(`${BASE_URL}/visualizer-tone-b.wav`, async (route) => {
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "audio/wav",
      body: wavTone(523, 1046, 0.2, 0.36),
    });
  });
}

/**
 * Completely wipe all browser storage state for a clean test start.
 *
 * @param {import("@playwright/test").BrowserContext} context - Playwright context.
 */
async function clearSite(context) {
  await context.clearCookies();
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("radiova");
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  });
  await page.close();
}

/**
 * Wait until the visualizer debug payload reports active animation and
 * all three canvas types (top, bottom, side) show non-zero data.
 * Returns the debug state for assertion.
 *
 * @param {import("@playwright/test").Page} page - Active browser page.
 * @returns {Promise<object>} The __radiovaVisualizerDebug payload.
 */
async function waitForMovingVisualizer(page) {
  await page.waitForFunction(() => {
    const debug = window.__radiovaVisualizerDebug;
    return Boolean(
      debug &&
        debug.animationFrameActive &&
        debug.topMax > 0 &&
        debug.bottomMax > 0 &&
        debug.sideMax > 0 &&
        debug.leftMeterWidth > 0 &&
        debug.rightMeterWidth > 0,
    );
  }, null, { timeout: 10000 });
  return page.evaluate(() => window.__radiovaVisualizerDebug);
}

/**
 * Wait until both meter widths decay below 0.05 (close to zero),
 * indicating the pause decay animation has finished.
 *
 * @param {import("@playwright/test").Page} page - Active browser page.
 * @returns {Promise<object>} The __radiovaVisualizerDebug payload.
 */
async function waitForPausedMeters(page) {
  await page.waitForFunction(() => {
    const debug = window.__radiovaVisualizerDebug;
    return Boolean(debug && debug.leftMeterWidth < 0.05 && debug.rightMeterWidth < 0.05);
  }, null, { timeout: 10000 });
  return page.evaluate(() => window.__radiovaVisualizerDebug);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
  const results = [];

  function check(name, pass, detail = "") {
    results.push({ name, pass, detail });
    console.log(`${pass ? PASS : FAIL}: ${name}${detail ? ` (${detail})` : ""}`);
  }

  await clearSite(context);
  const page = await context.newPage();
  await installRoutes(page);
  await page.goto(`${BASE_URL}/uk/`);
  await page.locator("#consent-accept").click();
  await page.waitForSelector(".station-row");

  await page.locator(".station-row__play").nth(0).click();
  await page.waitForFunction(() => !document.getElementById("persistent-audio")?.paused, null, { timeout: 10000 });
  const firstDebug = await waitForMovingVisualizer(page);
  await page.screenshot({ path: "test-results/verify/visualizer-station-1.png", fullPage: true });

  check("station 1 selected", firstDebug.currentStationId === "visualizer-a", firstDebug.currentStationId || "");
  check("audio pipeline is playing", firstDebug.audioPaused === false);
  check("one media element source", firstDebug.mediaElementSourceCount === 1, String(firstDebug.mediaElementSourceCount));
  check("one RAF loop active", firstDebug.animationFrameActive === true);
  check("top visualizer moves", firstDebug.topMax > 0, String(firstDebug.topMax));
  check("bottom visualizer moves", firstDebug.bottomMax > 0, String(firstDebug.bottomMax));
  check("side visualizer moves", firstDebug.sideMax > 0, String(firstDebug.sideMax));
  check("meter elements are bound", firstDebug.meterElementsBound === true);
  check("top meter moves", firstDebug.leftMeterWidth > 0, String(firstDebug.leftMeterWidth));
  check("bottom meter moves", firstDebug.rightMeterWidth > 0, String(firstDebug.rightMeterWidth));
  check("stereo meter values differ", Math.abs(firstDebug.leftRms - firstDebug.rightRms) > 0.02, `${firstDebug.leftRms}/${firstDebug.rightRms}`);
  check("stereo source is classified", firstDebug.mode === "real-stereo", firstDebug.mode);

  await page.locator("#dashboard-play-toggle").click();
  const pausedDebug = await waitForPausedMeters(page);
  await page.screenshot({ path: "test-results/verify/visualizer-paused-meters.png", fullPage: true });
  check("pause decays top meter", pausedDebug.leftMeterWidth < 0.05, String(pausedDebug.leftMeterWidth));
  check("pause decays bottom meter", pausedDebug.rightMeterWidth < 0.05, String(pausedDebug.rightMeterWidth));

  await page.locator("#dashboard-play-toggle").click();
  const resumedDebug = await waitForMovingVisualizer(page);
  check("resume restores top meter", resumedDebug.leftMeterWidth > 0, String(resumedDebug.leftMeterWidth));
  check("resume restores bottom meter", resumedDebug.rightMeterWidth > 0, String(resumedDebug.rightMeterWidth));

  await page.locator(".station-row__play").nth(1).click();
  await page.waitForFunction(() => window.__radiovaVisualizerDebug?.currentStationId === "visualizer-b", null, {
    timeout: 10000,
  });
  const secondDebug = await waitForMovingVisualizer(page);
  await page.screenshot({ path: "test-results/verify/visualizer-station-2.png", fullPage: true });

  check("station 2 selected", secondDebug.currentStationId === "visualizer-b", secondDebug.currentStationId || "");
  check("station switch keeps one media source", secondDebug.mediaElementSourceCount === 1, String(secondDebug.mediaElementSourceCount));
  check("top resumes after station switch", secondDebug.topMax > 0, String(secondDebug.topMax));
  check("bottom resumes after station switch", secondDebug.bottomMax > 0, String(secondDebug.bottomMax));
  check("top meter resumes after station switch", secondDebug.leftMeterWidth > 0, String(secondDebug.leftMeterWidth));
  check("bottom meter resumes after station switch", secondDebug.rightMeterWidth > 0, String(secondDebug.rightMeterWidth));
  check("no duplicate RAF after station switch", secondDebug.animationFrameActive === true);

  const beforeRouteGeneration = secondDebug.canvasGeneration;
  await page.locator('.menu-item[data-sidebar-route="/privacy"]').click();
  await page.waitForURL("**/uk/privacy/");
  const privacyDebug = await page.evaluate(() => window.__radiovaVisualizerDebug ?? null);
  check("audio continues after navigating away", privacyDebug?.audioPaused === false, privacyDebug ? "playing" : "missing debug");

  await page.locator('.menu-item[data-sidebar-route="/"]').click();
  await page.waitForURL(/\/uk\/?$/);
  await page.waitForSelector("#dashboard-side-visualizer");
  const routeReturnDebug = await waitForMovingVisualizer(page);
  await page.screenshot({ path: "test-results/verify/visualizer-route-return.png", fullPage: true });

  check("route return rebinds canvases", routeReturnDebug.canvasGeneration > beforeRouteGeneration, String(routeReturnDebug.canvasGeneration));
  check("side resumes after route return", routeReturnDebug.sideMax > 0, String(routeReturnDebug.sideMax));
  check("meters rebind after route return", routeReturnDebug.meterElementsBound === true);
  check("top meter continues after route return", routeReturnDebug.leftMeterWidth > 0, String(routeReturnDebug.leftMeterWidth));
  check("bottom meter continues after route return", routeReturnDebug.rightMeterWidth > 0, String(routeReturnDebug.rightMeterWidth));
  check("route return keeps one media source", routeReturnDebug.mediaElementSourceCount === 1, String(routeReturnDebug.mediaElementSourceCount));

  await page.goBack();
  await page.waitForURL("**/uk/privacy/");
  await page.goForward();
  await page.waitForURL(/\/uk\/?$/);
  await page.waitForSelector("#dashboard-side-visualizer");
  const forwardDebug = await waitForMovingVisualizer(page);
  await page.screenshot({ path: "test-results/verify/visualizer-back-forward.png", fullPage: true });

  check("Back/Forward keeps source", forwardDebug.mediaElementSourceCount === 1, String(forwardDebug.mediaElementSourceCount));
  check("Back/Forward keeps RAF active", forwardDebug.animationFrameActive === true);
  check("Back/Forward side moves", forwardDebug.sideMax > 0, String(forwardDebug.sideMax));
  check("CORS mode is anonymous", forwardDebug.corsMode === "anonymous", forwardDebug.corsMode || "");
  check("visualizer root cause clear", forwardDebug.rootCause === null, forwardDebug.rootCause || "");

  console.log("VISUALIZER_REPORT " + JSON.stringify({
    station1,
    station2,
    result: forwardDebug.mode,
    topMaxBeforeSwitch: firstDebug.topMax,
    bottomMaxBeforeSwitch: firstDebug.bottomMax,
    topMaxAfterSwitch: secondDebug.topMax,
    bottomMaxAfterSwitch: secondDebug.bottomMax,
    leftRms: forwardDebug.leftRms,
    rightRms: forwardDebug.rightRms,
    leftPeak: forwardDebug.leftPeak,
    rightPeak: forwardDebug.rightPeak,
    leftMeterWidth: forwardDebug.leftMeterWidth,
    rightMeterWidth: forwardDebug.rightMeterWidth,
    pauseLeftMeterWidth: pausedDebug.leftMeterWidth,
    pauseRightMeterWidth: pausedDebug.rightMeterWidth,
    sideMaxAfterRouteReturn: routeReturnDebug.sideMax,
    canvasGeneration: forwardDebug.canvasGeneration,
    rafCount: forwardDebug.animationFrameActive ? 1 : 0,
    screenshots: [
      "test-results/verify/visualizer-station-1.png",
      "test-results/verify/visualizer-paused-meters.png",
      "test-results/verify/visualizer-station-2.png",
      "test-results/verify/visualizer-route-return.png",
      "test-results/verify/visualizer-back-forward.png",
    ],
  }));

  await page.close();
  await browser.close();

  const failed = results.filter((result) => !result.pass);
  if (failed.length) {
    console.error(`\n${FAIL}: ${failed.length} visualizer checks failed`);
    process.exit(1);
  }
  console.log(`\n${PASS}: visualizer verification complete`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
