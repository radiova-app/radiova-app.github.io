import { createHash } from "node:crypto";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:4322";
const CATALOG_URL = "https://raw.githubusercontent.com/radiova-app/radiova-stations/master";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";

const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="consent-test" radio-endpoint-id="consent-main" radio-codec="wav" radio-bitrate="128" group-title="global",Consent Test Station
${BASE_URL}/consent-tone.wav
`;
const sha256 = createHash("sha256").update(m3u).digest("hex");

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

async function installRoutes(page, counters) {
  await page.route(`${CATALOG_URL}/generated/playlists-manifest.json`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "verify-consent",
        playlists: ["uk", "en", "de", "global", "all"].map((locale) => ({
          path: `playlists/${locale}.m3u`,
          stationCount: 1,
          endpointCount: 1,
          sha256,
          generatedAt: new Date().toISOString(),
          source: "verify-consent",
        })),
      }),
    });
  });

  for (const locale of ["uk", "en", "de", "global", "all"]) {
    await page.route(`${CATALOG_URL}/playlists/${locale}.m3u`, async (route) => {
      await route.fulfill({ contentType: "audio/x-mpegurl", body: m3u });
    });
  }

  await page.route(`${BASE_URL}/consent-tone.wav`, async (route) => {
    counters.streamRequests += 1;
    await route.fulfill({ contentType: "audio/wav", body: wavTone() });
  });
}

async function instrument(page) {
  await page.addInitScript(() => {
    window.__radiovaConsentProbe = {
      indexedDbOpen: 0,
      serviceWorkerRegister: 0,
      localStorageWrites: [],
    };

    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      window.__radiovaConsentProbe.indexedDbOpen += 1;
      return originalOpen(...args);
    };

    if (navigator.serviceWorker) {
      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => {
        window.__radiovaConsentProbe.serviceWorkerRegister += 1;
        return originalRegister(...args);
      };
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      window.__radiovaConsentProbe.localStorageWrites.push(String(key));
      return originalSetItem.call(this, key, value);
    };
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
  await clearSite(context);

  const results = [];
  const counters = { streamRequests: 0 };

  function check(name, pass, detail = "") {
    results.push({ name, pass, detail });
    console.log(`${pass ? PASS : FAIL}: ${name}${detail ? ` (${detail})` : ""}`);
  }

  let page = await context.newPage();
  await instrument(page);
  await installRoutes(page, counters);
  await page.goto(`${BASE_URL}/uk/`);
  await page.waitForSelector("#consent-gate");
  await page.screenshot({ path: "test-results/verify/consent-uk-unknown.png", fullPage: true });

  check("modal appears before interaction", await page.locator("#consent-gate").isVisible());
  const decisionButtons = await page.locator("#consent-gate .consent-dialog__actions button").allTextContents();
  const headingAlign = await page.locator("#consent-title").evaluate((el) => getComputedStyle(el).textAlign);
  check("modal has exactly two decision buttons", decisionButtons.length === 2, decisionButtons.join(" | "));
  check("separate Decline button is gone", !decisionButtons.some((label) => label.includes("Відхилити")));
  check("Privacy Policy is secondary link", await page.locator("#consent-gate .consent-dialog__privacy-link a").isVisible());
  check("modal heading is centered", headingAlign === "center", headingAlign);
  await page.mouse.click(20, 20);
  check("backdrop click keeps modal open", await page.locator("#consent-gate").isVisible());
  await page.keyboard.press("Escape");
  check("Escape keeps modal open", await page.locator("#consent-gate").isVisible());
  check(
    "focus remains in modal",
    await page.evaluate(() => Boolean(document.activeElement?.closest(".consent-dialog"))),
  );

  await page.locator('[data-consent-locale="de"]').click();
  check("pre-consent language switch updates URL", page.url().endsWith("/de"), page.url());
  check(
    "pre-consent language switch updates modal text",
    (await page.locator("#consent-title").textContent()) === "Einwilligung zur Browserspeicherung",
  );
  check("pre-consent language switch keeps modal open", await page.locator("#consent-gate").isVisible());
  check(
    "pre-consent language switch does not resolve consent",
    await page.evaluate(() => !window.__radiovaConsentResolved && document.body.classList.contains("consent-blocked")),
  );
  await page.locator('[data-consent-locale="uk"]').click();
  check("pre-consent language switch returns to Ukrainian URL", page.url().endsWith("/uk"), page.url());
  check(
    "pre-consent language switch returns Ukrainian text",
    (await page.locator("#consent-title").textContent()) === "Згода на використання сховища браузера",
  );

  await page.locator("#dashboard-play-toggle").click({ force: true });
  await page.waitForTimeout(300);
  const preProbe = await page.evaluate(() => window.__radiovaConsentProbe);
  check("no stream request before consent", counters.streamRequests === 0, String(counters.streamRequests));
  check("IndexedDB not opened before consent", preProbe.indexedDbOpen === 0, String(preProbe.indexedDbOpen));
  check("service worker not registered before consent", preProbe.serviceWorkerRegister === 0, String(preProbe.serviceWorkerRegister));

  await page.locator("#consent-continue-private").click();
  await page.waitForSelector(".station-row");
  const declineProbe = await page.evaluate(() => window.__radiovaConsentProbe);
  const privateCount = await page.locator("#station-count").textContent();
  check("Private mode enters privacy mode", await page.evaluate(() => document.body.classList.contains("privacy-mode")));
  check("Private mode loads station list", (await page.locator(".station-row").count()) > 0, privateCount || "");
  check("no optional IndexedDB after decline", declineProbe.indexedDbOpen === 0, String(declineProbe.indexedDbOpen));
  check(
    "no decline flag stored",
    !(await page.evaluate(() => localStorage.getItem("radiova-consent")?.includes("declined") ?? false)),
  );
  await page.screenshot({ path: "test-results/verify/consent-uk-decline-privacy.png", fullPage: true });

  await page.close();
  await clearSite(context);

  page = await context.newPage();
  await instrument(page);
  await installRoutes(page, counters);
  const streamBeforeAccept = counters.streamRequests;
  await page.goto(`${BASE_URL}/uk/`);
  await page.locator("#consent-accept").click();
  await page.waitForSelector(".station-row");
  const acceptCount = await page.locator("#station-count").textContent();
  check("Accept loads station list without reload", (await page.locator(".station-row").count()) > 0, acceptCount || "");
  await page.locator('.station-tab[data-locale="de"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".station-row").length > 0, null, { timeout: 10000 });
  const tabCount = await page.locator("#station-count").textContent();
  check("playlist tabs work after consent", (tabCount || "").length > 0, tabCount || "");
  await page.locator(".station-row__play").first().click();
  await page.waitForFunction(
    () => document.getElementById("dashboard-play-icon")?.innerHTML.includes('x="6"'),
    null,
    { timeout: 10000 },
  );
  const acceptedRecord = await page.evaluate(() => localStorage.getItem("radiova-consent"));
  check("Accept stores versioned consent", Boolean(acceptedRecord?.includes('"status":"accepted"')));
  check("playback works after accept", counters.streamRequests > streamBeforeAccept, String(counters.streamRequests));

  await page.reload();
  await page.waitForSelector(".station-row");
  check("accepted state persists", (await page.locator("#consent-gate").count()) === 0);

  await page.evaluate(() => {
    localStorage.setItem("radiova-consent", JSON.stringify({ version: 0, status: "accepted", decidedAt: new Date().toISOString() }));
  });
  await page.reload();
  await page.waitForSelector("#consent-gate");
  check("version mismatch reopens modal", await page.locator("#consent-gate").isVisible());

  await page.locator("#consent-accept").click();
  await page.waitForSelector(".station-row");
  await page.locator("#privacy-settings-btn").click();
  await page.waitForSelector("#privacy-settings-dialog");
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.locator("#privacy-withdraw").click();
  await page.waitForSelector("#consent-gate", { timeout: 10000 });
  const cleanup = await page.evaluate(async () => {
    const cachesList = "caches" in window ? await caches.keys() : [];
    const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    return {
      consent: localStorage.getItem("radiova-consent"),
      cachesList,
      registrations: registrations.length,
    };
  });
  check("withdrawal returns to gate", await page.locator("#consent-gate").isVisible());
  check("withdrawal clears consent", cleanup.consent === null);
  check("withdrawal clears Radiova caches", cleanup.cachesList.filter((key) => key.startsWith("radiova-")).length === 0);
  check("withdrawal unregisters service worker", cleanup.registrations === 0, String(cleanup.registrations));
  await page.screenshot({ path: "test-results/verify/consent-withdrawn.png", fullPage: true });
  await page.close();

  for (const [path, screenshot] of [["/", "consent-en-unknown.png"], ["/de/", "consent-de-unknown.png"]]) {
    const localePage = await context.newPage();
    await installRoutes(localePage, counters);
    await localePage.goto(`${BASE_URL}${path}`);
    await localePage.waitForSelector("#consent-gate");
    await localePage.screenshot({ path: `test-results/verify/${screenshot}`, fullPage: true });
    check(`${path} localized modal appears`, await localePage.locator("#consent-gate").isVisible());
    await localePage.close();
  }

  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 760 });
  await installRoutes(mobilePage, counters);
  await mobilePage.goto(`${BASE_URL}/uk/`);
  await mobilePage.waitForSelector("#consent-gate");
  const overflows = await mobilePage.locator(".consent-dialog").evaluate((el) => el.scrollWidth > el.clientWidth);
  check("mobile modal has no horizontal overflow", !overflows);
  await mobilePage.screenshot({ path: "test-results/verify/consent-mobile-uk.png", fullPage: true });
  await mobilePage.close();

  await browser.close();
  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
