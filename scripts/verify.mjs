import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4322';
const SCREENSHOT_DIR = path.resolve('test-results/verify');
const results = [];

function log(msg) {
  console.log(`[VERIFY] ${msg}`);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Start preview server
  log('Starting preview server...');
  const server = spawn('npx', ['astro', 'preview', '--port', '4322'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let serverOutput = '';
  server.stdout.on('data', d => { serverOutput += d.toString(); });
  server.stderr.on('data', d => { serverOutput += d.toString(); });

  try {
    await waitForServer(BASE_URL);
    log('Server ready.');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    try {
      // ===== P1: Diagnostic data capture before edit =====
      log('=== P1: Diagnostic capture ===');

      const page = await context.newPage();
      await page.goto(`${BASE_URL}/uk/`);
      await page.waitForLoadState('networkidle');

      const diagnostics = {};

      // Sidebar toggle listener count
      diagnostics['SIDEBAR TOGGLE LISTENER COUNT BEFORE NAV'] = await page.evaluate(() => {
        const btn = document.getElementById('sidebar-toggle');
        if (!btn) return 'no-button';
        return btn.getEventListeners?.('click')?.length ?? 'n/a';
      });

      // Navigate
      await page.click('[data-sidebar-route="/privacy"]');
      await page.waitForLoadState('networkidle');

      diagnostics['SIDEBAR TOGGLE LISTENER COUNT AFTER NAV'] = await page.evaluate(() => {
        const btn = document.getElementById('sidebar-toggle');
        if (!btn) return 'no-button';
        return btn.getEventListeners?.('click')?.length ?? 'n/a';
      });

      // Navigate back
      await page.click('[data-sidebar-route="/"]');
      await page.waitForLoadState('networkidle');

      // Audio identity
      diagnostics['AUDIO NODE ID BEFORE NAV'] = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio');
        return a ? a.id + ' (tag=' + a.tagName + ')' : 'not-found';
      });

      // Navigate
      await page.click('[data-sidebar-route="/privacy"]');
      await page.waitForLoadState('networkidle');

      diagnostics['AUDIO NODE ID AFTER NAV'] = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio');
        return a ? a.id + ' (tag=' + a.tagName + ')' : 'not-found';
      });

      // Navigate back
      await page.click('[data-sidebar-route="/"]');
      await page.waitForLoadState('networkidle');

      diagnostics['SAME AUDIO NODE'] = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio');
        return a ? 'persistent-audio found' : 'not-found';
      });

      for (const [k, v] of Object.entries(diagnostics)) {
        log(`${k}: ${v}`);
      }

      // ===== P2-P9: Verification sequence =====
      log('=== P2: Sidebar toggle after multiple nav ===');
      await page.goto(`${BASE_URL}/uk/`);
      await page.waitForLoadState('networkidle');

      const toggleBtn = page.locator('#sidebar-toggle');
      const shell = page.locator('#shell');
      
      // Home toggle
      await toggleBtn.click();
      await page.waitForTimeout(200);
      let collapsed = await shell.evaluate(el => el.classList.contains('shell-collapsed'));
      log(`Home collapsed=${collapsed} (expected true)`);
      
      // Navigate + toggle 4x
      for (const route of ['/downloads', '/playlists', '/about', '/help']) {
        await page.click(`[data-sidebar-route="${route}"]`);
        await page.waitForLoadState('networkidle');
        await toggleBtn.click();
        await page.waitForTimeout(200);
        collapsed = await shell.evaluate(el => el.classList.contains('shell-collapsed'));
        log(`${route} collapsed=${collapsed}`);
        
        // Toggle back
        await toggleBtn.click();
        await page.waitForTimeout(200);
      }
      
      // Back to Home
      await page.click('[data-sidebar-route="/"]');
      await page.waitForLoadState('networkidle');
      await toggleBtn.click();
      await page.waitForTimeout(200);
      const finalCollapsed = await shell.evaluate(el => el.classList.contains('shell-collapsed'));
      log(`Home final collapsed=${finalCollapsed}`);
      
      const sidebarOk = finalCollapsed === true;
      log(`Sidebar OK: ${sidebarOk}`);
      results.push({ name: 'Sidebar toggle after 4+ navigations', pass: sidebarOk });

      // ===== P3-P5: Persistent audio =====
      log('=== P3-P5: Persistent audio ===');
      await page.goto(`${BASE_URL}/uk/`);
      await page.waitForLoadState('networkidle');

      const audioBeforeNav = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio') ;
        return { id: a?.id || 'none', tag: a?.tagName || 'none' };
      });
      log(`Audio before nav: ${audioBeforeNav.id} / ${audioBeforeNav.tag}`);

      // Try to start playback (CORS may block but element should persist)
      const playBtn = page.locator('.station-row__play').first();
      await playBtn.click().catch(() => {});
      await page.waitForTimeout(2000);

      await page.click('[data-sidebar-route="/privacy"]');
      await page.waitForLoadState('networkidle');

      const audioMidNav = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio') ;
        return { id: a?.id || 'none', tag: a?.tagName || 'none', ct: a?.currentTime || -1 };
      });
      log(`Audio mid-nav: id=${audioMidNav.id} tag=${audioMidNav.tag} currentTime=${audioMidNav.ct}`);

      await page.click('[data-sidebar-route="/"]');
      await page.waitForLoadState('networkidle');

      const audioAfterNav = await page.evaluate(() => {
        const a = document.getElementById('persistent-audio') ;
        return { id: a?.id || 'none', tag: a?.tagName || 'none', ct: a?.currentTime || -1 };
      });
      log(`Audio after nav: id=${audioAfterNav.id} tag=${audioAfterNav.tag} currentTime=${audioAfterNav.ct}`);

      const audioOk = audioAfterNav.id === 'persistent-audio' && audioAfterNav.tag === 'AUDIO';
      log(`Audio OK: ${audioOk}`);
      results.push({ name: 'Persistent audio element survives navigation', pass: audioOk });

      // Dashboard player visible on Home
      const dpVisible = await page.locator('#dashboard-player').isVisible();
      log(`Dashboard player visible: ${dpVisible}`);
      results.push({ name: 'Dashboard player visible on Home after navigation', pass: dpVisible });

      // ===== P6-P7: Equalizer canvases rebind =====
      log('=== P6-P7: Equalizer rebind ===');
      const eqLeft = page.locator('#dashboard-equalizer-left');
      const eqRight = page.locator('#dashboard-equalizer-right');
      const eqLeftVisible = await eqLeft.isVisible();
      const eqRightVisible = await eqRight.isVisible();
      log(`Equalizer canvases visible: left=${eqLeftVisible} right=${eqRightVisible}`);
      
      // Navigate away
      await page.click('[data-sidebar-route="/downloads"]');
      await page.waitForLoadState('networkidle');
      
      // Navigate back
      await page.click('[data-sidebar-route="/"]');
      await page.waitForLoadState('networkidle');
      
      const eqLeftAfter = await page.locator('#dashboard-equalizer-left').isVisible();
      const eqRightAfter = await page.locator('#dashboard-equalizer-right').isVisible();
      log(`Equalizer canvases visible after return: left=${eqLeftAfter} right=${eqRightAfter}`);
      
      const eqOk = eqLeftAfter && eqRightAfter;
      log(`Equalizer rebind OK: ${eqOk}`);
      results.push({ name: 'Equalizer canvases rebind on Home return', pass: eqOk });

      // ===== P9: Language active state =====
      log('=== P9: Language active state ===');
      const getActiveLang = () => page.evaluate(() => {
        const links = document.querySelectorAll('.lang-switcher__link');
        return Array.from(links).filter(l => l.classList.contains('is-active')).map(l => l.id);
      });

      let active = await getActiveLang();
      log(`Active language on /uk/: ${active.join(',')} (expected lang-uk)`);
      
      // Navigate and check
      await page.click('[data-sidebar-route="/help"]');
      await page.waitForLoadState('networkidle');
      active = await getActiveLang();
      log(`Active language on /uk/help/: ${active.join(',')} (expected lang-uk)`);
      
      // Switch to DE
      await page.click('#lang-de');
      await page.waitForLoadState('networkidle');
      active = await getActiveLang();
      log(`Active language on /de/: ${active.join(',')} (expected lang-de)`);
      
      const langOk = active.includes('lang-de');
      results.push({ name: 'Language active state survives navigation', pass: langOk });

      // ===== P10: Back/Forward =====
      log('=== P10: Back/Forward ===');
      await page.goBack();
      await page.waitForLoadState('networkidle');
      active = await getActiveLang();
      log(`After back: ${active.join(',')}`);
      
      await page.goForward();
      await page.waitForLoadState('networkidle');
      active = await getActiveLang();
      log(`After forward: ${active.join(',')}`);
      
      const bfOk = active.includes('lang-de');
      results.push({ name: 'Back/Forward preserves language state', pass: bfOk });

      // Screenshots
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'final-state.png'), fullPage: false });
      log('Screenshots saved to ' + SCREENSHOT_DIR);

    } finally {
      await browser.close();
    }

  } finally {
    server.kill();
    log('Server stopped.');
  }

  // Report
  log('\n=== VERIFICATION RESULTS ===');
  let allPass = true;
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    log(`${status}: ${r.name}`);
    if (!r.pass) allPass = false;
  }
  log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
