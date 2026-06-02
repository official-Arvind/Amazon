# ZONIX Admin Panel - Setup & Configuration Guide

## 📋 Overview

This guide covers the complete setup and usage of the ZONIX Admin Panel, which includes:
- Admin authentication
- Product management
- Order viewing
- User management
- Dashboard statistics
- Secure deployment workflow

---

## 🔧 Quick Start

### Step 1: Configure Admin Email

**File:** `frontend/login/auth.js`

Find this line and update it with your admin email:

```javascript
const ADMIN_EMAIL = 'admin@zonix.com'; // Change this to your admin email
```

**Also update in:** `backend/js/admin.js`

```javascript
const ADMIN_EMAIL = 'admin@zonix.com'; // Must match login page ADMIN_EMAIL
```

### Step 2: Create Admin User in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **studio-vih63**
3. Navigate to **Authentication** > **Users**
4. Click **Add User**
5. Enter the admin email and a secure password
6. Click **Create**

### Step 3: Set Up Firestore Collections

The following collections are automatically created when data is added:

- **`products`** - Product catalog
- **`orders`** - Customer orders
- **`users`** - User profiles

**Firestore Rules** (for admin access):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin-only: Product management
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth.token.email == 'admin@zonix.com';
    }
    
    // Admin-only: Order viewing
    match /orders/{document=**} {
      allow read: if request.auth.token.email == 'admin@zonix.com';
      allow write: if request.auth.token.email == 'admin@zonix.com';
    }
    
    // User data
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid || request.auth.token.email == 'admin@zonix.com';
    }
  }
}
```

---

## 🎯 How to Use the Admin Panel

### Accessing Admin Panel

1. **Regular User Login:** Navigate to `your-site.com/login/`
   - Enter user credentials
   - Click "Login"
   - Redirected to user homepage

2. **Admin Login:** Navigate to `your-site.com/login/`
   - Click "Login as Admin" button
   - Enter admin email and password
   - Redirected to `/admin/` dashboard

### Admin Dashboard Features

#### 📊 Dashboard Tab
- View key statistics:
  - Total Products
  - Total Orders
  - Total Users
  - Total Revenue
- See recent orders in real-time

#### 🛍️ Manage Products Tab
- **Add New Product:**
  - Product Name (required)
  - Price in ₹ (required)
  - Stock Quantity (required)
  - Image URL (required)
  - Description (required)
  - Category (optional)
  
- **View Inventory:**
  - All products with prices and stock
  - Stock status indicators (In Stock, Low Stock, Out of Stock)

#### 📦 View Orders Tab
- See all customer orders
- Order details:
  - Order ID
  - Customer email
  - Total amount
  - Number of items
  - Order status
  - Date and time

#### 👥 Users Tab
- View all registered users
- User information:
  - User ID
  - Email address
  - Display name
  - Join date

---

## 🚀 Deployment Guide

### Important: Manual Deployment Only

The deployment workflow is now **manual** and restricted to the **dev-1 branch only**.

### Deploying to GitHub Pages

1. **On dev-1 Branch (Includes Admin Panel):**
   ```bash
   git checkout dev-1
   git push origin dev-1
   ```

2. **Manual Trigger Deployment:**
   - Go to GitHub repository
   - Click "Actions" tab
   - Select "Deploy to GitHub Pages (Manual - dev-1 only)" workflow
   - Click "Run workflow"
   - Choose branch: **dev-1**
   - Click "Run workflow"

### Deploying from Main Branch (Admin Panel Removed)

1. **On main Branch:**
   ```bash
   git checkout main
   git push origin main
   ```

2. **Manual Trigger Deployment:**
   - Go to GitHub repository
   - Click "Actions" tab
   - Select "Deploy to GitHub Pages (Manual - dev-1 only)" workflow
   - Click "Run workflow"
   - Choose branch: **main**
   - Click "Run workflow"
   - ⚠️ **Note:** Admin folder will be automatically removed for main branch deployments

### Workflow Features

- ✅ Manual deployment (requires user action)
- ✅ Branch validation
- ✅ Automatic admin folder removal for main branch
- ✅ Deployment summary logging

---

## 🔐 Security Best Practices

1. **Admin Email Protection:**
   - Don't share your admin email publicly
   - Use a strong, unique password

2. **Firebase Security Rules:**
   - Admin operations (product management) restricted to admin email
   - User data protected per user
   - Orders only viewable by admin

3. **Regular Updates:**
   - Keep admin password secure
   - Monitor Firestore database for unauthorized changes

4. **Deployment:**
   - Admin panel only deployed on dev-1 branch
   - Main branch doesn't expose admin tools

---

## 📱 Project Structure

```
frontend/
├── login/
│   ├── index.html       # Login & signup page
│   ├── auth.js          # Authentication logic
│   └── style.css        # Login page styles
├── admin/
│   ├── index.html       # Admin dashboard
│   ├── admin.js         # Admin panel logic
│   └── style.css        # Admin dashboard styles
├── index.html           # Main homepage
├── js/
│   └── main.js          # Main app logic
└── css/
    └── style.css        # Main styles

backend/
├── js/
│   ├── firebase-config.js   # Firebase setup
│   ├── auth.js              # Authentication functions
│   ├── db.js                # Database functions
│   └── admin.js             # Admin backend logic
└── help.txt

.github/
└── workflows/
    └── deploy.yml       # GitHub Pages deployment
```

---

## 🔧 Troubleshooting

### Issue: "Unauthorized admin access attempted"
**Solution:** Verify that:
1. Admin email in `auth.js` matches the email in `admin.js`
2. Firebase user account exists with the correct admin email
3. Credentials are entered correctly

### Issue: Admin redirect loop
**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Check browser console for errors
3. Verify Firebase config in `firebase-config.js`

### Issue: Products not saving
**Solution:**
1. Check Firestore security rules
2. Verify admin email matches Firebase user
3. Check browser console for errors
4. Ensure all required product fields are filled

### Issue: Tables showing "No data"
**Solution:**
1. Wait a moment for data to load
2. Check browser console for errors
3. Verify Firestore database contains data
4. Check network requests in DevTools

---

## 📊 Firebase Collections Schema

### Products Collection
```javascript
{
  name: "Product Name",           // string
  price: 999,                     // number
  stock: 100,                     // number
  image: "https://...",           // string
  description: "...",             // string
  category: "Electronics",        // string
  createdAt: Timestamp,           // firebase timestamp
  updatedAt: Timestamp,           // firebase timestamp
  isActive: true                  // boolean
}
```

### Orders Collection
```javascript
{
  userId: "user_uid",             // string
  userEmail: "user@email.com",    // string
  items: [
    {
      productId: "prod_123",
      name: "Product Name",
      price: 999,
      quantity: 1
    }
  ],                              // array
  totalAmount: 999,               // number
  status: "pending",              // string
  createdAt: Timestamp            // firebase timestamp
}
```

### Users Collection
```javascript
{
  email: "user@email.com",        // string
  displayName: "User Name",       // string
  createdAt: Timestamp            // firebase timestamp
}
```

---

## 📞 Support & Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [GitHub Pages Deployment](https://docs.github.com/en/pages)

---

## ✅ Checklist for First Time Setup

- [ ] Update `ADMIN_EMAIL` in `frontend/login/auth.js`
- [ ] Update `ADMIN_EMAIL` in `backend/js/admin.js`
- [ ] Create Firebase user with admin email
- [ ] Test admin login at `/login/`
- [ ] Verify admin panel at `/admin/`
- [ ] Set Firestore security rules
- [ ] Test product creation
- [ ] Configure GitHub Actions for deployment
- [ ] Deploy dev-1 branch with admin panel
- [ ] Deploy main branch without admin panel

---

**Last Updated:** January 2026
**Version:** 1.0
**Status:** Production Ready ✅
