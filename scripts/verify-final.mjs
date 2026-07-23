import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4322';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('pageerror', err => console.log('  [PAGE ERROR]', err.message));

  // Clear all storage for fresh state
  await page.goto(BASE_URL + '/uk/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Try to delete IndexedDB databases
    try { indexedDB.deleteDatabase('radiova'); } catch {}
    try { indexedDB.deleteDatabase('keyval-store'); } catch {}
  });
  // Full reload to get fresh settings defaults
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const checks = [];

  // ========== SIDEBAR ==========
  console.log('\n=== SIDEBAR ===');
  await page.goto(BASE_URL + '/uk/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const toggleCheck = await page.evaluate(() => {
    const shell = document.getElementById('shell');
    const btn = document.getElementById('sidebar-toggle');
    const before = shell.classList.contains('shell-collapsed');
    btn.click();
    const after = shell.classList.contains('shell-collapsed');
    btn.click();
    const after2 = shell.classList.contains('shell-collapsed');
    return { before, after, after2 };
  });
  console.log('Toggle check:', JSON.stringify(toggleCheck));
  const sidebarWorks = toggleCheck.before !== toggleCheck.after && toggleCheck.after !== toggleCheck.after2;
  console.log('Sidebar works:', sidebarWorks);
  checks.push(['Sidebar toggle on Home', sidebarWorks]);

  // Navigate through 4 pages, toggle on each
  for (const route of ['/playlists', '/downloads', '/about', '/help']) {
    await page.click('[data-sidebar-route="' + route + '"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const toggleOk = await page.evaluate(() => {
      const shell = document.getElementById('shell');
      const btn = document.getElementById('sidebar-toggle');
      if (!shell || !btn) return 'no-elements';
      const before = shell.classList.contains('shell-collapsed');
      btn.click();
      const after = shell.classList.contains('shell-collapsed');
      btn.click();
      return { url: location.href, before, after, toggle: true };
    });
    console.log('  ' + route + ' toggle:', JSON.stringify(toggleOk));
  }

  // Back to Home, toggle again
  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const finalToggle = await page.evaluate(() => {
    const shell = document.getElementById('shell');
    const btn = document.getElementById('sidebar-toggle');
    btn.click();
    return shell.classList.contains('shell-collapsed');
  });
  console.log('Final toggle (should be true):', finalToggle);
  checks.push(['Sidebar after 4+ navigations', finalToggle === true]);

  // ========== PERSISTENT AUDIO ==========
  console.log('\n=== PERSISTENT AUDIO ===');
  const audioExists = await page.evaluate(() => {
    const a = document.getElementById('persistent-audio');
    return a ? a.id + ' tag=' + a.tagName : 'not-found';
  });
  console.log('Audio exists:', audioExists);
  checks.push(['Persistent audio element', audioExists === 'persistent-audio tag=AUDIO']);

  // Click a station play button (if available)
  const playBtn = page.locator('.station-row__play').first();
  const playBtnCount = await playBtn.count();
  console.log('Play buttons found:', playBtnCount);

  await page.click('[data-sidebar-route="/privacy"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const audioAfterNav = await page.evaluate(() => {
    const a = document.getElementById('persistent-audio');
    return a ? a.id + ' tag=' + a.tagName : 'not-found';
  });
  console.log('Audio after navigation:', audioAfterNav);
  checks.push(['Audio survives navigation', audioAfterNav === 'persistent-audio tag=AUDIO']);

  // ========== EQUALIZER ==========
  console.log('\n=== EQUALIZER ===');
  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const eqCheck = await page.evaluate(() => {
    const l = document.getElementById('dashboard-equalizer-left');
    const r = document.getElementById('dashboard-equalizer-right');
    const dp = document.getElementById('dashboard-player');
    return {
      leftExists: !!l,
      rightExists: !!r,
      dpExists: !!dp,
      dpVisible: dp ? !dp.classList.contains('is-route-hidden') : false,
    };
  });
  console.log('Equalizer check:', JSON.stringify(eqCheck));
  checks.push(['Equalizer canvases on Home', eqCheck.leftExists && eqCheck.rightExists]);
  checks.push(['Dashboard player visible on Home', eqCheck.dpVisible === true]);

  // Navigate away and back
  await page.click('[data-sidebar-route="/downloads"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const eqAfterReturn = await page.evaluate(() => {
    const l = document.getElementById('dashboard-equalizer-left');
    const r = document.getElementById('dashboard-equalizer-right');
    return { leftExists: !!l, rightExists: !!r };
  });
  console.log('Equalizer after return:', JSON.stringify(eqAfterReturn));
  checks.push(['Equalizer rebinds on return', eqAfterReturn.leftExists && eqAfterReturn.rightExists]);

  // ========== LANGUAGE ACTIVE STATE ==========
  console.log('\n=== LANGUAGE ===');
  const langUk = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('Active on /uk/:', langUk);
  checks.push(['UK active on /uk/', langUk.includes('lang-uk')]);

  // Navigate to another UK page
  await page.click('[data-sidebar-route="/help"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const langUk2 = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('Active on /uk/help/:', langUk2);
  checks.push(['UK active after navigation', langUk2.includes('lang-uk')]);

  // Switch to DE
  await page.click('#lang-de');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const langDe = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('Active on /de/:', langDe, 'URL:', page.url());
  checks.push(['DE active on /de/', langDe.includes('lang-de')]);

  // Back/Forward
  console.log('\n=== BACK/FORWARD ===');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const langBack = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('After Back (should be UK):', langBack, 'URL:', page.url());

  await page.goForward();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const langFwd = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('After Forward (should be DE):', langFwd, 'URL:', page.url());
  checks.push(['Back/Forward preserves language', langFwd.includes('lang-de')]);

  // Screenshot
  await page.screenshot({ path: 'test-results/verify/final.png' });

  // ========== SUMMARY ==========
  console.log('\n=== VERIFICATION SUMMARY ===');
  let allPass = true;
  for (const [name, pass] of checks) {
    console.log((pass ? '  PASS' : '  FAIL') + ': ' + name);
    if (!pass) allPass = false;
  }
  console.log('\nResult:', allPass ? 'ALL PASS' : 'SOME FAILED');

  await context.close();
  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
