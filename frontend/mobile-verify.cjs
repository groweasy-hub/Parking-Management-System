const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Helper: check body doesn't scroll horizontally.
  async function checkNoHorizontalScroll(name) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`[${name}] horizontal overflow px:`, overflow);
  }

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@parking.local');
  await page.fill('#password', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
  await page.waitForSelector('text=Total Spots', { timeout: 15000 });
  await page.waitForTimeout(400);
  await checkNoHorizontalScroll('dashboard');
  await page.screenshot({ path: '/tmp/theme-screens/verify-dashboard.png', fullPage: true });

  // Open the sidebar drawer via the actual hamburger button.
  await page.click('header button:has(svg.lucide-menu)').catch(async () => {
    await page.click('button >> nth=0');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/theme-screens/verify-drawer.png' });
  await page.click('div[role="none"], .fixed.inset-0').catch(() => {});

  for (const route of ['history', 'allocations', 'users', 'floors', 'gates', 'audit-logs', 'reports', 'settings', 'companies']) {
    await page.goto(`http://localhost:3000/admin/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await checkNoHorizontalScroll(route);
    await page.screenshot({ path: `/tmp/theme-screens/verify-${route}.png`, fullPage: true });
  }

  await page.goto('http://localhost:3000/gate/entry', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await checkNoHorizontalScroll('gate-entry');
  await page.screenshot({ path: '/tmp/theme-screens/verify-gate-entry.png', fullPage: true });

  await page.goto('http://localhost:3000/gate/exit', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await checkNoHorizontalScroll('gate-exit');
  await page.screenshot({ path: '/tmp/theme-screens/verify-gate-exit.png', fullPage: true });

  console.log('Page errors:', pageErrors);
  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED', err);
  process.exit(1);
});
