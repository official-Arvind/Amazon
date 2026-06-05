/**
 * ZONIX Product Seeder
 * Run from admin page console or as a standalone script
 * Seeds the Firestore 'products' collection with curated product catalog
 */

import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, Timestamp, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const PRODUCTS = [
  // Electronics
  {
    name: 'Sony WH-1000XM5 Wireless Headphones',
    price: 29990,
    stock: 50,
    category: 'Electronics',
    description: 'Industry-leading noise cancellation with Auto NC Optimizer. Crystal clear hands-free calling with 4 beamforming microphones. Up to 30 hours battery life.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
    rating: 4.7,
    reviews: 2847,
    badge: 'Best Seller',
    originalPrice: 34990
  },
  {
    name: 'Apple MacBook Air M3 15"',
    price: 134900,
    stock: 25,
    category: 'Laptops',
    description: 'Supercharged by M3 chip. Up to 18 hours battery life. 15.3-inch Liquid Retina display. 8GB unified memory, 256GB SSD.',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=500&fit=crop',
    rating: 4.8,
    reviews: 1563,
    badge: 'Premium',
    originalPrice: 149900
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    price: 129999,
    stock: 40,
    category: 'Smartphones',
    description: '6.8" Dynamic AMOLED 2X display. 200MP camera. Galaxy AI built-in. Titanium frame with embedded S Pen.',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=500&fit=crop',
    rating: 4.6,
    reviews: 3421,
    badge: 'New Arrival',
    originalPrice: 144999
  },
  {
    name: 'iPad Pro M4 11-inch',
    price: 99900,
    stock: 35,
    category: 'Tablets',
    description: 'Ultra Retina XDR display. M4 chip with 10-core GPU. Apple Pencil Pro support. Thunderbolt / USB 4.',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&h=500&fit=crop',
    rating: 4.8,
    reviews: 892,
    badge: 'Premium',
    originalPrice: 109900
  },
  {
    name: 'JBL Charge 5 Bluetooth Speaker',
    price: 14999,
    stock: 80,
    category: 'Audio',
    description: 'Bold JBL Original Pro Sound. IP67 waterproof and dustproof. 20 hours of playtime. Built-in powerbank.',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop',
    rating: 4.5,
    reviews: 5632,
    badge: '',
    originalPrice: 17999
  },
  {
    name: 'Logitech MX Master 3S Mouse',
    price: 9995,
    stock: 120,
    category: 'Accessories',
    description: '8K DPI tracking on any surface. Quiet clicks. MagSpeed scroll. USB-C quick charge. Multi-device connectivity.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&h=500&fit=crop',
    rating: 4.7,
    reviews: 4210,
    badge: 'Best Seller',
    originalPrice: 11995
  },
  // Fashion & Lifestyle
  {
    name: 'Ray-Ban Aviator Classic Sunglasses',
    price: 12490,
    stock: 60,
    category: 'Fashion',
    description: 'Iconic Aviator design. Crystal green G-15 lenses. Gold-tone metal frame. 100% UV protection.',
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop',
    rating: 4.4,
    reviews: 1890,
    badge: '',
    originalPrice: 15490
  },
  {
    name: 'Nike Air Max 270 React',
    price: 13995,
    stock: 45,
    category: 'Footwear',
    description: 'Lightweight comfort with Nike React foam. Max Air unit for cushioning. Breathable mesh upper. Iconic lifestyle sneaker.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop',
    rating: 4.5,
    reviews: 7823,
    badge: 'Trending',
    originalPrice: 16995
  },
  // Home & Living
  {
    name: 'Philips Hue Smart LED Starter Kit',
    price: 13990,
    stock: 55,
    category: 'Smart Home',
    description: '3 smart bulbs + Bridge. 16 million colors. Voice control with Alexa & Google. Create scenes and routines.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500&h=500&fit=crop',
    rating: 4.3,
    reviews: 2156,
    badge: '',
    originalPrice: 16990
  },
  {
    name: 'Dyson V15 Detect Cordless Vacuum',
    price: 52900,
    stock: 20,
    category: 'Home Appliances',
    description: 'Laser reveals microscopic dust. Piezo sensor counts particles. LCD screen shows real-time data. Up to 60 min runtime.',
    image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500&h=500&fit=crop',
    rating: 4.6,
    reviews: 1245,
    badge: 'Premium',
    originalPrice: 62900
  },
  // Gaming
  {
    name: 'PlayStation 5 Digital Edition',
    price: 44990,
    stock: 15,
    category: 'Gaming',
    description: 'Lightning-fast SSD. Ray tracing. 4K-TV gaming. Up to 120fps. Haptic feedback DualSense controller.',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500&h=500&fit=crop',
    rating: 4.8,
    reviews: 9456,
    badge: 'Hot Deal',
    originalPrice: 49990
  },
  {
    name: 'Razer BlackWidow V4 Mechanical Keyboard',
    price: 16990,
    stock: 65,
    category: 'Gaming',
    description: 'Razer Green Mechanical Switches. Chroma RGB. 6 dedicated macro keys. Multi-function roller. Wrist rest included.',
    image: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&h=500&fit=crop',
    rating: 4.5,
    reviews: 3678,
    badge: '',
    originalPrice: 19990
  },
  // Watches & Wearables
  {
    name: 'Apple Watch Series 9 GPS 45mm',
    price: 44900,
    stock: 30,
    category: 'Wearables',
    description: 'S9 SiP chip. Double Tap gesture. Advanced health sensors. Always-On Retina display. Carbon neutral.',
    image: 'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=500&h=500&fit=crop',
    rating: 4.7,
    reviews: 2367,
    badge: 'New',
    originalPrice: 49900
  },
  {
    name: 'boAt Airdopes 141 TWS Earbuds',
    price: 1299,
    stock: 200,
    category: 'Audio',
    description: '42H playtime. BEAST Mode for gaming. ENx noise cancellation. IPX4 water resistance. Type-C charging.',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=500&h=500&fit=crop',
    rating: 4.1,
    reviews: 15623,
    badge: 'Value Pick',
    originalPrice: 4490
  },
  // Kitchen
  {
    name: 'Instant Pot Duo 7-in-1 Pressure Cooker',
    price: 8999,
    stock: 70,
    category: 'Kitchen',
    description: '7 appliances in 1: pressure cooker, slow cooker, rice cooker, steamer, sauté pan, yogurt maker, warmer. 6 Quart.',
    image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=500&h=500&fit=crop',
    rating: 4.6,
    reviews: 8945,
    badge: 'Best Seller',
    originalPrice: 12999
  },
  {
    name: 'Kindle Paperwhite Signature Edition',
    price: 19999,
    stock: 45,
    category: 'Electronics',
    description: '6.8" glare-free display. Adjustable warm light. 32GB storage. Wireless charging. 10 weeks battery.',
    image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=500&h=500&fit=crop',
    rating: 4.7,
    reviews: 4521,
    badge: '',
    originalPrice: 23999
  },
  // Camera
  {
    name: 'Canon EOS R50 Mirrorless Camera',
    price: 72990,
    stock: 18,
    category: 'Cameras',
    description: '24.2MP APS-C CMOS sensor. 4K video. Subject detection AF. In-body stabilization. Compact & lightweight.',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&h=500&fit=crop',
    rating: 4.5,
    reviews: 876,
    badge: 'Premium',
    originalPrice: 82990
  },
  {
    name: 'Samsung 55" Crystal 4K UHD Smart TV',
    price: 42990,
    stock: 22,
    category: 'TV & Entertainment',
    description: 'Crystal Processor 4K. Dynamic Crystal Color. Smart TV with Tizen OS. HDR. Q-Symphony. AirSlim design.',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500&h=500&fit=crop',
    rating: 4.4,
    reviews: 3210,
    badge: 'Deal',
    originalPrice: 54990
  },
  {
    name: 'Noise ColorFit Pro 5 Smartwatch',
    price: 3999,
    stock: 150,
    category: 'Wearables',
    description: '1.85" AMOLED display. Bluetooth calling. 100+ sports modes. SpO2, heart rate & sleep tracking. 7-day battery.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
    rating: 4.2,
    reviews: 12450,
    badge: 'Value Pick',
    originalPrice: 7999
  },
  {
    name: 'Bose QuietComfort Ultra Earbuds',
    price: 27990,
    stock: 40,
    category: 'Audio',
    description: 'World-class noise cancellation. Immersive Spatial Audio. CustomTune sound calibration. 6 hours battery.',
    image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=500&h=500&fit=crop',
    rating: 4.6,
    reviews: 1876,
    badge: 'Premium',
    originalPrice: 32990
  }
];

/**
 * Seed all products to Firestore
 */
export async function seedProducts() {
  console.log('🌱 Starting product seeding...');
  const productsRef = collection(db, 'products');
  let count = 0;
  
  for (const product of PRODUCTS) {
    try {
      await addDoc(productsRef, {
        ...product,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      count++;
      console.log(`  ✓ Added: ${product.name}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${product.name}`, error.message);
    }
  }
  
  console.log(`\n🎉 Seeded ${count}/${PRODUCTS.length} products successfully!`);
  return count;
}

/**
 * Clear all existing products
 */
export async function clearProducts() {
  console.log('🗑️ Clearing existing products...');
  const productsRef = collection(db, 'products');
  const snapshot = await getDocs(productsRef);
  let count = 0;
  
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, 'products', docSnap.id));
    count++;
  }
  
  console.log(`✓ Cleared ${count} products`);
  return count;
}

/**
 * Reset and reseed (clear + seed)
 */
export async function resetAndSeed() {
  await clearProducts();
  return await seedProducts();
}

// Make available on window for console usage
window.seedProducts = seedProducts;
window.clearProducts = clearProducts;
window.resetAndSeed = resetAndSeed;
