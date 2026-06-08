import axios from 'axios';
import * as cheerio from 'cheerio';
import readline from 'readline';

const API_KEY = "AIzaSyDjpgHpiMsO7SP_DtcWbhJ_tMgsDJVSnu4";
const PROJECT_ID = "studio-vih63";

// Read args
const args = {};
process.argv.slice(2).forEach(val => {
  const parts = val.split('=');
  if (parts.length === 2) {
    args[parts[0].replace('--', '')] = parts[1];
  }
});

const query = args.query || 'headphones';
const category = args.category || 'Audio';
const limit = parseInt(args.limit) || 10;
const continuous = args.continuous === 'true';
const delaySeconds = parseInt(args.delay) || 45;
let password = args.password;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

if (!password) {
  rl.question('Please enter the ZONIX Super Admin (admin@zonix.com) password to authenticate: ', (pwd) => {
    password = pwd;
    rl.close();
    startScrapeProcess();
  });
} else {
  rl.close();
  startScrapeProcess();
}

// =============================================
// FIRESTORE REST API HELPERS
// =============================================

let cachedIdToken = null;

async function checkProductExists(asin, idToken) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${asin}`;
    const res = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    return !!res.data.name; // document exists
  } catch (err) {
    if (err.response?.status === 404) return false;
    throw err;
  }
}

async function startScrapeProcess() {
  if (!password) {
    console.error('Password is required. Exiting.');
    process.exit(1);
  }

  try {
    console.log('🔑 Authenticating as Super Admin...');
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    const authRes = await axios.post(authUrl, {
      email: 'admin@zonix.com',
      password: password,
      returnSecureToken: true
    });
    cachedIdToken = authRes.data.idToken;
    console.log('✓ Authentication successful!');

    if (continuous) {
      console.log('🔄 Continuous scraping mode (skips already-scraped ASINs)...');

      const targetQueries = [
        // Gaming
        { q: 'keyboard', cat: 'Gaming' },
        { q: 'gaming mouse', cat: 'Gaming' },
        { q: 'mechanical keyboard', cat: 'Gaming' },
        { q: 'gaming headset', cat: 'Gaming' },
        { q: 'gaming chair', cat: 'Gaming' },
        { q: 'mousepad XXL', cat: 'Gaming' },
        { q: 'console controller', cat: 'Gaming' },
        { q: 'VR headset', cat: 'Gaming' },
        { q: 'racing wheel', cat: 'Gaming' },
        { q: 'capture card', cat: 'Gaming' },
        { q: 'prebuilt gaming pc', cat: 'Gaming' },
        { q: 'graphics card', cat: 'Gaming' },
        { q: 'gaming desk', cat: 'Gaming' },
        { q: 'flight stick', cat: 'Gaming' },
        { q: 'rgb light strips', cat: 'Gaming' },

        // Electronics
        { q: 'curved monitor', cat: 'Electronics' },
        { q: 'smartphone', cat: 'Electronics' },
        { q: 'tablet', cat: 'Electronics' },
        { q: 'laptop', cat: 'Electronics' },
        { q: 'smartwatch', cat: 'Electronics' },
        { q: 'camera', cat: 'Electronics' },
        { q: '4K TV', cat: 'Electronics' },
        { q: 'home projector', cat: 'Electronics' },
        { q: 'power bank', cat: 'Electronics' },
        { q: 'external hard drive', cat: 'Electronics' },
        { q: 'portable SSD', cat: 'Electronics' },
        { q: 'wifi router', cat: 'Electronics' },
        { q: 'smart display', cat: 'Electronics' },
        { q: 'e-reader', cat: 'Electronics' },
        { q: 'webcam 1080p', cat: 'Electronics' },
        { q: 'drone with camera', cat: 'Electronics' },
        { q: 'usb-c hub', cat: 'Electronics' },
        { q: 'smart thermostat', cat: 'Electronics' },
        { q: 'surge protector', cat: 'Electronics' },

        // Audio
        { q: 'wireless headphones', cat: 'Audio' },
        { q: 'bluetooth speaker', cat: 'Audio' },
        { q: 'soundbar', cat: 'Audio' },
        { q: 'noise cancelling earbuds', cat: 'Audio' },
        { q: 'record player', cat: 'Audio' },
        { q: 'audio interface', cat: 'Audio' },
        { q: 'studio monitors', cat: 'Audio' },
        { q: 'podcast microphone', cat: 'Audio' },
        { q: 'dj controller', cat: 'Audio' },
        { q: 'bookshelf speakers', cat: 'Audio' },
        { q: 'mp3 player', cat: 'Audio' },
        { q: 'headphone amp', cat: 'Audio' },
        { q: 'karaoke machine', cat: 'Audio' },

        // Fashion
        { q: 'mens shoes', cat: 'Fashion' },
        { q: 't-shirt for men', cat: 'Fashion' },
        { q: 'sunglasses', cat: 'Fashion' },
        { q: 'denim jeans', cat: 'Fashion' },
        { q: 'leather jacket', cat: 'Fashion' },
        { q: 'summer dress', cat: 'Fashion' },
        { q: 'white sneakers', cat: 'Fashion' },
        { q: 'chronograph watch', cat: 'Fashion' },
        { q: 'laptop backpack', cat: 'Fashion' },
        { q: 'leather wallet', cat: 'Fashion' },
        { q: 'baseball cap', cat: 'Fashion' },
        { q: 'winter scarf', cat: 'Fashion' },
        { q: 'hiking boots', cat: 'Fashion' },
        { q: 'workout leggings', cat: 'Fashion' },
        { q: 'hoodie', cat: 'Fashion' },
        { q: 'crossbody bag', cat: 'Fashion' },
        { q: 'running shoes', cat: 'Fashion' },
        { q: 'polo shirt', cat: 'Fashion' },

        // Home & Kitchen
        { q: 'vacuum cleaner', cat: 'Home & Kitchen' },
        { q: 'coffee maker', cat: 'Home & Kitchen' },
        { q: 'air fryer', cat: 'Home & Kitchen' },
        { q: 'blender', cat: 'Home & Kitchen' },
        { q: 'microwave oven', cat: 'Home & Kitchen' },
        { q: 'rice cooker', cat: 'Home & Kitchen' },
        { q: 'stand mixer', cat: 'Home & Kitchen' },
        { q: 'robot vacuum', cat: 'Home & Kitchen' },
        { q: 'air purifier', cat: 'Home & Kitchen' },
        { q: 'nonstick cookware set', cat: 'Home & Kitchen' },
        { q: 'memory foam mattress', cat: 'Home & Kitchen' },
        { q: 'espresso machine', cat: 'Home & Kitchen' },

        // Sports & Outdoors
        { q: 'camping tent', cat: 'Sports & Outdoors' },
        { q: 'mountain bike', cat: 'Sports & Outdoors' },
        { q: 'yoga mat', cat: 'Sports & Outdoors' },
        { q: 'adjustable dumbbells', cat: 'Sports & Outdoors' },
        { q: 'treadmill', cat: 'Sports & Outdoors' },
        { q: 'insulated water bottle', cat: 'Sports & Outdoors' },
        { q: 'tennis racket', cat: 'Sports & Outdoors' },
        { q: 'protein powder', cat: 'Sports & Outdoors' },

        // Health & Beauty
        { q: 'hair dryer', cat: 'Health & Beauty' },
        { q: 'electric shaver', cat: 'Health & Beauty' },
        { q: 'makeup brush set', cat: 'Health & Beauty' },
        { q: 'facial moisturizer', cat: 'Health & Beauty' },
        { q: 'curling iron', cat: 'Health & Beauty' },
        { q: 'electric toothbrush', cat: 'Health & Beauty' },
        { q: 'beard grooming kit', cat: 'Health & Beauty' },
        { q: 'massage gun', cat: 'Health & Beauty' },
        { q: 'vitamin c serum', cat: 'Health & Beauty' },

        // Toys & Hobbies
        { q: 'strategy board game', cat: 'Toys & Hobbies' },
        { q: 'lego star wars', cat: 'Toys & Hobbies' },
        { q: 'rc drift car', cat: 'Toys & Hobbies' },
        { q: 'watercolor paint set', cat: 'Toys & Hobbies' },
        { q: 'telescope', cat: 'Toys & Hobbies' },

        // Automotive
        { q: 'dash cam front and rear', cat: 'Automotive' },
        { q: 'portable jump starter', cat: 'Automotive' },
        { q: 'car wash kit', cat: 'Automotive' },
        { q: 'obd2 scanner', cat: 'Automotive' },

        // Pets
        { q: 'grain free dog food', cat: 'Pets' },
        { q: 'orthopedic pet bed', cat: 'Pets' },
        { q: 'automatic pet feeder', cat: 'Pets' },
        { q: 'dog chew toys', cat: 'Pets' },
      ];

      let currentIndex = 0;
      while (true) {
        const item = targetQueries[currentIndex];
        console.log(`\n🚀 [Continuous] Scraping "${item.q}" in "${item.cat}"...`);
        try {
          await runSingleScrape(item.q, item.cat, limit, cachedIdToken, true);
        } catch (e) {
          console.error(`❌ Error: ${e.message}`);
        }
        currentIndex = (currentIndex + 1) % targetQueries.length;
        console.log(`😴 Sleeping ${delaySeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    } else {
      await runSingleScrape(query, category, limit, cachedIdToken, false);
    }
  } catch (error) {
    console.error('✗ Scrape failed:', error.response?.data?.error?.message || error.message);
  }
}

// =============================================
// SCRAPE PRODUCT DETAIL PAGE FOR RICH DATA
// =============================================

async function scrapeProductDetailPage(asin, headers) {
  const productUrl = `https://www.amazon.in/dp/${asin}`;
  try {
    const res = await axios.get(productUrl, { headers, timeout: 15000 });
    const $ = cheerio.load(res.data);

    // --- Images (all high-res) ---
    const images = [];
    // Try JSON image data first (most reliable)
    const imageDataScript = $('script:contains("ImageBlockATF")').text() ||
                             $('script:contains("colorImages")').text();
    const imageJsonMatch = imageDataScript.match(/'colorImages'\s*:\s*\{[^}]*'initial'\s*:\s*(\[[\s\S]*?\])\s*\}/);
    if (imageJsonMatch) {
      try {
        const imgArr = JSON.parse(imageJsonMatch[1]);
        imgArr.forEach(img => {
          const url = img.hiRes || img.large || img.main;
          if (url && !images.includes(url)) images.push(url);
        });
      } catch (e) {}
    }
    // Fallback: parse #altImages thumbnails and convert to full res
    if (images.length === 0) {
      $('#altImages img, #imageBlock img').each((i, el) => {
        let src = $(el).attr('src') || '';
        // Convert thumbnail URL to full res by removing resize params
        src = src.replace(/\._[A-Z0-9_,]+_\./, '.');
        if (src && src.startsWith('http') && !images.includes(src)) {
          images.push(src);
        }
      });
    }
    // Final fallback: main image
    if (images.length === 0) {
      const mainSrc = $('#landingImage').attr('data-old-hires') || $('#landingImage').attr('src') || '';
      if (mainSrc) images.push(mainSrc);
    }

    // --- Feature Bullets ---
    const bullets = [];
    $('#feature-bullets ul li span.a-list-item').each((i, li) => {
      const text = $(li).text().trim();
      if (text && text.length > 5) bullets.push(text);
    });

    // --- Product Description ---
    let prodDesc = $('#productDescription p, #productDescription_feature_div p').map((i, el) => $(el).text().trim()).get().join(' ');
    if (!prodDesc) prodDesc = $('#productDescription, #productDescription_feature_div').text().trim().replace(/\s+/g, ' ');

    // --- Technical Specifications ---
    const specs = {};
    $('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, .prodDetTable tr').each((i, tr) => {
      const key = $(tr).find('th').text().trim();
      const val = $(tr).find('td').text().trim().replace(/\s+/g, ' ');
      if (key && val) specs[key] = val;
    });
    // Also try detail bullets
    $('#detailBullets_feature_div ul li span.a-list-item').each((i, li) => {
      const text = $(li).text().replace(/\u200f/g, '').trim();
      const parts = text.split('\u200e').join('').split(':');
      if (parts.length >= 2) {
        const key = parts[0].replace(/[^\w\s\-&]/g, '').trim();
        const val = parts.slice(1).join(':').trim();
        if (key && val) specs[key] = val;
      }
    });

    // --- Rating & Reviews from PDP ---
    let rating = null;
    const ratingEl = $('span[data-hook="rating-out-of-five"] span.a-icon-alt, #acrPopover span.a-icon-alt');
    if (ratingEl.length > 0) {
      const m = ratingEl.first().text().match(/([0-9.]+)/);
      if (m) rating = parseFloat(m[1]);
    }

    let reviewCount = null;
    const reviewEl = $('span[data-hook="total-review-count"], #acrCustomerReviewText');
    if (reviewEl.length > 0) {
      const m = reviewEl.first().text().replace(/[^0-9]/g, '');
      if (m) reviewCount = parseInt(m);
    }

    // --- Build combined description ---
    let description = '';
    if (bullets.length > 0) {
      description += 'Product Features:\n' + bullets.map(b => `• ${b}`).join('\n') + '\n\n';
    }
    if (prodDesc) {
      description += 'Product Description:\n' + prodDesc + '\n\n';
    }
    if (Object.keys(specs).length > 0) {
      description += 'Specifications:\n' + Object.entries(specs).map(([k, v]) => `• ${k}: ${v}`).join('\n');
    }
    description = description.trim();

    return { images, description, rating, reviewCount, specs, bullets };
  } catch (err) {
    console.warn(`  ⚠ PDP fetch failed for ${asin}: ${err.message}`);
    return { images: [], description: '', rating: null, reviewCount: null, specs: {}, bullets: [] };
  }
}

// =============================================
// MAIN SCRAPE FUNCTION
// =============================================

async function runSingleScrape(queryStr, categoryName, limitCount, idToken, isContinuous) {
  console.log(`🔍 Searching Amazon.in for: "${queryStr}"...`);
  const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(queryStr)}`;

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
  };

  const searchRes = await axios.get(amazonUrl, { headers, timeout: 15000 });
  const $ = cheerio.load(searchRes.data);

  const rawProducts = [];
  const items = $('div[data-component-type="s-search-result"][data-asin]');

  items.each((idx, el) => {
    const item = $(el);
    const asin = item.attr('data-asin');
    if (!asin || asin.length < 5) return;

    const titleEl = item.find('h2 a span, .a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal');
    const imgEl = item.find('img.s-image');
    const priceEl = item.find('.a-price:not(.a-text-price) span.a-offscreen').first();
    const origPriceEl = item.find('.a-price.a-text-price span.a-offscreen').first();
    const ratingEl = item.find('span.a-icon-alt').first();
    const reviewsEl = item.find('span.a-size-base.s-underline-text').first();

    if (!titleEl.length || !priceEl.length) return;

    const name = titleEl.first().text().trim();
    if (!name || name.length < 3) return;

    // Best image from search result (try data-srcset or src)
    const imgSrc = imgEl.attr('src') || '';

    const priceRaw = priceEl.text().replace(/,/g, '');
    const priceMatch = priceRaw.match(/([0-9.]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    if (!price) return;

    let originalPrice = null;
    if (origPriceEl.length) {
      const origRaw = origPriceEl.text().replace(/,/g, '');
      const origMatch = origRaw.match(/([0-9.]+)/);
      if (origMatch) originalPrice = parseFloat(origMatch[1]);
    }

    let rating = 4.5;
    if (ratingEl.length) {
      const m = ratingEl.text().match(/([0-9.]+)/);
      if (m) rating = parseFloat(m[1]);
    }

    let reviews = 100;
    if (reviewsEl.length) {
      const m = reviewsEl.text().replace(/[^0-9]/g, '');
      if (m) reviews = parseInt(m);
    }

    rawProducts.push({ asin, name, price, originalPrice, image: imgSrc, rating, reviews, category: categoryName });
  });

  if (rawProducts.length === 0) {
    console.log('✗ No products found. Amazon may have blocked or returned CAPTCHA.');
    if (!isContinuous) process.exit(1);
    return;
  }

  console.log(`✓ Found ${rawProducts.length} products on search page.`);

  // =============================================
  // DEDUPLICATION: skip ASINs already in Firestore
  // =============================================
  const newProducts = [];
  for (const p of rawProducts.slice(0, limitCount)) {
    const exists = await checkProductExists(p.asin, idToken);
    if (exists) {
      console.log(`  ⏭ Skipping already-scraped ASIN: ${p.asin} (${p.name.substring(0, 30)})`);
    } else {
      newProducts.push(p);
    }
  }

  if (newProducts.length === 0) {
    console.log('✓ All found products already exist in database. Nothing new to add!');
    return;
  }

  console.log(`📥 ${newProducts.length} new products to enrich and import...`);

  // =============================================
  // ENRICH: visit each product's PDP for rich data
  // =============================================
  let saved = 0;
  for (const p of newProducts) {
    console.log(`\n  🔎 Enriching ASIN ${p.asin}: ${p.name.substring(0, 40)}...`);
    
    // Small delay between PDP requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    
    const pdpData = await scrapeProductDetailPage(p.asin, headers);

    // Use PDP rating/reviews if we got better data
    const finalRating = pdpData.rating ?? p.rating;
    const finalReviews = pdpData.reviewCount ?? p.reviews;

    // Use PDP images if we got them, otherwise use the search image
    const images = pdpData.images.length > 0 ? pdpData.images : (p.image ? [p.image] : []);
    const primaryImage = images[0] || '';

    // Use rich description if available
    const description = pdpData.description || `${p.name}. Product sourced from Amazon.in.`;

    const enrichedProduct = {
      asin: p.asin,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || Math.round(p.price * 1.25),
      image: primaryImage,
      images: images,           // NEW: all product images
      rating: finalRating,
      reviews: finalReviews,
      category: p.category,
      description: description, // ENHANCED: full bullets + description + specs
      specs: pdpData.specs,     // NEW: key/value specifications
      bullets: pdpData.bullets, // NEW: feature bullet points
      stock: 50,
      badge: p.originalPrice && p.originalPrice > p.price ? 'Sale' : '',
      source: 'amazon',
      scrapedAt: new Date().toISOString()
    };

    // Save to Firestore
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${p.asin}`;
      const payload = mapToFirestoreFields(enrichedProduct);

      await axios.patch(firestoreUrl, payload, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      saved++;
      console.log(`  ✓ Saved: ${p.name.substring(0, 40)} (${images.length} images, ${pdpData.bullets.length} bullets)`);
    } catch (err) {
      console.error(`  ✗ Failed to save ${p.asin}:`, err.response?.data?.error?.message || err.message);
    }
  }

  console.log(`\n🎉 Done! Saved ${saved}/${newProducts.length} new products.`);
}

// =============================================
// FIRESTORE FIELD MAPPER
// =============================================

function mapToFirestoreFields(p) {
  const fields = {
    name:          { stringValue: p.name },
    price:         { doubleValue: parseFloat(p.price) },
    originalPrice: { doubleValue: parseFloat(p.originalPrice) },
    stock:         { integerValue: parseInt(p.stock) },
    image:         { stringValue: p.image },
    images:        { arrayValue: { values: (p.images || []).map(url => ({ stringValue: url })) } },
    description:   { stringValue: p.description },
    category:      { stringValue: p.category },
    rating:        { doubleValue: parseFloat(p.rating) },
    reviews:       { integerValue: parseInt(p.reviews || 0) },
    source:        { stringValue: p.source },
    scrapedAt:     { stringValue: p.scrapedAt || new Date().toISOString() },
  };

  if (p.asin)   fields.asin  = { stringValue: p.asin };
  if (p.badge)  fields.badge = { stringValue: p.badge };

  // Specs as a map
  if (p.specs && Object.keys(p.specs).length > 0) {
    fields.specs = {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(p.specs).map(([k, v]) => [k, { stringValue: v }])
        )
      }
    };
  }

  // Bullets as an array
  if (p.bullets && p.bullets.length > 0) {
    fields.bullets = {
      arrayValue: { values: p.bullets.map(b => ({ stringValue: b })) }
    };
  }

  return { fields };
}
