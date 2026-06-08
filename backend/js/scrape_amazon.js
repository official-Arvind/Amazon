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
const delaySeconds = parseInt(args.delay) || 45; // Delay in seconds between scrapes to prevent block
let password = args.password;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

async function startScrapeProcess() {
  if (!password) {
    console.error('Password is required to write to Firestore rules. Exiting.');
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
    
    const idToken = authRes.data.idToken;
    console.log('✓ Authentication successful!');

    if (continuous) {
      console.log('🔄 Continuous scraping mode activated!');
      
      // A diverse, predefined list of search terms and their categories to build the marketplace
      const targetQueries = [
        { q: 'keyboard', cat: 'Gaming' },
        { q: 'gaming mouse', cat: 'Gaming' },
        { q: 'curved monitor', cat: 'Electronics' },
        { q: 'wireless headphones', cat: 'Audio' },
        { q: 'bluetooth speaker', cat: 'Audio' },
        { q: 'soundbar', cat: 'Audio' },
        { q: 'smartphone', cat: 'Electronics' },
        { q: 'tablet', cat: 'Electronics' },
        { q: 'laptop', cat: 'Electronics' },
        { q: 'smartwatch', cat: 'Electronics' },
        { q: 'camera', cat: 'Electronics' },
        { q: 'mens shoes', cat: 'Fashion' },
        { q: 't-shirt for men', cat: 'Fashion' },
        { q: 'sunglasses', cat: 'Fashion' },
        { q: 'vacuum cleaner', cat: 'Home & Kitchen' },
        { q: 'coffee maker', cat: 'Home & Kitchen' },
        { q: 'air fryer', cat: 'Home & Kitchen' },
        { q: 'mechanical keyboard', cat: 'Gaming' },
        { q: 'gaming headset', cat: 'Gaming' }
      ];

      let currentIndex = 0;
      while (true) {
        const item = targetQueries[currentIndex];
        console.log(`\n🚀 [Continuous Mode] Starting scrape for "${item.q}" in category "${item.cat}"...`);
        
        try {
          await runSingleScrape(item.q, item.cat, limit, idToken, true);
        } catch (e) {
          console.error(`❌ Error scraping "${item.q}":`, e.message);
        }
        
        currentIndex = (currentIndex + 1) % targetQueries.length;
        console.log(`😴 Sleeping for ${delaySeconds} seconds to prevent Amazon blocks...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    } else {
      await runSingleScrape(query, category, limit, idToken, false);
    }
  } catch (error) {
    console.error('✗ Scrape process failed:', error.response?.data?.error?.message || error.message);
  }
}

async function runSingleScrape(queryStr, categoryName, limitCount, idToken, isContinuous) {
  console.log(`🔍 Scraping Amazon for: "${queryStr}"...`);
  const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(queryStr)}`;
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Device-Memory': '8',
    'Viewport-Width': '1920',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  };

  const searchRes = await axios.get(amazonUrl, { headers });
  const htmlText = searchRes.data;
  const $ = cheerio.load(htmlText);

  const products = [];
  const items = $('div[data-component-type="s-search-result"], div.s-result-item[data-asin]');

  items.each((idx, el) => {
    const item = $(el);
    const asin = item.attr('data-asin');
    if (!asin) return;

    const titleEl = item.find('h2 a span, .a-size-medium.a-color-base.a-text-normal, .a-size-base-plus.a-color-base.a-text-normal');
    const imgEl = item.find('img.s-image');
    const priceEl = item.find('.a-price span.a-offscreen');
    const origPriceEl = item.find('.a-price.a-text-price span.a-offscreen');
    const ratingEl = item.find('span.a-icon-alt');
    const reviewsEl = item.find('span.a-size-base.s-underline-text, a.a-link-normal .a-size-base');

    if (titleEl.length === 0 || priceEl.length === 0) return;

    const name = titleEl.text().trim();
    const image = imgEl.attr('src') || '';
    const priceRaw = priceEl.text();
    const priceText = priceRaw.replace(/,/g, '').match(/([0-9.]+)/);
    const price = priceText ? parseFloat(priceText[1]) : 0;

    let originalPrice = null;
    if (origPriceEl.length > 0) {
      const origPriceRaw = origPriceEl.text();
      const origPriceText = origPriceRaw.replace(/,/g, '').match(/([0-9.]+)/);
      originalPrice = origPriceText ? parseFloat(origPriceText[1]) : null;
    }

    let rating = 4.5;
    if (ratingEl.length > 0) {
      const ratingMatch = ratingEl.text().match(/([0-9.]+)/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    }

    let reviews = 100;
    if (reviewsEl.length > 0) {
      const reviewsText = reviewsEl.text().replace(/[^\d]/g, '');
      if (reviewsText) reviews = parseInt(reviewsText);
    }

    products.push({
      asin,
      name,
      price,
      originalPrice: originalPrice || Math.round(price * 1.25),
      image,
      rating,
      reviews,
      category: categoryName,
      description: `${name}. Real product imported directly from Amazon.`,
      stock: 50,
      badge: originalPrice ? 'Sale' : '',
      source: 'amazon'
    });
  });

  if (products.length === 0) {
    // Try single product details page fallback
    const titleEl = $('#productTitle');
    if (titleEl.length > 0) {
      console.log('💡 Found a single product detail page. Parsing...');
      const name = titleEl.text().trim();
      const imgEl = $('#landingImage, #imgBlkFront, #ebooksImgBlkFront');
      let image = '';
      if (imgEl.length > 0) {
        image = imgEl.attr('data-old-hires') || imgEl.attr('src') || '';
        const dynamicImageStr = imgEl.attr('data-a-dynamic-image');
        if (dynamicImageStr) {
          try {
            const dynamicImages = JSON.parse(dynamicImageStr);
            const urls = Object.keys(dynamicImages);
            if (urls.length > 0) image = urls[0];
          } catch (e) {}
        }
      }

      const priceEl = $('.a-price.priceToPay span.a-offscreen, #corePrice_feature_div .a-price span.a-offscreen, #priceblock_ourprice, #priceblock_dealprice, #price_inside_buybox, .apexPriceToPay span.a-offscreen, .a-price span.a-offscreen');
      const priceRaw = priceEl.length > 0 ? priceEl.first().text() : '0';
      const priceText = priceRaw.replace(/,/g, '').match(/([0-9.]+)/);
      const price = priceText ? parseFloat(priceText[1]) : 0;

      const origPriceEl = $('#corePriceDisplay_desktop_feature_div .a-price.a-text-price span.a-offscreen, .a-price.a-text-price span.a-offscreen, .basisPrice .a-offscreen, #priceblock_listprice');
      let originalPrice = null;
      if (origPriceEl.length > 0) {
        const origPriceRaw = origPriceEl.first().text();
        const origPriceText = origPriceRaw.replace(/,/g, '').match(/([0-9.]+)/);
        originalPrice = origPriceText ? parseFloat(origPriceText[1]) : null;
      }

      const ratingEl = $('span[data-hook="rating-out-of-five"], #acrPopover span.a-icon-alt, #acrPopover, span.a-icon-alt');
      let rating = 4.5;
      if (ratingEl.length > 0) {
        const ratingMatch = ratingEl.first().text().match(/([0-9.]+)/);
        if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      }

      const reviewsEl = $('span[data-hook="total-review-count"], #acrCustomerReviewText, #acrCustomerReviewLink');
      let reviews = 100;
      if (reviewsEl.length > 0) {
        const reviewsText = reviewsEl.first().text().replace(/[^\d]/g, '');
        if (reviewsText) reviews = parseInt(reviewsText);
      }

      // Feature bullets
      const bullets = [];
      $('#feature-bullets ul li span.a-list-item').each((i, li) => {
        const text = $(li).text().trim();
        if (text) bullets.push(text);
      });

      // Product Description paragraph
      const descEl = $('#productDescription, #productDescription_feature_div');
      let prodDesc = '';
      if (descEl.length > 0) {
        prodDesc = descEl.text().trim().replace(/\s+/g, ' ');
      }

      // Specifications table
      const specList = [];
      $('#productDetails_techSpec_section_1 tr, .prodDetTable tr').each((i, tr) => {
        const keyEl = $(tr).find('th');
        const valEl = $(tr).find('td');
        if (keyEl.length > 0 && valEl.length > 0) {
          const key = keyEl.text().trim();
          const val = valEl.text().trim().replace(/\s+/g, ' ');
          if (key && val) specList.push(`${key}: ${val}`);
        }
      });

      if (specList.length === 0) {
        $('#detailBullets_feature_div ul li span.a-list-item').each((i, li) => {
          const text = $(li).text().replace(/\s+/g, ' ').trim();
          if (text) {
            const parts = text.split(':');
            if (parts.length >= 2) {
              const key = parts[0].replace(/[^\w\s-]/g, '').trim();
              const val = parts.slice(1).join(':').trim();
              if (key && val) specList.push(`${key}: ${val}`);
            }
          }
        });
      }

      // Combine bullets, description, and specifications
      let description = '';
      if (bullets.length > 0) {
        description += "Product Features:\n" + bullets.map(b => `• ${b}`).join('\n') + "\n\n";
      }
      if (prodDesc) {
        description += "Product Description:\n" + prodDesc + "\n\n";
      }
      if (specList.length > 0) {
        description += "Specifications:\n" + specList.map(s => `• ${s}`).join('\n');
      }
      description = description.trim();
      if (!description) {
        description = `${name}. Real product imported directly from Amazon.`;
      }

      let asin = '';
      const asinEl = $('#ASIN, input[name="ASIN"]');
      if (asinEl.length > 0) {
        asin = asinEl.attr('value') || (asinEl.attr('name') === 'ASIN' && asinEl.val()) || '';
      } else {
        const canonicalEl = $('link[rel="canonical"]');
        if (canonicalEl.length > 0 && canonicalEl.attr('href')) {
          const match = canonicalEl.attr('href').match(/\/dp\/([A-Z0-9]{10})/i);
          if (match) asin = match[1].toUpperCase();
        }
      }
      if (!asin) {
        asin = 'AMZN' + Math.random().toString(36).substring(2, 8).toUpperCase();
      }

      if (name && price) {
        products.push({
          asin,
          name,
          price,
          originalPrice: originalPrice || Math.round(price * 1.25),
          image,
          rating,
          reviews,
          category: categoryName,
          description,
          stock: 50,
          badge: originalPrice ? 'Sale' : '',
          source: 'amazon'
        });
      }
    }
  }

  if (products.length === 0) {
    console.log('✗ No products found. Amazon may have blocked the request or returned a CAPTCHA page.');
    console.log('💡 Note: Try running again or run from a different IP/proxy.');
    if (!isContinuous) {
      process.exit(1);
    }
    return;
  }

  console.log(`✓ Parsed ${products.length} products successfully.`);
  const displayProducts = products.slice(0, limitCount);
  console.log(`📥 Importing ${displayProducts.length} products into Firestore database...`);

  let saved = 0;
  for (const p of displayProducts) {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${p.asin}?updateMask.fieldPaths=price&updateMask.fieldPaths=name&updateMask.fieldPaths=stock&updateMask.fieldPaths=image&updateMask.fieldPaths=description&updateMask.fieldPaths=category&updateMask.fieldPaths=rating&updateMask.fieldPaths=reviews&updateMask.fieldPaths=originalPrice&updateMask.fieldPaths=source&updateMask.fieldPaths=asin&updateMask.fieldPaths=badge`;
      const payload = mapToFirestoreFields(p);

      // PATCH creates the document if it doesn't exist, or merges fields if it does.
      await axios.patch(firestoreUrl, payload, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      saved++;
      console.log(`  ✓ Imported ASIN: ${p.asin} - ${p.name.substring(0, 30)}...`);
    } catch (err) {
      console.error(`  ✗ Failed to import ASIN ${p.asin}:`, err.response?.data?.error?.message || err.message);
    }
  }

  console.log(`\n🎉 Bulk import complete! Imported ${saved}/${displayProducts.length} products successfully.`);
}

function mapToFirestoreFields(p) {
  const fields = {
    name: { stringValue: p.name },
    price: { doubleValue: parseFloat(p.price) },
    stock: { integerValue: parseInt(p.stock) },
    image: { stringValue: p.image },
    description: { stringValue: p.description },
    category: { stringValue: p.category },
    rating: { doubleValue: parseFloat(p.rating) },
    reviews: { integerValue: parseInt(p.reviews) },
    originalPrice: { doubleValue: parseFloat(p.originalPrice) },
    source: { stringValue: p.source }
  };
  if (p.asin) fields.asin = { stringValue: p.asin };
  if (p.badge) fields.badge = { stringValue: p.badge };
  return { fields };
}
