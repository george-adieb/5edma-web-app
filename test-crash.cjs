const { chromium } = require('playwright');

(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER_ERROR:', err.message));
  
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  console.log("Done checking.");
  await browser.close();
})();
