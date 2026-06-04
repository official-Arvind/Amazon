import { fetchCjProducts } from './cj_api.js';
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * Import products from CJ Dropshipping and save them to Firebase Firestore.
 * @param {string} keyword Optional search keyword to filter CJ products
 * @returns {Promise<Object>} Statistics on the import process
 */
export async function importCjProductsToFirebase(keyword = "tech") {
  try {
    const cjProducts = await fetchCjProducts(1, 20, keyword);
    
    if (!cjProducts || cjProducts.length === 0) {
      return { success: true, message: 'No products found to import.', imported: 0 };
    }

    const productsRef = collection(db, 'products');
    let importedCount = 0;
    let skippedCount = 0;

    for (const cjProduct of cjProducts) {
      // Check if product already exists (by name or a custom cjId field if we had one)
      // Since we don't have cjId, we'll check by name to avoid duplicates
      const q = query(productsRef, where("name", "==", cjProduct.productNameEn || cjProduct.productName));
      const existingDocs = await getDocs(q);

      if (!existingDocs.empty) {
        skippedCount++;
        continue; // Skip if it already exists
      }

      // Map CJ Product to our schema
      // Note: CJ API v2 properties usually include productNameEn, productPrice, productImageUrl, categoryName
      const mappedProduct = {
        name: cjProduct.productNameEn || cjProduct.productName || 'Imported Product',
        price: parseFloat(cjProduct.sellPrice || cjProduct.productPrice) || 999, // default if undefined
        stock: parseInt(cjProduct.entryCount || 100), // generic stock if not provided
        category: cjProduct.categoryName || 'Imported',
        image: cjProduct.productImage || cjProduct.productImageUrl || 'https://via.placeholder.com/400x400?text=CJ+Product',
        description: cjProduct.productKeyEn || 'Imported from CJ Dropshipping.',
        source: 'cj_dropshipping',
        cjProductId: cjProduct.pid || cjProduct.productId,
        createdAt: serverTimestamp()
      };

      await addDoc(productsRef, mappedProduct);
      importedCount++;
    }

    return { 
      success: true, 
      message: `Successfully imported ${importedCount} products. Skipped ${skippedCount} existing products.`,
      imported: importedCount 
    };

  } catch (error) {
    console.error("Failed to import CJ products:", error);
    throw error;
  }
}
