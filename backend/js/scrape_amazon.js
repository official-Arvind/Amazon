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

    console.log(`🔍 Scraping Amazon for: "${query}"...`);
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
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
      const priceText = priceEl.text().replace(/[^\d]/g, '');
      const price = parseFloat(priceText);

      let originalPrice = null;
      if (origPriceEl.length > 0) {
        originalPrice = parseFloat(origPriceEl.text().replace(/[^\d]/g, ''));
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
        category,
        description: `${name}. Real product imported directly from Amazon.`,
        stock: 50,
        badge: originalPrice ? 'Sale' : '',
        source: 'amazon'
      });
    });

    if (products.length === 0) {
      console.log('✗ No products found. Amazon may have blocked the request or returned a CAPTCHA page.');
      console.log('💡 Note: Try running again or run from a different IP/proxy.');
      process.exit(1);
    }

    console.log(`✓ Parsed ${products.length} products successfully.`);
    const displayProducts = products.slice(0, limit);
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
  } catch (error) {
    console.error('✗ Scrape process failed:', error.response?.data?.error?.message || error.message);
  }
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
