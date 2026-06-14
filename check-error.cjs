const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
