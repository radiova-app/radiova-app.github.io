import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4322';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.text().includes('radiova:') || msg.text().includes('equalizer')) {
      console.log('  [BROWSER]', msg.text());
    }
  });
  page.on('pageerror', err => console.log('  [PAGE ERROR]', err.message));

  console.log('1. Navigate to /uk/');
  await page.goto(BASE_URL + '/uk/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('   URL:', page.url());

  console.log('2. Check sidebar toggle button exists');
  const toggleCount = await page.evaluate(() => document.querySelectorAll('#sidebar-toggle').length);
  console.log('   toggle button count:', toggleCount);
  const toggleTag = await page.evaluate(() => {
    const t = document.getElementById('sidebar-toggle');
    return t ? t.tagName + ' id=' + t.id : 'null';
  });
  console.log('   toggle:', toggleTag);

  console.log('3. Click sidebar toggle');
  await page.click('#sidebar-toggle');
  await page.waitForTimeout(300);
  const collapsed = await page.evaluate(() => document.getElementById('shell').classList.contains('shell-collapsed'));
  console.log('   collapsed:', collapsed);

  console.log('4. Check sidebar link hrefs');
  const linkHrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-sidebar-route]')).map(a => ({
      href: a.getAttribute('href'),
      route: a.getAttribute('data-sidebar-route'),
      text: a.textContent?.trim().slice(0, 30),
      tag: a.tagName,
    }));
  });
  for (const l of linkHrefs) {
    console.log('   link href=' + l.href + ' route=' + l.route + ' text=' + l.text);
  }

  console.log('5. Click privacy link');
  const privacyLink = page.locator('[data-sidebar-route="/privacy"]');
  console.log('   privacy link count:', await privacyLink.count());
  await privacyLink.click();
  await page.waitForTimeout(1000);
  console.log('   URL after click:', page.url());

  console.log('6. Check if astro:page-load fired');
  const pageLoadFired = await page.evaluate(() => {
    return window.__pageLoadFired ? 'yes' : 'no';
  });
  console.log('   pageLoadFired flag:', pageLoadFired);

  console.log('7. Click sidebar toggle on privacy');
  const toggleExists2 = await page.evaluate(() => !!document.getElementById('sidebar-toggle'));
  console.log('   toggle exists:', toggleExists2);
  const shellClass2 = await page.evaluate(() => document.getElementById('shell')?.className || 'no-shell');
  console.log('   shell class:', shellClass2);

  await page.screenshot({ path: 'test-results/verify/debug.png' });
  console.log('\nScreenshot saved.');

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
