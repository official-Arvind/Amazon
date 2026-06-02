# ZONIX E-Commerce - Complete Setup Guide

## 🚀 Overview

This guide covers complete setup of ZONIX e-commerce platform with Firebase, backend connection, and full page integration.

---

## 📋 Prerequisites

- Node.js 14+ (optional, for Firebase CLI)
- Firebase account (https://firebase.google.com)
- Git
- VS Code or any modern editor

---

## 🔧 Step 1: Firebase Project Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or use existing: **studio-vih63**
3. Select project
4. Go to **Project Settings** (gear icon)
5. Copy config and verify values in `backend/js/firebase-config.js`

**Your current config:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDjpgHpiMsO7SP_DtcWbhJ_tMgsDJVSnu4",
  authDomain: "studio-vih63.firebaseapp.com",
  projectId: "studio-vih63",
  storageBucket: "studio-vih63.firebasestorage.app",
  messagingSenderId: "771569986455",
  appId: "1:771569986455:web:bbfc575f548251d505f2d2",
  measurementId: "G-KRX08RSM3M"
};
```

### 1.2 Enable Authentication

1. **In Firebase Console:**
   - Go to **Authentication** > **Sign-in method**
   - Enable **Email/Password**
   - Enable **Google** (optional)
   - Save

2. **Test user account:**
   - Go to **Authentication** > **Users**
   - Click **Add User**
   - Email: `test@example.com`
   - Password: `Test123456`
   - Click **Create**

### 1.3 Enable Firestore Database

1. **In Firebase Console:**
   - Go to **Firestore Database**
   - Click **Create database**
   - Start in **Production mode**
   - Select location (closest to you)
   - Create

2. **Set Security Rules:**

Go to **Firestore** > **Rules** tab and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Products - Everyone can read, only admin can write
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth.token.email == 'admin@zonix.com';
    }
    
    // Users - Each user can read/write their own data
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      
      // Subcollections
      match /{document=**} {
        allow read, write: if request.auth.uid == uid;
      }
    }
    
    // Orders - Users can read own, admin can read all
    match /orders/{document=**} {
      allow create: if request.auth != null;
      allow read: if 
        request.auth.uid == resource.data.userId ||
        request.auth.token.email == 'admin@zonix.com';
      allow update: if request.auth.token.email == 'admin@zonix.com';
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Click "Publish"**

### 1.4 Create Firestore Collections

**Method 1: Via Console**
1. Go to Firestore Database
2. Click "+ Start collection"
3. Create collection "products"
4. Add sample product:
   ```
   name: "4K Gaming Monitor"
   price: 32499
   stock: 10
   image: "https://..."
   description: "Premium 4K gaming monitor"
   category: "Electronics"
   isActive: true
   ```

**Method 2: Via Terminal (Firebase CLI)**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Init (or use existing project)
firebase init firestore

# Deploy
firebase deploy
```

---

## 🎯 Step 2: Configure Admin Email

**IMPORTANT:** Set your admin email in TWO places:

### 2.1 Login Page Admin Config

**File:** `frontend/login/auth.js` (Line ~20)
```javascript
const ADMIN_EMAIL = 'admin@zonix.com'; // ← Change this to your email
```

### 2.2 Admin Backend Config

**File:** `backend/js/admin.js` (Line ~24)
```javascript
const ADMIN_EMAIL = 'admin@zonix.com'; // ← Must match above
```

Then create Firebase user with that email:
- Go to Firebase Console > Authentication > Users
- Add User with your admin email
- Use a strong password

---

## 📊 Step 3: Database Structure

### Collection: products
```
/products
  ├── name (string) - Product name
  ├── price (number) - Price in ₹
  ├── stock (number) - Available stock
  ├── image (string) - Product image URL
  ├── description (string) - Product details
  ├── category (string) - Product category
  ├── isActive (boolean) - Active status
  ├── createdAt (timestamp) - Created date
  └── updatedAt (timestamp) - Updated date
```

### Collection: users/{userId}
```
/users/{userId}
  ├── email (string) - User email
  ├── displayName (string) - User display name
  ├── phone (string) - Phone number
  ├── profilePicture (string) - Avatar URL
  ├── createdAt (timestamp) - Signup date
  ├── updatedAt (timestamp) - Last update
  │
  ├── /cart (subcollection)
  │   └── {productId}
  │       ├── productId (string)
  │       ├── name (string)
  │       ├── price (number)
  │       ├── quantity (number)
  │       ├── image (string)
  │       └── addedAt (timestamp)
  │
  └── /addresses (subcollection)
      └── {addressId}
          ├── street (string)
          ├── city (string)
          ├── state (string)
          ├── zip (string)
          ├── country (string)
          ├── phone (string)
          └── isDefault (boolean)
```

### Collection: orders
```
/orders/{orderId}
  ├── userId (string) - User ID
  ├── orderNumber (string) - ORD-timestamp
  ├── items (array) - [{productId, name, price, quantity}]
  ├── shippingAddress (object) - Shipping details
  ├── shippingMethod (string) - standard|express|overnight
  ├── paymentMethod (string) - card|upi|wallet
  ├── subtotal (number) - Items total
  ├── shippingCost (number) - Shipping fee
  ├── tax (number) - Tax amount
  ├── total (number) - Grand total
  ├── status (string) - pending|confirmed|shipped|delivered
  ├── createdAt (timestamp) - Order date
  └── updatedAt (timestamp) - Last update
```

---

## 🔗 Step 4: Complete Page Integration

### 4.1 Cart Page
**File:** `frontend/cart/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Shopping Cart - ZONIX</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div id="cart-container">
        <!-- Cart items will be loaded here -->
    </div>
    
    <script type="module">
        import { appState, removeItemFromCart, showNotification, getCartTotal } from '../js/main.js';
        
        document.addEventListener('DOMContentLoaded', () => {
            displayCart();
        });
        
        async function displayCart() {
            const container = document.getElementById('cart-container');
            
            if (appState.cart.length === 0) {
                container.innerHTML = '<p>Your cart is empty</p>';
                return;
            }
            
            let html = '<h2>Shopping Cart</h2><table><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th>Action</th></tr>';
            
            appState.cart.forEach(item => {
                const total = item.price * item.quantity;
                html += `
                    <tr>
                        <td>${item.name}</td>
                        <td>₹${item.price}</td>
                        <td>${item.quantity}</td>
                        <td>₹${total}</td>
                        <td><button onclick="removeItem('${item.productId}')">Remove</button></td>
                    </tr>
                `;
            });
            
            html += '</table>';
            html += `<p>Total: ₹${getCartTotal()}</p>`;
            html += '<a href="../checkout/"><button>Checkout</button></a>';
            
            container.innerHTML = html;
        }
        
        window.removeItem = async (productId) => {
            await removeItemFromCart(productId);
            displayCart();
        };
    </script>
</body>
</html>
```

### 4.2 Checkout Page
**File:** `frontend/checkout/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Checkout - ZONIX</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div id="checkout-container">
        <h2>Checkout</h2>
        <form id="checkoutForm">
            <h3>Shipping Address</h3>
            <input type="text" name="street" placeholder="Street Address" required>
            <input type="text" name="city" placeholder="City" required>
            <input type="text" name="state" placeholder="State" required>
            <input type="text" name="zip" placeholder="ZIP Code" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="tel" name="phone" placeholder="Phone" required>
            
            <h3>Shipping Method</h3>
            <select name="method" required>
                <option value="standard">Standard (5-7 days)</option>
                <option value="express">Express (2-3 days)</option>
                <option value="overnight">Overnight</option>
            </select>
            
            <h3>Payment Method</h3>
            <select name="payment" required>
                <option value="card">Credit/Debit Card</option>
                <option value="upi">UPI</option>
                <option value="wallet">Digital Wallet</option>
            </select>
            
            <button type="submit">Place Order</button>
        </form>
    </div>
    
    <script type="module">
        import { appState, createUserOrder, showNotification, getCartTotal } from '../js/main.js';
        
        document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const shippingData = {
                address: Object.fromEntries(formData),
                method: formData.get('method'),
                payment: formData.get('payment'),
                shippingCost: 50,
                tax: Math.round(getCartTotal() * 0.18),
                total: getCartTotal() + 50 + Math.round(getCartTotal() * 0.18)
            };
            
            const order = await createUserOrder(shippingData);
            
            if (order) {
                showNotification('Order placed successfully!', 'success');
                setTimeout(() => {
                    window.location.href = `../profile/?order=${order.orderId}`;
                }, 2000);
            }
        });
    </script>
</body>
</html>
```

### 4.3 Profile Page
**File:** `frontend/profile/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Profile - ZONIX</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div id="profile-container">
        <h2>My Profile</h2>
        <div id="userInfo"></div>
        <h3>My Orders</h3>
        <div id="ordersList"></div>
        <h3>Saved Addresses</h3>
        <div id="addressList"></div>
    </div>
    
    <script type="module">
        import { appState, getUserOrders, showNotification } from '../js/main.js';
        
        document.addEventListener('DOMContentLoaded', async () => {
            if (!appState.isAuthenticated) {
                window.location.href = '../login/';
                return;
            }
            
            // Display user info
            document.getElementById('userInfo').innerHTML = `
                <p>Email: ${appState.currentUser.email}</p>
                <p>Name: ${appState.currentUser.displayName || 'N/A'}</p>
            `;
            
            // Load and display orders
            const orders = await getUserOrders();
            let ordersHtml = '';
            
            if (orders.length === 0) {
                ordersHtml = '<p>No orders yet</p>';
            } else {
                ordersHtml = '<table><tr><th>Order #</th><th>Date</th><th>Total</th><th>Status</th></tr>';
                orders.forEach(order => {
                    ordersHtml += `
                        <tr>
                            <td>${order.orderNumber}</td>
                            <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                            <td>₹${order.total}</td>
                            <td>${order.status}</td>
                        </tr>
                    `;
                });
                ordersHtml += '</table>';
            }
            
            document.getElementById('ordersList').innerHTML = ordersHtml;
            
            // Display addresses
            let addressHtml = '';
            appState.addresses.forEach(addr => {
                addressHtml += `
                    <div class="address-card">
                        <p>${addr.street}</p>
                        <p>${addr.city}, ${addr.state} ${addr.zip}</p>
                        <p>Phone: ${addr.phone}</p>
                    </div>
                `;
            });
            
            document.getElementById('addressList').innerHTML = addressHtml || '<p>No saved addresses</p>';
        });
    </script>
</body>
</html>
```

---

## 📦 Step 5: Deploy to Firebase Hosting

### 5.1 Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 5.2 Initialize Hosting

```bash
firebase login
firebase init hosting
# Select your project
# Set public directory to: frontend
# Configure as single-page app: Yes
```

### 5.3 Deploy

```bash
firebase deploy --only hosting
```

Your site will be live at: `https://your-project.firebaseapp.com`

---

## ✅ Complete Integration Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Collections created (products, users, orders)
- [ ] Admin email configured in `auth.js` and `admin.js`
- [ ] Admin Firebase user created
- [ ] Test user created
- [ ] All HTML files updated with script imports
- [ ] Cart page setup and tested
- [ ] Checkout page setup and tested
- [ ] Profile page setup and tested
- [ ] Login page tested (regular and admin)
- [ ] Admin panel tested
- [ ] Products added to Firestore
- [ ] Test order flow end-to-end
- [ ] GitHub Pages deployment tested (main & dev-1)
- [ ] Firebase Hosting deployed

---

## 🧪 Testing Flow

### 1. User Registration
1. Go to `/login/`
2. Click "Sign Up"
3. Enter email and password
4. Verify user created in Firebase Console

### 2. Browse Products
1. Go to home page
2. Verify products load
3. Click product to search

### 3. Add to Cart
1. Logged-in user clicks add to cart
2. Verify cart badge updates
3. Verify item in Firestore under `/users/{uid}/cart`

### 4. Checkout
1. Go to `/cart/`
2. Click checkout
3. Fill shipping address
4. Submit
5. Verify order in Firestore under `/orders`

### 5. Admin Panel
1. Go to `/login/`
2. Click "Login as Admin"
3. Login with admin email
4. Verify dashboard loads
5. Add a product
6. Verify in products collection

---

## 🐛 Troubleshooting

### Issue: "Cannot find module"
**Solution:** Ensure import paths are correct:
- From frontend: `'../backend/js/...'`
- From backend: No relative paths

### Issue: "Unauthorized" error
**Solution:** Check security rules and user authentication

### Issue: Products not loading
**Solution:** 
1. Verify `/products` collection exists
2. Check Firestore security rules
3. Check browser console for errors

### Issue: Cart not syncing
**Solution:**
1. Verify user is authenticated
2. Check `/users/{uid}/cart` exists in Firestore
3. Verify security rules allow read/write

---

## 📚 References

- [Firebase Docs](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [GitHub Pages](https://pages.github.com)

---

**Status: ✅ Ready for Production**

All systems configured and ready to use!
