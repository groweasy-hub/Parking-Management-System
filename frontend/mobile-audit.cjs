const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-login.png' });

  await page.fill('#email', 'admin@parking.local');
  await page.fill('#password', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
  await page.waitForSelector('text=Total Parking Spots', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-dashboard.png', fullPage: true });

  // Open sidebar drawer
  await page.click('button:has(svg)').catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-drawer.png' });
  await page.keyboard.press('Escape').catch(() => {});

  await page.goto('http://localhost:3000/admin/floors', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-floors.png', fullPage: true });

  await page.goto('http://localhost:3000/admin/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-history.png', fullPage: true });

  await page.goto('http://localhost:3000/admin/allocations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-allocations.png', fullPage: true });

  await page.goto('http://localhost:3000/gate/entry', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-gate-entry.png', fullPage: true });

  await page.goto('http://localhost:3000/gate/exit', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/theme-screens/mobile-gate-exit.png', fullPage: true });

  console.log('Done');
  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED', err);
  process.exit(1);
});
