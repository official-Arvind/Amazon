const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/frontend/'; // Local server for testing to avoid CORS or rate limits on the deployed site. Adjust if needed.
// Wait, the user specifically deployed it. But we should crawl the local file structure so we can actually fix the errors we find locally before deploying again. Wait, I will use the live site to gather screenshots, or local. Let's use local server.
// Actually, let's just use the GitHub Pages live URL as it's the exact mirror of the local codebase right now since I just pushed.
// Wait, local server doesn't exist, we run it without a server or using Live Server.
// I'll stick to the live URL: 'https://official-arvind.github.io/Amazon/frontend/'

const LIVE_URL = 'https://official-arvind.github.io/Amazon/frontend/';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const SEED_URLS = [
  LIVE_URL,
  LIVE_URL + 'shop/',
  LIVE_URL + 'cart/',
  LIVE_URL + 'checkout/',
  LIVE_URL + 'login/',
  LIVE_URL + 'profile/',
  LIVE_URL + 'product/',
  LIVE_URL + 'wishlist/',
  LIVE_URL + 'deals/',
  LIVE_URL + 'about/',
  LIVE_URL + 'contact/',
  LIVE_URL + 'help/',
  LIVE_URL + 'premium/',
  LIVE_URL + 'seller/',
  LIVE_URL + 'orders/',
  LIVE_URL + 'admin/',
];

async function crawl() {
  console.log('Launching Puppeteer crawler...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  // Login first
  console.log('Authenticating as Admin...');
  await page.goto(LIVE_URL + 'login/', { waitUntil: 'networkidle2' });
  await page.type('#loginEmail', 'admin@zonix.com');
  await page.click('#continueBtn');
  
  // Wait for step 2 to become visible
  await page.waitForSelector('#loginPassword', { visible: true });
  await page.type('#loginPassword', 'Admin@500');
  await page.click('#loginBtn');
  
  // Wait for navigation or toast
  await new Promise(r => setTimeout(r, 3000));
  console.log('Authentication attempt complete. Starting crawl.');

  const visited = new Set();
  const queue = [...SEED_URLS];
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(`[BROWSER ERROR] ${msg.text()} on ${page.url()}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(`[UNCAUGHT EXCEPTION] ${error.message} on ${page.url()}`);
  });

  let counter = 1;

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    
    console.log(`\n[${counter}] Navigating to: ${currentUrl}`);
    visited.add(currentUrl);

    try {
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const urlObj = new URL(currentUrl);
      let pageName = urlObj.pathname.split('/').filter(Boolean).pop() || 'home';
      if (pageName === 'frontend') pageName = 'home';
      
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${pageName}_full.png`), fullPage: true });
      console.log(`📸 Saved screenshot: ${pageName}_full.png`);

      const buttons = await page.$$('button, .btn, [role="button"]');
      console.log(`Found ${buttons.length} interactive elements. Evaluating...`);
      
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        try {
           const isVisible = await btn.isIntersectingViewport();
           if (isVisible) {
             // Just hover to see if any JS errors trigger
             await btn.hover();
             // Optional: click if safe, but clicking might navigate away. 
             // We will just hover and capture any state errors.
           }
        } catch (e) {}
      }

      const hrefs = await page.$$eval('a', anchors => anchors.map(a => a.href));
      for (const href of hrefs) {
        if (href.startsWith(LIVE_URL) && !visited.has(href)) {
          const cleanUrl = href.split('#')[0];
          if (!visited.has(cleanUrl) && !queue.includes(cleanUrl)) {
            queue.push(cleanUrl);
          }
        }
      }

    } catch (err) {
      console.error(`Failed to navigate to ${currentUrl}: ${err.message}`);
    }
    counter++;
  }

  console.log('\n--- CRAWL SUMMARY ---');
  console.log(`Visited ${visited.size} pages.`);
  if (errors.length > 0) {
    console.log(`Found ${errors.length} errors:`);
    errors.forEach(e => console.log(e));
    
    // Save errors to a log file
    fs.writeFileSync(path.join(__dirname, 'crawl_errors.log'), errors.join('\n'));
    console.log(`Errors saved to testing/crawl_errors.log`);
  } else {
    console.log('No console or uncaught errors found! ✅');
  }

  console.log('Crawling finished. Closing browser...');
  await browser.close();
}

crawl().catch(console.error);
