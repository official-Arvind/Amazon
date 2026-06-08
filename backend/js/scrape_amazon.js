/**
 * ZONIX Amazon Scraper — Puppeteer Stealth Edition
 * Uses a real headless Chrome browser to bypass Amazon's bot detection.
 * Automatically skips ASINs already in Firestore.
 * Enriches each product with: multi-images, bullets, specs, real ratings.
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import * as cheerio from 'cheerio';
import axios from 'axios';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(AnonymizeUAPlugin({ makeWindows: true }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '..', 'scraped_asins.json');

// Local cache of already-scraped ASINs — avoids ALL Firestore read quota
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) return new Set(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')));
  } catch (e) {}
  return new Set();
}
function saveCache(set) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify([...set], null, 2));
}
const scrapedCache = loadCache();
console.log(`📋 Local cache: ${scrapedCache.size} ASINs already scraped.`);

// =============================================
// CONFIG
// =============================================
const API_KEY    = "AIzaSyDjpgHpiMsO7SP_DtcWbhJ_tMgsDJVSnu4";
const PROJECT_ID = "studio-vih63";

const args = {};
process.argv.slice(2).forEach(val => {
  const parts = val.split('=');
  if (parts.length === 2) args[parts[0].replace('--', '')] = parts[1];
});

const query        = args.query    || 'headphones';
const category     = args.category || 'Audio';
const limit        = parseInt(args.limit)  || 15;
const continuous   = args.continuous === 'true';
const delaySeconds = parseInt(args.delay)  || 30;
let   password     = args.password;

// =============================================
// AUTH PROMPT
// =============================================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
if (!password) {
  rl.question('Enter ZONIX Super Admin (admin@zonix.com) password: ', pwd => {
    password = pwd;
    rl.close();
    main();
  });
} else {
  rl.close();
  main();
}

// =============================================
// FIRESTORE HELPERS
// =============================================

/** Exponential backoff retry wrapper for Firestore WRITE calls */
async function withRetry(fn, retries = 4, baseDelayMs = 2000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = e.response?.status;
      if ((status === 429 || status === 503) && attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`  ⏳ Firestore rate limited (${status}). Retrying in ${Math.round(delay/1000)}s...`);
        await sleep(delay);
      } else {
        throw e;
      }
    }
  }
}

async function firestoreSave(product, token) {
  return withRetry(async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${product.asin}`;
    await axios.patch(url, toFirestorePayload(product), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  });
}

function toFirestorePayload(p) {
  const fields = {
    name:          { stringValue: p.name },
    price:         { doubleValue: parseFloat(p.price) },
    originalPrice: { doubleValue: parseFloat(p.originalPrice || p.price) },
    stock:         { integerValue: 50 },
    image:         { stringValue: p.images?.[0] || p.image || '' },
    images:        { arrayValue: { values: (p.images || []).map(u => ({ stringValue: u })) } },
    description:   { stringValue: p.description || '' },
    category:      { stringValue: p.category },
    rating:        { doubleValue: parseFloat(p.rating || 4.5) },
    reviews:       { integerValue: parseInt(p.reviewCount || 0) },
    source:        { stringValue: 'amazon' },
    scrapedAt:     { stringValue: new Date().toISOString() },
    badge:         { stringValue: (p.originalPrice && p.originalPrice > p.price) ? 'Sale' : '' },
  };
  if (p.asin)   fields.asin   = { stringValue: p.asin };
  if (p.bullets?.length) {
    fields.bullets = { arrayValue: { values: p.bullets.map(b => ({ stringValue: b })) } };
  }
  if (p.specs && Object.keys(p.specs).length) {
    fields.specs = {
      mapValue: {
        fields: Object.fromEntries(Object.entries(p.specs).map(([k, v]) => [k, { stringValue: v }]))
      }
    };
  }
  return { fields };
}

// =============================================
// RANDOM HUMAN DELAY
// =============================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanDelay = (minMs = 1500, maxMs = 4000) =>
  sleep(Math.floor(Math.random() * (maxMs - minMs)) + minMs);

// =============================================
// PAGE HELPERS (Puppeteer)
// =============================================
async function fetchPageHtml(browser, url, waitForSelector = null) {
  const page = await browser.newPage();
  try {
    // Randomize viewport
    await page.setViewport({
      width:  1280 + Math.floor(Math.random() * 200),
      height:  800 + Math.floor(Math.random() * 100)
    });

    // Block unnecessary resources (images, fonts) for speed — we parse HTML
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Human-like: scroll a bit
    await page.evaluate(() => window.scrollBy(0, Math.random() * 400 + 100));
    await humanDelay(800, 1800);

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 8000 }).catch(() => {});
    }

    return await page.content();
  } finally {
    await page.close();
  }
}

// =============================================
// PARSE SEARCH RESULTS PAGE
// =============================================
function parseSearchResults(html, categoryName) {
  const $ = cheerio.load(html);
  const products = [];

  $('div[data-component-type="s-search-result"][data-asin]').each((_, el) => {
    const item  = $(el);
    const asin  = item.attr('data-asin');
    if (!asin || asin.length < 5) return;

    const name = item.find(
      'h2 a span, .a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal'
    ).first().text().trim();
    if (!name || name.length < 3) return;

    const priceRaw   = item.find('.a-price:not(.a-text-price) span.a-offscreen').first().text().replace(/,/g, '');
    const priceMatch = priceRaw.match(/([0-9.]+)/);
    const price      = priceMatch ? parseFloat(priceMatch[1]) : 0;
    if (!price) return;

    const origRaw   = item.find('.a-price.a-text-price span.a-offscreen').first().text().replace(/,/g, '');
    const origMatch = origRaw.match(/([0-9.]+)/);
    const originalPrice = origMatch ? parseFloat(origMatch[1]) : null;

    const ratingText = item.find('span.a-icon-alt').first().text();
    const ratingMatch = ratingText.match(/([0-9.]+)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.5;

    const reviewText = item.find('span.a-size-base.s-underline-text').first().text().replace(/[^0-9]/g, '');
    const reviewCount = reviewText ? parseInt(reviewText) : 0;

    const image = item.find('img.s-image').attr('src') || '';

    products.push({ asin, name, price, originalPrice, rating, reviewCount, image, category: categoryName });
  });

  return products;
}

// =============================================
// PARSE PRODUCT DETAIL PAGE
// =============================================
function parseProductDetailPage(html) {
  const $ = cheerio.load(html);

  // --- All high-res images ---
  const images = [];
  // Method 1: Look for 'colorImages' JSON embedded in scripts
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    const match = text.match(/"hiRes"\s*:\s*"(https:[^"]+)"/g);
    if (match) {
      match.forEach(m => {
        const url = m.replace(/"hiRes"\s*:\s*"/, '').replace(/"$/, '');
        if (url && !images.includes(url)) images.push(url);
      });
    }
  });
  // Method 2: alt image thumbnails → convert to full size
  if (images.length === 0) {
    $('#altImages img, #imageBlock img').each((_, el) => {
      let src = $(el).attr('src') || '';
      src = src.replace(/\._[A-Z0-9_,]+_\./gi, '.').replace(/\._SY\d+_/gi, '');
      if (src && src.startsWith('http') && !images.includes(src) && !src.includes('gif')) {
        images.push(src);
      }
    });
  }
  // Method 3: main image fallback
  if (images.length === 0) {
    const main = $('#landingImage').attr('data-old-hires') || $('#landingImage').attr('src') || '';
    if (main) images.push(main);
  }

  // --- Feature bullets ---
  const bullets = [];
  $('#feature-bullets ul li span.a-list-item').each((_, li) => {
    const t = $(li).text().trim();
    if (t && t.length > 5 && !t.toLowerCase().includes('make sure')) bullets.push(t);
  });

  // --- Full description ---
  let description = '';
  const descText = $('#productDescription p, #productDescription_feature_div p')
    .map((_, el) => $(el).text().trim()).get().join(' ');
  if (descText) description = descText;
  if (!description) {
    description = $('#productDescription, #productDescription_feature_div').text().trim().replace(/\s+/g, ' ');
  }

  // --- Specifications ---
  const specs = {};
  $('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, .prodDetTable tr').each((_, tr) => {
    const key = $(tr).find('th').text().trim();
    const val = $(tr).find('td').text().trim().replace(/\s+/g, ' ');
    if (key && val && !key.includes('Customer') && key.length < 80) specs[key] = val;
  });
  if (Object.keys(specs).length === 0) {
    $('#detailBullets_feature_div ul li').each((_, li) => {
      const raw = $(li).text().replace(/\u200f|\u200e/g, '').trim();
      const colon = raw.indexOf(':');
      if (colon > 0) {
        const k = raw.slice(0, colon).replace(/[^\w\s\-&]/g, '').trim();
        const v = raw.slice(colon + 1).trim();
        if (k && v && k.length < 80) specs[k] = v;
      }
    });
  }

  // --- Rating & Review count ---
  let rating = null;
  const ratingEl = $('span[data-hook="rating-out-of-five"] span.a-icon-alt, #acrPopover span.a-icon-alt');
  if (ratingEl.length) {
    const m = ratingEl.first().text().match(/([0-9.]+)/);
    if (m) rating = parseFloat(m[1]);
  }

  let reviewCount = null;
  const reviewEl = $('span[data-hook="total-review-count"], #acrCustomerReviewText');
  if (reviewEl.length) {
    const m = reviewEl.first().text().replace(/[^0-9]/g, '');
    if (m) reviewCount = parseInt(m);
  }

  // Build combined description string
  let fullDesc = '';
  if (bullets.length) fullDesc += 'Product Features:\n' + bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  if (description)    fullDesc += 'Product Description:\n' + description + '\n\n';
  if (Object.keys(specs).length) {
    fullDesc += 'Specifications:\n' + Object.entries(specs).map(([k, v]) => `• ${k}: ${v}`).join('\n');
  }

  return { images, bullets, specs, rating, reviewCount, description: fullDesc.trim() };
}

// =============================================
// MAIN
// =============================================
async function main() {
  if (!password) { console.error('Password required. Exiting.'); process.exit(1); }

  console.log('🔑 Authenticating...');
  const authRes = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { email: 'admin@zonix.com', password, returnSecureToken: true }
  );
  const token = authRes.data.idToken;
  console.log('✓ Authenticated!');

  console.log('🌐 Launching stealth Chrome browser...');
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
      '--disable-web-security',
    ],
    defaultViewport: null,
  });
  console.log('✓ Browser ready.\n');

  if (continuous) {
    const targetQueries = [
      // Gaming
      { q: 'mechanical keyboard', cat: 'Gaming' },
      { q: 'gaming mouse', cat: 'Gaming' },
      { q: 'gaming headset', cat: 'Gaming' },
      { q: 'gaming chair', cat: 'Gaming' },
      { q: 'mousepad XXL', cat: 'Gaming' },
      { q: 'console controller', cat: 'Gaming' },
      { q: 'VR headset', cat: 'Gaming' },
      { q: 'capture card', cat: 'Gaming' },
      { q: 'graphics card', cat: 'Gaming' },
      { q: 'gaming desk', cat: 'Gaming' },
      { q: 'rgb light strips', cat: 'Gaming' },
      // Electronics
      { q: 'curved monitor', cat: 'Electronics' },
      { q: 'smartphone', cat: 'Electronics' },
      { q: 'tablet', cat: 'Electronics' },
      { q: 'laptop', cat: 'Electronics' },
      { q: 'smartwatch', cat: 'Electronics' },
      { q: 'camera dslr', cat: 'Electronics' },
      { q: '4K TV', cat: 'Electronics' },
      { q: 'power bank', cat: 'Electronics' },
      { q: 'portable SSD', cat: 'Electronics' },
      { q: 'wifi router', cat: 'Electronics' },
      { q: 'drone with camera', cat: 'Electronics' },
      { q: 'usb-c hub', cat: 'Electronics' },
      // Audio
      { q: 'wireless headphones', cat: 'Audio' },
      { q: 'bluetooth speaker', cat: 'Audio' },
      { q: 'soundbar', cat: 'Audio' },
      { q: 'noise cancelling earbuds', cat: 'Audio' },
      { q: 'audio interface', cat: 'Audio' },
      { q: 'podcast microphone', cat: 'Audio' },
      // Fashion
      { q: 'mens running shoes', cat: 'Fashion' },
      { q: 't-shirt pack men', cat: 'Fashion' },
      { q: 'sunglasses men', cat: 'Fashion' },
      { q: 'leather jacket men', cat: 'Fashion' },
      { q: 'chronograph watch', cat: 'Fashion' },
      { q: 'laptop backpack', cat: 'Fashion' },
      { q: 'hoodie men', cat: 'Fashion' },
      // Home & Kitchen
      { q: 'robot vacuum cleaner', cat: 'Home & Kitchen' },
      { q: 'air fryer', cat: 'Home & Kitchen' },
      { q: 'coffee maker', cat: 'Home & Kitchen' },
      { q: 'air purifier', cat: 'Home & Kitchen' },
      { q: 'espresso machine', cat: 'Home & Kitchen' },
      { q: 'stand mixer', cat: 'Home & Kitchen' },
      // Sports
      { q: 'adjustable dumbbells', cat: 'Sports & Outdoors' },
      { q: 'yoga mat', cat: 'Sports & Outdoors' },
      { q: 'treadmill', cat: 'Sports & Outdoors' },
      { q: 'protein powder', cat: 'Sports & Outdoors' },
      { q: 'camping tent', cat: 'Sports & Outdoors' },
      // Health & Beauty
      { q: 'hair dryer', cat: 'Health & Beauty' },
      { q: 'electric shaver', cat: 'Health & Beauty' },
      { q: 'beard grooming kit', cat: 'Health & Beauty' },
      { q: 'massage gun', cat: 'Health & Beauty' },
      { q: 'electric toothbrush', cat: 'Health & Beauty' },
      // Pets
      { q: 'automatic pet feeder', cat: 'Pets' },
      { q: 'orthopedic dog bed', cat: 'Pets' },
      // Automotive
      { q: 'dash cam front rear', cat: 'Automotive' },
      { q: 'portable jump starter', cat: 'Automotive' },
      // Toys
      { q: 'lego technic', cat: 'Toys & Hobbies' },
      { q: 'rc drift car', cat: 'Toys & Hobbies' },
    ];

    let idx = 0;
    while (true) {
      const { q, cat } = targetQueries[idx];
      console.log(`\n🚀 [${idx+1}/${targetQueries.length}] Scraping "${q}" in "${cat}"...`);
      try {
        await scrapeQuery(q, cat, limit, token, browser);
      } catch (e) {
        console.error(`❌ Error scraping "${q}": ${e.message}`);
      }
      idx = (idx + 1) % targetQueries.length;
      if (delaySeconds > 0) {
        console.log(`😴 Waiting ${delaySeconds}s between queries...`);
        await sleep(delaySeconds * 1000);
      }
    }
  } else {
    await scrapeQuery(query, category, limit, token, browser);
    await browser.close();
  }
}

// =============================================
// SCRAPE ONE QUERY
// =============================================
async function scrapeQuery(queryStr, categoryName, limitCount, token, browser) {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(queryStr)}&ref=nb_sb_noss`;
  console.log(`  🔍 Fetching search results...`);

  let searchHtml;
  try {
    searchHtml = await fetchPageHtml(browser, searchUrl, '[data-component-type="s-search-result"]');
  } catch (e) {
    throw new Error(`Failed to load search page: ${e.message}`);
  }

  const rawProducts = parseSearchResults(searchHtml, categoryName);
  console.log(`  ✓ Found ${rawProducts.length} products on search page.`);

  if (rawProducts.length === 0) {
    console.log('  ⚠ No products parsed — possible CAPTCHA or empty results.');
    return;
  }

  // Deduplication using LOCAL CACHE (no Firestore reads needed)
  const newProducts = [];
  for (const p of rawProducts.slice(0, limitCount)) {
    if (scrapedCache.has(p.asin)) {
      process.stdout.write(`  ⏭ Skip (cached): ${p.asin}\n`);
    } else {
      newProducts.push(p);
    }
  }

  if (newProducts.length === 0) {
    console.log('  ✅ All products already in database. Nothing new.');
    return;
  }

  console.log(`  📥 ${newProducts.length} new products to enrich...`);

  let saved = 0;
  for (const p of newProducts) {
    console.log(`\n  🔎 Enriching: ${p.name.substring(0, 50)}...`);
    await humanDelay(2000, 4500); // human-like delay between PDP requests

    let pdpData = { images: [], bullets: [], specs: {}, description: '', rating: null, reviewCount: null };
    try {
      const pdpUrl  = `https://www.amazon.in/dp/${p.asin}`;
      const pdpHtml = await fetchPageHtml(browser, pdpUrl, '#productTitle');
      pdpData = parseProductDetailPage(pdpHtml);
      console.log(`     📷 ${pdpData.images.length} images | 📝 ${pdpData.bullets.length} bullets | 🔧 ${Object.keys(pdpData.specs).length} specs`);
    } catch (e) {
      console.warn(`     ⚠ PDP fetch failed: ${e.message}`);
    }

    const enriched = {
      ...p,
      images:       pdpData.images.length > 0 ? pdpData.images : (p.image ? [p.image] : []),
      bullets:      pdpData.bullets,
      specs:        pdpData.specs,
      description:  pdpData.description || `${p.name}. Product sourced from Amazon.in.`,
      rating:       pdpData.rating    ?? p.rating,
      reviewCount:  pdpData.reviewCount ?? p.reviewCount,
    };

    try {
      await firestoreSave(enriched, token);
      saved++;
      scrapedCache.add(p.asin);
      saveCache(scrapedCache);
      console.log(`     ✓ Saved to Firestore! (cache: ${scrapedCache.size} total)`);
    } catch (e) {
      console.error(`     ✗ Firestore save failed: ${e.response?.data?.error?.message || e.message}`);
    }
  }

  console.log(`\n  🎉 Done! Saved ${saved}/${newProducts.length} new products for "${queryStr}".`);
}
