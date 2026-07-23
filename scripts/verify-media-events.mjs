import { createHash } from "node:crypto";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:4322";
const CATALOG_URL = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="slow-test" radio-endpoint-id="slow-main" radio-codec="wav" radio-bitrate="128" group-title="global",Slow Test Station
${BASE_URL}/test-tone.wav
#EXTINF:-1 tvg-id="broken-test" radio-endpoint-id="broken-one" radio-codec="mp3" radio-bitrate="128" group-title="global",Broken Test Station
${BASE_URL}/broken-one.mp3
#EXTINF:-1 tvg-id="broken-test" radio-endpoint-id="broken-two" radio-codec="mp3" radio-bitrate="128" group-title="global",Broken Test Station
${BASE_URL}/broken-two.mp3
`;

const sha256 = createHash("sha256").update(m3u).digest("hex");

function wavTone(seconds = 5, sampleRate = 44100) {
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

function hasPauseIcon(markup) {
  return markup.includes('x="6"') && markup.includes('x="14"');
}

function hasSpinner(markup) {
  return markup.includes("loading-spinner");
}

function hasWarning(markup) {
  return markup.includes("warning-icon");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const errors = [];
  const results = [];
  let toneRequests = 0;

  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  function check(name, pass, detail = "") {
    results.push({ name, pass, detail });
    console.log(`${pass ? PASS : FAIL}: ${name}${detail ? ` (${detail})` : ""}`);
  }

  await page.route(`${CATALOG_URL}/generated/playlists-manifest.json`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "verify-media-events",
        playlists: [
          {
            path: "playlists/uk.m3u",
            stationCount: 2,
            endpointCount: 3,
            sha256,
            generatedAt: new Date().toISOString(),
            source: "verify-media-events",
          },
          {
            path: "playlists/all.m3u",
            stationCount: 2,
            endpointCount: 3,
            sha256,
            generatedAt: new Date().toISOString(),
            source: "verify-media-events",
          },
        ],
      }),
    });
  });

  await page.route(`${CATALOG_URL}/playlists/uk.m3u`, async (route) => {
    await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
  });

  await page.route(`${CATALOG_URL}/playlists/all.m3u`, async (route) => {
    await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
  });

  await page.route(`${BASE_URL}/test-tone.wav`, async (route) => {
    toneRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 1400));
    await route.fulfill({ contentType: "audio/wav", body: wavTone() });
  });

  await page.route(`${BASE_URL}/broken-one.mp3`, async (route) => {
    await route.abort("failed");
  });

  await page.route(`${BASE_URL}/broken-two.mp3`, async (route) => {
    await route.abort("failed");
  });

  await page.goto(`${BASE_URL}/uk/`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      "radiova-consent",
      JSON.stringify({ version: 1, status: "accepted", decidedAt: new Date().toISOString() }),
    );
    try {
      indexedDB.deleteDatabase("radiova");
    } catch {}
  });
  await page.reload();
  await page.waitForSelector(".station-row");

  const testedStation = await page.locator(".station-row__name").first().textContent();
  const clickStartedAt = Date.now();
  await page.locator(".station-row__play").first().click();
  await page.waitForTimeout(150);

  const rowBefore = await page.locator(".station-row__play").first().innerHTML();
  const largeBefore = await page.locator("#dashboard-play-icon").innerHTML();
  const largeStatusBefore = await page.locator("#dashboard-player-status").textContent();
  await page.screenshot({ path: "test-results/verify/media-before-playing.png", fullPage: true });

  check(
    "row immediately shows Spinner, not Pause",
    hasSpinner(rowBefore) && !hasPauseIcon(rowBefore),
    largeStatusBefore || "",
  );
  check(
    "large player shows Loading",
    hasSpinner(largeBefore) && (largeStatusBefore || "").includes("Завантаження"),
    largeStatusBefore || "",
  );

  await page.waitForFunction(
    () => document.getElementById("dashboard-play-icon")?.innerHTML.includes('x="6"'),
    null,
    { timeout: 10000 },
  );
  const timeToPlaying = Date.now() - clickStartedAt;
  const rowAfter = await page.locator(".station-row__play").first().innerHTML();
  const largeAfter = await page.locator("#dashboard-play-icon").innerHTML();
  const largeStatusAfter = await page.locator("#dashboard-player-status").textContent();
  await page.screenshot({ path: "test-results/verify/media-playing.png", fullPage: true });

  check("row becomes Pause after playing event", hasPauseIcon(rowAfter), `${timeToPlaying}ms`);
  check(
    "large player becomes Pause after playing event",
    hasPauseIcon(largeAfter),
    largeStatusAfter || "",
  );

  await page.click('[data-sidebar-route="/privacy"]');
  await page.waitForLoadState("networkidle");
  const compactIcon = await page.locator("#header-toggle-icon").innerHTML();
  const compactStatus = await page.locator("#header-player-status").textContent();
  check(
    "compact player shows Pause after navigation",
    hasPauseIcon(compactIcon),
    compactStatus || "",
  );

  await page.locator("#header-station-logo").click();
  await page.waitForFunction(
    () => document.getElementById("header-toggle-icon")?.innerHTML.includes('points="5 3 19 12'),
    null,
    { timeout: 5000 },
  );
  const compactPaused = await page.locator("#header-toggle-icon").innerHTML();
  await page.screenshot({ path: "test-results/verify/media-compact-paused.png", fullPage: true });
  check("pause event returns compact player to Play", compactPaused.includes('points="5 3 19 12'));

  await page.goto(`${BASE_URL}/uk/`);
  await page.waitForSelector(".station-row");
  await page.locator(".station-row__play").nth(1).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".station-row__play")[1]?.innerHTML.includes("warning-icon"),
    null,
    { timeout: 10000 },
  );
  const failedRow = await page.locator(".station-row__play").nth(1).innerHTML();
  const failedStatus = await page.locator("#dashboard-player-status").textContent();
  const activeRowBorder = await page
    .locator(".station-row")
    .nth(1)
    .evaluate((el) => getComputedStyle(el).borderColor);
  const activeButtonColor = await page
    .locator(".station-row__play")
    .nth(1)
    .evaluate((el) => getComputedStyle(el).color);
  await page.screenshot({ path: "test-results/verify/media-failed-endpoint.png", fullPage: true });

  check("failed endpoint ends in Warning", hasWarning(failedRow), failedStatus || "");
  check(
    "active row keeps orange selection style",
    activeRowBorder.includes("249") || activeRowBorder.includes("115"),
  );
  check(
    "active Play/Pause button is not green",
    !activeButtonColor.includes("34, 197, 94"),
    activeButtonColor,
  );
  check("test audio endpoint requested once or more", toneRequests > 0, String(toneRequests));

  const duplicateSourceErrors = errors.filter(
    (entry) => entry.includes("already connected") || entry.includes("MediaElementAudioSource"),
  ).length;
  check(
    "console has no duplicate media source errors",
    duplicateSourceErrors === 0,
    String(duplicateSourceErrors),
  );

  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`TESTED_STATION=${testedStation || ""}`);
  console.log(`TIME_TO_PLAYING_MS=${timeToPlaying}`);
  console.log(`FAILED_ENDPOINT_STATUS=${failedStatus || ""}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
