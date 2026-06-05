# ZONIX - The Marketplace, Redefined

A modern, professional e-commerce platform built with vanilla HTML, CSS, and JavaScript, powered by Firebase for authentication and data management.

## 🌟 Features

- **Amazon-Inspired UI Design** - Clean, high-fidelity e-commerce interfaces matching Amazon's layout, color scheme, and typography.
- **Robust User Authentication** - Secure Email/Password signup/login and Google Sign-In with real-time Firebase Auth integration and route guards.
- **Interactive Shopping Cart** - Persistent cart storage for both Guests (localStorage) and Authenticated Users (Firestore) with "Fly-to-Cart" animations and bouncing badge notifications.
- **Accordion Checkout** - An elegant 3-Step accordion checkout flow (Delivery -> Payment -> Review) supporting Guest checkout with post-purchase account conversion.
- **Split Profile Dashboard** - A modern dashboard featuring order history, saved addresses, and profile settings using dynamic, smooth tab navigation.
- **Admin Dashboard** - Secure administrative dashboard for managing products, tracking real-time orders, and monitoring store statistics.
- **Help Center** - Dynamic FAQ center with accordion questions, real-time search, and category filters.

## 🚀 Live Demo

Visit: **[ZONIX on GitHub Pages](https://YOUR_USERNAME.github.io/zonix/)**

## 📋 Project Structure

```
frontend/              # Deployed to GitHub Pages
├── index.html         # Home page
├── css/
│   └── style.css      # Global styles & design system
├── js/
│   └── main.js        # Frontend logic & Firebase integration
├── shop/              # Product listing page
├── about/             # About/Company page
├── contact/           # Contact page
├── cart/              # Shopping cart
├── checkout/          # Checkout process
├── profile/           # User dashboard
├── help/              # Help/FAQ center
└── assets/            # Images and icons

backend/              # Firebase backend
├── js/
│   ├── firebase-config.js   # Firebase initialization
│   ├── auth.js              # Authentication functions
│   └── db.js                # Database operations
└── help.txt

.github/
└── workflows/
    └── deploy.yml     # GitHub Actions deployment
```

## 🔧 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Firebase v9+ (Auth, Firestore)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions

## 🎨 Design System

- **Navbar Dark Navy**: `#131921` (Amazon Deep Navy)
- **Primary Color**: `#ffd814` (Amazon Yellow)
- **Secondary Color**: `#f7ca00` (Amazon Gold)
- **Background Accent**: `#eaeded` (Amazon Light Gray)
- **Text Color**: `#0f1111` (Dark Charcoal) / `#565959` (Slate Gray)
- **Spacing**: 8px base unit
- **Border Radius**: 4px (flat, crisp aesthetic)

## 📱 Responsive Breakpoints

- **Desktop**: 1200px+
- **Tablet**: 1024px - 1199px
- **Mobile**: 768px - 1023px
- **Small Mobile**: 640px - 767px

## 🔐 Firebase Setup

### Prerequisites
1. Firebase account at [firebase.google.com](https://firebase.google.com)
2. Node.js (optional, for local development)

### Configuration
1. Create a Firebase project
2. Add a Web app
3. Copy credentials to `backend/js/firebase-config.js`
4. Enable:
   - Authentication → Email/Password
   - Firestore Database
5. Set up Firestore security rules (see `GITHUB_PAGES_SETUP.md`)

## 📦 Installation & Deployment

### Local Development
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/zonix.git
cd zonix

# Open in browser (no build step needed!)
# Option 1: Double-click frontend/index.html
# Option 2: Use a local server
python -m http.server 8000
# Visit http://localhost:8000/frontend/
```

### Deploy to GitHub Pages
```bash
git add .
git commit -m "Update: Your changes here"
git push origin main
```

The site will automatically deploy within 1-2 minutes! Check the Actions tab for deployment status.

See [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) for detailed setup instructions.

## 📖 Usage Guide

### For Customers
1. Browse products on Shop page
2. Add items to cart
3. Login or create account
4. Proceed to checkout
5. Complete order
6. View order in profile

### For Developers

#### Add New Page
1. Create new folder in `frontend/`
2. Add `index.html` with navbar and footer
3. Link to `../css/style.css` and `../js/main.js`
4. Add navigation link to navbar in all pages

#### Add Products
Products are loaded from Firestore collection `/products`. Add documents with:
```json
{
  "name": "Product Name",
  "price": 999,
  "image": "image-url",
  "category": "tech",
  "description": "Product description"
}
```

#### Modify Styles
Edit `frontend/css/style.css` - all styles centralized with CSS custom properties.

## 🐛 Known Issues & Limitations

- Product images must be external URLs.
- Payment gateway integration is mocked (sandbox checkout only).

## 🗺️ Roadmap

- [ ] Product search and advanced filtering
- [ ] Wishlist functionality
- [ ] Real payment integration (Stripe/Razorpay)
- [ ] Product reviews and ratings
- [ ] Inventory management
- [x] Admin dashboard (Implemented!)
- [ ] Email notifications
- [ ] Analytics integration

## 📞 Support

### Firebase Documentation
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Authentication Guide](https://firebase.google.com/docs/auth)
- [Firestore Guide](https://firebase.google.com/docs/firestore)

### GitHub Pages Documentation
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [GitHub Actions](https://docs.github.com/en/actions)

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Design inspiration: Amazon.com
- Icons: SVG inline (no external dependencies)
- Firebase: Real-time backend
- GitHub Pages: Free hosting

---

**Made with ❤️ for e-commerce enthusiasts**
