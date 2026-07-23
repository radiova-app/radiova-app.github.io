import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4322';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('Navigating to /uk/...');
  await page.goto(BASE_URL + '/uk/');
  await page.waitForLoadState('networkidle');
  console.log('Page loaded.');

  // Test sidebar toggle
  console.log('\n--- Sidebar toggle ---');
  await page.click('#sidebar-toggle');
  const collapsed = await page.evaluate(() =>
    document.getElementById('shell').classList.contains('shell-collapsed')
  );
  console.log('Home collapsed after toggle:', collapsed);

  // Navigate to Privacy
  console.log('\n--- Navigate to Privacy ---');
  await page.click('[data-sidebar-route="/privacy"]');
  await page.waitForLoadState('networkidle');
  const url1 = page.url();
  console.log('URL:', url1);

  // Toggle sidebar on Privacy
  await page.click('#sidebar-toggle');
  const collapsed2 = await page.evaluate(() =>
    document.getElementById('shell').classList.contains('shell-collapsed')
  );
  console.log('Privacy collapsed after toggle:', collapsed2);

  // Navigate to Downloads
  console.log('\n--- Navigate to Downloads ---');
  await page.click('[data-sidebar-route="/downloads"]');
  await page.waitForLoadState('networkidle');

  // Navigate to About
  console.log('\n--- Navigate to About ---');
  await page.click('[data-sidebar-route="/about"]');
  await page.waitForLoadState('networkidle');

  // Navigate to Help
  console.log('\n--- Navigate to Help ---');
  await page.click('[data-sidebar-route="/help"]');
  await page.waitForLoadState('networkidle');

  // Toggle on Help
  await page.click('#sidebar-toggle');
  const collapsed3 = await page.evaluate(() =>
    document.getElementById('shell').classList.contains('shell-collapsed')
  );
  console.log('Help collapsed after toggle:', collapsed3);
  await page.click('#sidebar-toggle');

  // Back to Home
  console.log('\n--- Navigate back to Home ---');
  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');
  const urlHome = page.url();
  console.log('URL:', urlHome);

  // Toggle sidebar on Home after 4 navigations
  await page.click('#sidebar-toggle');
  const collapsed4 = await page.evaluate(() =>
    document.getElementById('shell').classList.contains('shell-collapsed')
  );
  console.log('Home final collapsed after toggle:', collapsed4);
  const sidebarOk = collapsed4 === true;
  console.log('Sidebar OK:', sidebarOk);

  // Test persistent audio element
  console.log('\n--- Persistent audio ---');
  const audioExists = await page.evaluate(() => {
    const a = document.getElementById('persistent-audio');
    return a ? a.id + ' tag=' + a.tagName : 'not-found';
  });
  console.log('Audio element:', audioExists);

  // Navigate and check audio still exists
  await page.click('[data-sidebar-route="/privacy"]');
  await page.waitForLoadState('networkidle');
  const audioExists2 = await page.evaluate(() => {
    const a = document.getElementById('persistent-audio');
    return a ? a.id + ' tag=' + a.tagName : 'not-found';
  });
  console.log('Audio after navigation:', audioExists2);

  const audioOk = audioExists2 === 'persistent-audio tag=AUDIO';
  console.log('Audio OK:', audioOk);

  // Navigate back and check dashboard player
  await page.click('[data-sidebar-route="/"]');
  await page.waitForLoadState('networkidle');

  const dpVisible = await page.evaluate(() => {
    const dp = document.getElementById('dashboard-player');
    return dp ? !dp.classList.contains('is-route-hidden') : false;
  });
  console.log('Dashboard player visible:', dpVisible);

  // Test equalizer canvases
  console.log('\n--- Equalizer canvases ---');
  const eqLeft = await page.evaluate(() => {
    const el = document.getElementById('dashboard-equalizer-left');
    return el ? 'exists' : 'missing';
  });
  const eqRight = await page.evaluate(() => {
    const el = document.getElementById('dashboard-equalizer-right');
    return el ? 'exists' : 'missing';
  });
  console.log('Equalizer left:', eqLeft, 'right:', eqRight);
  const eqOk = eqLeft === 'exists' && eqRight === 'exists';
  console.log('Equalizer OK:', eqOk);

  // Test language active state
  console.log('\n--- Language active state ---');
  const activeLang = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('Active language on /uk/:', activeLang);
  const langOk = activeLang.includes('lang-uk');
  console.log('Language OK:', langOk);

  // Switch to DE
  await page.click('#lang-de');
  await page.waitForLoadState('networkidle');
  const activeLangDe = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('Active language on /de/:', activeLangDe);
  const langDeOk = activeLangDe.includes('lang-de');
  console.log('Language DE OK:', langDeOk);

  // Back/Forward
  console.log('\n--- Back/Forward ---');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  const activeBack = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('After Back:', activeBack);
  await page.goForward();
  await page.waitForLoadState('networkidle');
  const activeFwd = await page.evaluate(() => {
    const links = document.querySelectorAll('.lang-switcher__link');
    return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
  });
  console.log('After Forward:', activeFwd);

  const bfOk = activeFwd.includes('lang-de');
  console.log('Back/Forward OK:', bfOk);

  // Take screenshot
  await page.screenshot({ path: 'test-results/verify/result.png' });
  console.log('\nScreenshot saved to test-results/verify/result.png');

  // Summary
  console.log('\n=== VERIFICATION SUMMARY ===');
  const checks = [
    ['Sidebar after 4+ navigations', sidebarOk],
    ['Persistent audio survives navigation', audioOk],
    ['Dashboard player visible on Home', dpVisible],
    ['Equalizer canvases rebind on return', eqOk],
    ['Language active state (/uk/)', langOk],
    ['Language active state (/de/)', langDeOk],
    ['Back/Forward preserves language', bfOk],
  ];
  let allPass = true;
  for (const [name, pass] of checks) {
    console.log((pass ? 'PASS' : 'FAIL') + ': ' + name);
    if (!pass) allPass = false;
  }
  console.log('\nOverall:', allPass ? 'ALL PASS' : 'SOME FAILED');

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
