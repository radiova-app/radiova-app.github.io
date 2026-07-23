import { createHash } from "node:crypto";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:4322";
const CATALOG_URL = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="visualizer-test" radio-endpoint-id="visualizer-main" radio-codec="wav" radio-bitrate="128" group-title="global",Visualizer Test Station
${BASE_URL}/visualizer-tone.wav
`;
const sha256 = createHash("sha256").update(m3u).digest("hex");

function wavTone(seconds = 5, sampleRate = 44100) {
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
    const left = Math.round(Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0x2fff);
    const right = Math.round(Math.sin(2 * Math.PI * 880 * (i / sampleRate)) * 0x2fff);
    buffer.writeInt16LE(left, 44 + i * 4);
    buffer.writeInt16LE(right, 46 + i * 4);
  }
  return buffer;
}

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
          stationCount: 1,
          endpointCount: 1,
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

  await page.route(`${BASE_URL}/visualizer-tone.wav`, async (route) => {
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "audio/wav",
      body: wavTone(),
    });
  });
}

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
  await page.goto(`${BASE_URL}/`);
  await page.locator("#consent-accept").click();
  await page.waitForSelector(".station-row");
  await page.locator(".station-row__play").first().click();
  await page.waitForFunction(() => window.__radiovaVisualizerDebug?.destinationConnected === true, null, {
    timeout: 10000,
  });
  await page.waitForFunction(() => {
    const debug = window.__radiovaVisualizerDebug;
    return Boolean(debug && (debug.leftMax > 0 || debug.rightMax > 0));
  }, null, { timeout: 10000 });

  const debug = await page.evaluate(() => window.__radiovaVisualizerDebug);
  check("audio element present", debug.audioElement === true);
  check("audio context is running or suspended", ["running", "suspended"].includes(debug.audioContextState), debug.audioContextState);
  check("one media element source", debug.mediaElementSourceCount === 1, String(debug.mediaElementSourceCount));
  check("gain node present", debug.gainNodePresent === true);
  check("channel splitter present", debug.channelSplitterPresent === true);
  check("left analyser present", debug.leftAnalyserPresent === true);
  check("right analyser present", debug.rightAnalyserPresent === true);
  check("destination connected", debug.destinationConnected === true);
  check("left canvas present", debug.leftCanvas === true, debug.canvasSizes.left || "");
  check("right canvas present", debug.rightCanvas === true, debug.canvasSizes.right || "");
  check("animation loop active", debug.animationLoopCount > 0, String(debug.animationLoopCount));
  check("left analyser has data", debug.leftMax > 0, String(debug.leftMax));
  check("right analyser has data", debug.rightMax > 0, String(debug.rightMax));
  check("CORS mode is anonymous", debug.corsMode === "anonymous", debug.corsMode || "");
  check("visualizer root cause clear", debug.rootCause === null, debug.rootCause || "");
  await page.screenshot({ path: "test-results/verify/visualizer-playing.png", fullPage: true });
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
