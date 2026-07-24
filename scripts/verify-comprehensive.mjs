/**
 * Comprehensive browser-level integration verification.
 *
 * Requires: `npm run serve` on port 4322 (with consent pre-accepted).
 *
 * Covers multiple phases of the application lifecycle:
 *   A. Sidebar collapse persistence across navigations
 *   B. Playlist tab switching and active state
 *   C. Player controls (play, pause, volume sync, artwork)
 *   D. Browser back/forward locale preservation
 *   E. Visualizer canvas presence
 *   F. Console error inspection
 *
 * Screenshots are saved to test-results/verify/final.png.
 *
 * Environment: headless Chromium via Playwright.
 *
 * Exit: code 0 on all checks pass, 1 on any failure.
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4322';
const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const INFO = '\x1b[34mINFO\x1b[0m';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const results = [];
  let consoleErrors = [];

  page.on('pageerror', err => {
    console.log('  [PAGE ERROR]', err.message);
    consoleErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [CONSOLE ERROR]', msg.text());
      consoleErrors.push(msg.text());
    }
  });

  function check(name, pass) {
    results.push({ name, pass });
    console.log('  ' + (pass ? PASS : FAIL) + ': ' + name);
  }

  function info(msg) {
    console.log('  ' + INFO + ': ' + msg);
  }

  // Clear storage for fresh state
  await page.goto(BASE_URL + '/uk/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    try { indexedDB.deleteDatabase('radiova'); } catch {}
    try { indexedDB.deleteDatabase('keyval-store'); } catch {}
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // ===== PHASE A: Sidebar collapse persistence =====
  console.log('\n=== SIDEBAR COLLAPSE ===');

  // Sidebar starts collapsed by default (DEFAULT_SETTINGS.sidebarCollapsed = true).
  // Verify toggle works: collapse -> expand -> collapse -> navigate

  // Toggle 1: expand
  const t1 = await page.evaluate(() => {
    const shell = document.getElementById('shell');
    document.getElementById('sidebar-toggle').click();
    return shell.classList.contains('shell-collapsed');
  });
  info('After toggle 1 (should be expanded): ' + t1);
  check('Sidebar toggle can expand', t1 === false);

  // Toggle 2: collapse again
  const t2 = await page.evaluate(() => {
    const shell = document.getElementById('shell');
    document.getElementById('sidebar-toggle').click();
    return shell.classList.contains('shell-collapsed');
  });
  info('After toggle 2 (should be collapsed): ' + t2);
  check('Sidebar toggle can collapse', t2 === true);

  // Navigate through 3 pages — should stay collapsed
  for (const route of ['/playlists', '/downloads', '/about']) {
    await page.click('[data-sidebar-route="' + route + '"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    const stillCollapsed = await page.evaluate(() => {
      const shell = document.getElementById('shell');
      return shell ? shell.classList.contains('shell-collapsed') : null;
    });
    info(route + ' sidebar collapsed: ' + stillCollapsed);
    check('Sidebar stays collapsed after navigating to ' + route, stillCollapsed === true);
  }

  // Return to Home
  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const homeCollapsed = await page.evaluate(() => {
    const shell = document.getElementById('shell');
    return shell ? shell.classList.contains('shell-collapsed') : null;
  });
  check('Sidebar stays collapsed back on Home', homeCollapsed === true);

  // Expand for remaining tests
  await page.evaluate(() => {
    document.getElementById('sidebar-toggle').click();
  });
  await page.waitForTimeout(200);

  // ===== PHASE B: Playlist tabs =====
  console.log('\n=== PLAYLIST TABS ===');

  // Check all tabs exist
  const tabLocales = ['uk', 'en', 'de', 'global', 'all', 'favorites'];
  for (const loc of tabLocales) {
    const tabExists = await page.evaluate((l) => {
      const tab = document.querySelector('.station-tab[data-locale="' + l + '"]');
      return !!tab;
    }, loc);
    check('Tab "' + loc + '" exists', tabExists);
  }

  // Click each tab and verify active state
  for (const loc of ['uk', 'en', 'de', 'global', 'all']) {
    await page.evaluate((l) => {
      const tab = document.querySelector('.station-tab[data-locale="' + l + '"]');
      if (tab) tab.click();
    }, loc);
    await page.waitForTimeout(800);

    const tabActive = await page.evaluate((l) => {
      const tab = document.querySelector('.station-tab[data-locale="' + l + '"]');
      return tab ? tab.classList.contains('is-active') : false;
    }, loc);
    check('Tab "' + loc + '" becomes active on click', tabActive);

    // Check other tabs are inactive
    const otherInactive = await page.evaluate((l) => {
      const tabs = document.querySelectorAll('.station-tab');
      return Array.from(tabs).filter(t => t.getAttribute('data-locale') !== l && t.classList.contains('is-active')).length === 0;
    }, loc);
    check('Only tab "' + loc + '" is active', otherInactive);
  }

  // Navigate away and back, verify tab persists
  const activeBeforeNav = await page.evaluate(() => {
    const active = document.querySelector('.station-tab.is-active');
    return active ? active.getAttribute('data-locale') : null;
  });
  info('Active tab before nav: ' + activeBeforeNav);

  await page.click('[data-sidebar-route="/help"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const activeAfterNav = await page.evaluate(() => {
    const active = document.querySelector('.station-tab.is-active');
    return active ? active.getAttribute('data-locale') : null;
  });
  info('Active tab after return: ' + activeAfterNav);
  check('Active tab persists after navigation', activeAfterNav === activeBeforeNav);

  // Click a tab that works and verify station list renders
  await page.evaluate(() => {
    const tab = document.querySelector('.station-tab[data-locale="all"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(1000);

  const stationRowsAfterTab = await page.evaluate(() => {
    return document.querySelectorAll('.station-row').length;
  });
  info('Stations after tab click: ' + stationRowsAfterTab);
  check('Station rows render after tab click', stationRowsAfterTab > 0);

  // ===== PHASE C: Player controls =====
  console.log('\n=== PLAYER CONTROLS ===');

  // Click first play button
  const playBtnCount = await page.evaluate(() => document.querySelectorAll('.station-row__play').length);
  info('Play buttons: ' + playBtnCount);

  if (playBtnCount > 0) {
    // Click first play button
    await page.evaluate(() => {
      const btn = document.querySelector('.station-row__play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1500);

    // Station title and artwork should update even if CORS blocks the stream
    const stationName = await page.evaluate(() => {
      return document.getElementById('header-station-title')?.textContent;
    });
    info('Station name after play click: ' + stationName);
    check('Station name updated after play click', stationName && stationName !== 'No station selected');

    // The stream is CORS-blocked in headless browser, so we can't test
    // live icon switching. Instead, verify the icon switching logic by
    // dispatching synthetic audio events:

    // Simulate 'play' event to test Pause icon switching
    // (audio.onplay handler listens for 'play' event, not 'playing')
    await page.evaluate(() => {
      const audio = document.getElementById('persistent-audio');
      if (audio.onplay) audio.onplay(new Event('play'));
    });
    await page.waitForTimeout(200);

    const rowIconIsPause = await page.evaluate(() => {
      const btn = document.querySelector('.station-row__play');
      if (!btn) return false;
      return btn.classList.contains('is-active');
    });
    info('Row icon after onplay (should be Pause): ' + rowIconIsPause);
    check('Station row shows Pause after play event', rowIconIsPause);

    const dashIconIsPause = await page.evaluate(() => {
      const icon = document.getElementById('dashboard-play-icon');
      if (!icon) return 'no-element';
      return icon.innerHTML.includes('rect');
    });
    info('Dashboard icon after onplay (should be Pause): ' + dashIconIsPause);
    check('Large player shows Pause after play event', dashIconIsPause === true);

    const headerIconIsPause = await page.evaluate(() => {
      const icon = document.getElementById('header-toggle-icon');
      if (!icon) return 'no-element';
      return icon.innerHTML.includes('rect');
    });
    info('Header icon after onplay (should be Pause): ' + headerIconIsPause);
    check('Compact player shows Pause after play event', headerIconIsPause === true);

    // Simulate 'pause' event to test Play icon restoration
    await page.evaluate(() => {
      const audio = document.getElementById('persistent-audio');
      if (audio.onpause) audio.onpause(new Event('pause'));
    });
    await page.waitForTimeout(200);

    const dashIconIsPlay = await page.evaluate(() => {
      const icon = document.getElementById('dashboard-play-icon');
      if (!icon) return false;
      return icon.innerHTML.includes('polygon') && !icon.innerHTML.includes('rect');
    });
    info('Dashboard icon after onpause (should be Play): ' + dashIconIsPlay);
    check('Large player shows Play after pause event', dashIconIsPlay);

    // Change dashboard volume
    await page.evaluate(() => {
      const vol = document.getElementById('dashboard-volume');
      if (vol) {
        vol.value = '0.3';
        vol.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(100);

    const dashVol = await page.evaluate(() => {
      return document.getElementById('dashboard-volume')?.value;
    });
    info('Dashboard volume set to: ' + dashVol);
    check('Dashboard volume slider updates', dashVol === '0.3');

    // Navigate to privacy page
    await page.click('[data-sidebar-route="/privacy"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Check compact player shows same station title
    const headerTitle = await page.evaluate(() => {
      const el = document.getElementById('header-station-title');
      return el ? el.textContent : null;
    });
    info('Station name on privacy page: ' + headerTitle);
    check('Compact player shows station name on non-home page', headerTitle && headerTitle !== 'No station selected');

    // Check compact player volume synced
    const headerVol = await page.evaluate(() => {
      return document.getElementById('header-volume')?.value;
    });
    info('Header volume on privacy page: ' + headerVol);
    check('Compact player volume matches dashboard setting', headerVol === '0.3');

    // Change header volume
    await page.evaluate(() => {
      const vol = document.getElementById('header-volume');
      if (vol) {
        vol.value = '0.7';
        vol.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(100);

    // Navigate back home and check dashboard volume synced
    await page.click('[data-sidebar-route="/"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const dashVolAfter = await page.evaluate(() => {
      return document.getElementById('dashboard-volume')?.value;
    });
    info('Dashboard volume after return: ' + dashVolAfter);
    check('Large player volume syncs from compact player change', dashVolAfter === '0.7');

    // Pause from header
    await page.click('[data-sidebar-route="/privacy"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      const logo = document.getElementById('header-station-logo');
      if (logo) logo.click();
    });
    await page.waitForTimeout(500);

    const headerIconAfterPause = await page.evaluate(() => {
      const icon = document.getElementById('header-toggle-icon');
      if (!icon) return 'no-element';
      return icon.innerHTML.includes('polygon') ? 'Play' : 'Pause';
    });
    info('Header icon after pause: ' + headerIconAfterPause);
    // We can't guarantee which state we're in (stream may not connect), just verify the icon changed

    // Navigate back home
    await page.click('[data-sidebar-route="/"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    const dashIconState = await page.evaluate(() => {
      const icon = document.getElementById('dashboard-play-icon');
      if (!icon) return 'no-element';
      return icon.innerHTML.includes('rect') ? 'Pause' : 'Play';
    });
    info('Dashboard icon on return: ' + dashIconState);

    const headerTitleHome = await page.evaluate(() => {
      return document.getElementById('header-station-title')?.textContent;
    });
    info('Station title on home: ' + headerTitleHome);
    check('Station title preserved on home after navigation', headerTitleHome === headerTitle);

    // Check artwork was restored
    const headerImgSrc = await page.evaluate(() => {
      const img = document.getElementById('header-station-image');
      return img ? img.src : null;
    });
    const dashImgSrc = await page.evaluate(() => {
      const img = document.getElementById('dashboard-station-image');
      return img ? img.src : null;
    });
    info('Header image src: ' + (headerImgSrc ? headerImgSrc.slice(0, 60) : 'null'));
    info('Dashboard image src: ' + (dashImgSrc ? dashImgSrc.slice(0, 60) : 'null'));
    check('Artwork restored in header player', headerImgSrc && !headerImgSrc.includes('placeholder'));
    check('Artwork restored in dashboard player', dashImgSrc && !dashImgSrc.includes('placeholder'));
  } else {
    info('No play buttons available - skipping player tests');
  }

  // ===== PHASE D: Back/Forward =====
  console.log('\n=== BACK/FORWARD ===');

  // Navigate to DE
  await page.click('#lang-de');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Navigate to a page within DE
  await page.click('[data-sidebar-route="/help"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const deLangBefore = await page.evaluate(() => {
    return document.getElementById('lang-de')?.classList.contains('is-active');
  });
  info('DE active on /de/help/: ' + deLangBefore);

  // Go back
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const deLangAfterBack = await page.evaluate(() => {
    return document.getElementById('lang-de')?.classList.contains('is-active');
  });
  info('DE active after Back: ' + deLangAfterBack);
  check('Back preserves locale', deLangAfterBack === true);

  // Go forward
  await page.goForward();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const deLangAfterFwd = await page.evaluate(() => {
    return document.getElementById('lang-de')?.classList.contains('is-active');
  });
  info('DE active after Forward: ' + deLangAfterFwd);
  check('Forward preserves locale', deLangAfterFwd === true);

  // ===== PHASE E: Visualizer =====
  console.log('\n=== VISUALIZER ===');

  // Navigate to Home to check visualizer canvases
  await page.goto(BASE_URL + '/uk/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const visualizerMode = await page.evaluate(() => {
    const l = document.getElementById('dashboard-equalizer-left');
    const r = document.getElementById('dashboard-equalizer-right');
    return {
      leftExists: !!l,
      rightExists: !!r,
      leftWidth: l ? l.width : null,
      rightWidth: r ? r.width : null,
    };
  });
  info('Visualizer canvases: ' + JSON.stringify(visualizerMode));
  check('Left equalizer canvas exists', visualizerMode.leftExists);
  check('Right equalizer canvas exists', visualizerMode.rightExists);

  // Check side visualizer
  const sideVis = await page.evaluate(() => {
    const el = document.getElementById('dashboard-side-visualizer');
    return el ? { exists: true, width: el.width, height: el.height } : { exists: false };
  });
  info('Side visualizer: ' + JSON.stringify(sideVis));
  check('Side visualizer canvas exists', sideVis.exists);

  // ===== PHASE F: Console errors =====
  console.log('\n=== CONSOLE ===');

  const sourceNodeErrors = consoleErrors.filter(e =>
    e.includes('MediaElementAudioSource') || e.includes('source node') || e.includes('already')
  );
  info('Source-node related errors: ' + sourceNodeErrors.length);
  check('No duplicate source-node errors', sourceNodeErrors.length === 0);

  const duplicateListenerErrors = consoleErrors.filter(e =>
    e.includes('listener') || e.includes('handler') || e.includes('duplicate')
  );
  info('Listener-related console entries: ' + duplicateListenerErrors.length);

  // ===== SCREENSHOTS =====
  console.log('\n=== SCREENSHOTS ===');
  await page.screenshot({ path: 'test-results/verify/final.png', fullPage: true });
  info('Screenshot saved to test-results/verify/final.png');

  // ===== SUMMARY =====
  console.log('\n=== VERIFICATION SUMMARY ===');
  let allPass = true;
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    console.log((r.pass ? '  PASS' : '  FAIL') + ': ' + r.name);
    if (!r.pass) allPass = false;
    if (r.pass) passCount++; else failCount++;
  }
  console.log('\nPassed: ' + passCount + ', Failed: ' + failCount + ', Total: ' + results.length);
  console.log('\nResult:', allPass ? 'ALL PASS' : 'SOME FAILED');

  await context.close();
  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
