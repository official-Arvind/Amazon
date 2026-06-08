const puppeteer = require('puppeteer');

const BASE_URL = 'https://official-arvind.github.io/Amazon/frontend/';

// Explicitly seed the queue with all known routes (including new ones)
const SEED_URLS = [
  BASE_URL,
  BASE_URL + 'shop/',
  BASE_URL + 'cart/',
  BASE_URL + 'checkout/',
  BASE_URL + 'login/',
  BASE_URL + 'profile/',
  BASE_URL + 'product/',
  BASE_URL + 'wishlist/',
  BASE_URL + 'deals/',
  BASE_URL + 'about/',
  BASE_URL + 'contact/',
  BASE_URL + 'help/',
  BASE_URL + 'admin/',
];

async function crawl() {
  console.log('Launching Puppeteer crawler...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console errors and uncaught exceptions
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[BROWSER ERROR] ${msg.text()} on ${page.url()}`);
    }
  });

  page.on('pageerror', error => {
    console.error(`[UNCAUGHT EXCEPTION] ${error.message} on ${page.url()}`);
  });

  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText || 'Unknown error';
    console.error(`[NETWORK ERROR] ${errorText}: ${request.url()} on ${page.url()}`);
  });

  // Collect links to visit
  const visited = new Set();
  const queue = [...SEED_URLS];

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    
    console.log(`\nNavigating to: ${currentUrl}`);
    visited.add(currentUrl);

    try {
      await page.goto(currentUrl, { waitUntil: 'networkidle2' });
      console.log(`✓ Loaded successfully. Checking buttons...`);

      // Click random buttons to trigger events
      const buttons = await page.$$('button, .btn, [role="button"]');
      console.log(`Found ${buttons.length} interactive elements. Simulating clicks...`);
      for (const btn of buttons) {
        try {
           await btn.click();
           // Short delay to let sync scripts run
           await new Promise(r => setTimeout(r, 100));
        } catch (e) {
           // ignore not-clickable or detached buttons
        }
      }

      // Extract internal links to queue
      const hrefs = await page.$$eval('a', anchors => anchors.map(a => a.href));
      for (const href of hrefs) {
        if (href.startsWith(BASE_URL) && !visited.has(href)) {
          // don't add anchors or fragments
          const cleanUrl = href.split('#')[0];
          if (!visited.has(cleanUrl) && !queue.includes(cleanUrl)) {
            queue.push(cleanUrl);
          }
        }
      }

    } catch (err) {
      console.error(`Failed to navigate to ${currentUrl}: ${err.message}`);
    }
  }

  console.log('\nCrawling finished. Closing browser...');
  await browser.close();
}

crawl().catch(console.error);
