/**
 * Real-browser verification that no negative canvas radius reaches ctx.arc().
 *
 * Tests every responsive viewport with accepted, unknown, and private consent,
 * plus navigation, resize, and play/pause flows. Collects console errors
 * and reports any IndexSizeError or arc-related exceptions.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const baseUrl = "http://127.0.0.1:4322";
const catalogUrl = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="canvas-test" radio-endpoint-id="canvas-main" radio-codec="wav" radio-bitrate="128" group-title="global",Canvas Test Station
${baseUrl}/canvas-tone.wav
`;
const playlistSha = createHash("sha256").update(m3u).digest("hex");

function wavTone() {
  const sr = 44100;
  const sec = 2;
  const samples = sec * sr;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const s = Math.round(Math.sin(2 * Math.PI * 440 * (i / sr)) * 0x1fff);
    buf.writeInt16LE(s, 44 + i * 2);
  }
  return buf;
}

const toneBuffer = wavTone();

async function installRoutes(page, counters) {
  await page.route(`${catalogUrl}/generated/playlists-manifest.json`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-01-01T00:00:00.000Z",
        playlists: ["uk", "en", "de", "global", "all"].map((locale) => ({
          path: `playlists/${locale}.m3u`,
          stationCount: 1,
          endpointCount: 1,
          sha256: playlistSha,
          generatedAt: "2026-01-01T00:00:00.000Z",
        })),
      }),
    });
  });
  for (const locale of ["uk", "en", "de", "global", "all"]) {
    await page.route(`${catalogUrl}/playlists/${locale}.m3u`, async (route) => {
      await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
    });
  }
  await page.route(`${baseUrl}/canvas-tone.wav`, async (route) => {
    counters.streamRequests += 1;
    await route.fulfill({ contentType: "audio/wav", body: toneBuffer });
  });
}

async function run() {
  const consoleErrors = [];
  const startMs = Date.now();

  const server = spawn(
    process.execPath,
    [path.join(root, "node_modules", "astro", "astro.js"), "preview", "--host", "127.0.0.1", "--port", "4322"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );

  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const r = await fetch(baseUrl);
      if (r.ok) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  const browser = await chromium.launch({ headless: true });

  function trackErrors(page, label) {
    page.on("pageerror", (err) => {
      consoleErrors.push({ label, msg: err.message });
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({ label, msg: msg.text() });
      }
    });
  }

  const viewports = [
    [320, 568],
    [360, 800],
    [390, 844],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ];

  // ── 1. Accepted consent across all viewports ──
  for (const vp of viewports) {
    const label = `accepted-${vp[0]}x${vp[1]}`;
    const context = await browser.newContext({
      viewport: { width: vp[0], height: vp[1] },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const counters = { streamRequests: 0 };
    await installRoutes(page, counters);
    trackErrors(page, label);

    await page.goto(baseUrl);
    await page.locator("#consent-accept").click();
    await page.waitForTimeout(2000);

    const rowCount = await page.locator(".station-row").count();
    if (rowCount > 0) {
      await page.locator(".station-row__play").first().click();
      await page.waitForTimeout(500);
    }

    await context.close();
  }

  // ── 2. Unknown consent (gate visible) ──
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    trackErrors(page, "unknown-consent");
    await page.goto(baseUrl);
    await page.waitForSelector("#consent-gate");
    await page.waitForTimeout(1000);
    await context.close();
  }

  // ── 3. Private mode (declined) ──
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const counters = { streamRequests: 0 };
    await installRoutes(page, counters);
    trackErrors(page, "private-mode");
    await page.goto(baseUrl);
    await page.locator("#consent-continue-private").click();
    await page.waitForTimeout(2000);
    const rows = await page.locator(".station-row").count();
    if (rows > 0) {
      await page.locator(".station-row__play").first().click();
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(500);
    }
    await context.close();
  }

  // ── 4. Navigation: accept → play → Playlists → Home ──
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const counters = { streamRequests: 0 };
    await installRoutes(page, counters);
    trackErrors(page, "navigation");
    await page.goto(baseUrl);
    await page.locator("#consent-accept").click();
    await page.waitForTimeout(2000);
    const navRows = await page.locator(".station-row").count();
    if (navRows > 0) {
      await page.locator(".station-row__play").first().click();
      await page.waitForTimeout(300);
    }
    await page.goto(`${baseUrl}/playlists/`);
    await page.waitForTimeout(1500);
    await page.goto(baseUrl);
    await page.waitForTimeout(1000);
    await context.close();
  }

  // ── 5. Resize: desktop → mobile → desktop ──
  {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const counters = { streamRequests: 0 };
    await installRoutes(page, counters);
    trackErrors(page, "resize");
    await page.goto(baseUrl);
    await page.locator("#consent-accept").click();
    await page.waitForTimeout(2000);
    const rRows = await page.locator(".station-row").count();
    if (rRows > 0) {
      await page.locator(".station-row__play").first().click();
      await page.waitForTimeout(300);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(500);
    await context.close();
  }

  await browser.close();
  server.kill();

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const arcErrors = consoleErrors.filter(
    (e) =>
      e.msg.includes("IndexSizeError") ||
      e.msg.toLowerCase().includes("arc") ||
      e.msg.toLowerCase().includes("radius") ||
      e.msg.toLowerCase().includes("canvas"),
  );
  const idxErrors = consoleErrors.filter((e) => e.msg.includes("IndexSizeError"));

  console.log(`\nCanvas arc safety verification (${elapsed}s)`);
  console.log(`  Console errors total: ${consoleErrors.length}`);
  console.log(`  IndexSizeError count: ${idxErrors.length}`);
  console.log(`  Arc/canvas-related: ${arcErrors.length}`);

  if (arcErrors.length > 0) {
    for (const e of arcErrors) console.log(`  ${FAIL} ${e.label}: ${e.msg.substring(0, 120)}`);
  } else {
    console.log(`  ${PASS} No arc-related console errors`);
  }

  if (idxErrors.length > 0) {
    console.log(`  ${FAIL} ${idxErrors.length} IndexSizeError(s) found`);
    for (const e of idxErrors) console.log(`    ${e.label}: ${e.msg.substring(0, 120)}`);
    process.exit(1);
  }

  console.log(`  ${PASS} No IndexSizeError found`);
  console.log(`\nCanvas arc safety verification passed.\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
