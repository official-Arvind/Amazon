const fs = require('fs');
const path = require('path');

// 1. UPDATE CSS
const cssPath = path.join(__dirname, 'css', 'style.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

if (!cssContent.includes('padding-bottom: 70px')) {
    cssContent += `\n
/* Mobile Nav Fix */
@media (max-width: 768px) {
  body, main {
    padding-bottom: 70px !important;
  }
}
`;
    fs.writeFileSync(cssPath, cssContent);
    console.log('CSS updated with mobile nav fix.');
}

// 2. UPDATE MAIN.JS
const mainJsPath = path.join(__dirname, 'js', 'main.js');
let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// Insert renderFooter and backToTop logic, and updateMobileNav inside DOMContentLoaded
if (!mainJsContent.includes('renderFooter()')) {
    mainJsContent = mainJsContent.replace('initProducts();', `initProducts();\n  renderFooter();\n  initBackToTop();\n  updateMobileNav();`);
    
    const additionalFunctions = `
// =============================================
// NEW ADDITIONS
// =============================================
function renderFooter() {
    const inRoot = !window.location.pathname.includes('/frontend/') || window.location.pathname.endsWith('/frontend/') || window.location.pathname.endsWith('/frontend/index.html');
    const prefix = inRoot ? '' : '../';
    const currentYear = new Date().getFullYear();

    const footerHTML = \`
    <footer class="footer" style="background:#232f3e; color:white; padding-top:2rem;">
        <div class="footer-badges" style="display:flex; justify-content:space-around; flex-wrap:wrap; padding: 20px; border-bottom: 1px solid #3a4553; background-color: #37475a;">
            <span style="margin:10px;">🔒 Secure Payments</span>
            <span style="margin:10px;">🔄 Easy Returns</span>
            <span style="margin:10px;">🚀 Fast Delivery</span>
            <span style="margin:10px;">🇮🇳 Made for India</span>
        </div>
        <div class="footer-content" style="max-width: 1000px; margin: 0 auto; padding: 40px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div class="footer-section">
                <h4 style="color:white; margin-bottom:15px; font-size:16px;">Get to Know Us</h4>
                <ul style="list-style:none; padding:0; margin:0; line-height:2;">
                    <li><a href="\${prefix}about/" style="color:#ddd; text-decoration:none;">About ZONIX</a></li>
                    <li><a href="\${prefix}about/" style="color:#ddd; text-decoration:none;">Arvind Ji's Story</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h4 style="color:white; margin-bottom:15px; font-size:16px;">Connect with Us</h4>
                <ul style="list-style:none; padding:0; margin:0; line-height:2;">
                    <li><a href="#" style="color:#ddd; text-decoration:none;">Instagram</a></li>
                    <li><a href="#" style="color:#ddd; text-decoration:none;">Twitter/X</a></li>
                    <li><a href="#" style="color:#ddd; text-decoration:none;">LinkedIn</a></li>
                    <li><a href="#" style="color:#ddd; text-decoration:none;">YouTube</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h4 style="color:white; margin-bottom:15px; font-size:16px;">Make Money with Us</h4>
                <ul style="list-style:none; padding:0; margin:0; line-height:2;">
                    <li><a href="\${prefix}seller/" style="color:#ddd; text-decoration:none; font-weight:bold; color:#f3a847;">Sell on ZONIX</a></li>
                    <li><a href="\${prefix}seller/" style="color:#ddd; text-decoration:none;">Become an Affiliate</a></li>
                </ul>
            </div>
        </div>
        <div style="text-align:center; padding: 20px; border-top: 1px solid #3a4553;">
            <div style="font-size:20px; font-weight:bold; margin-bottom:10px;">ZONIX<span style="color:#f3a847">.in</span></div>
            <div style="color:#ddd; margin-bottom:15px;">ZONIX.in — Founded by Arvind Ji. India's most transparent marketplace.</div>
            <div style="font-size:12px; color:#aaa;">
                <a href="#" style="color:#aaa; text-decoration:none; margin:0 10px;">Conditions of Use</a>
                <a href="#" style="color:#aaa; text-decoration:none; margin:0 10px;">Privacy Notice</a>
                <a href="#" style="color:#aaa; text-decoration:none; margin:0 10px;">Sitemap</a>
                <br><br>
                &copy; \${currentYear} ZONIX.in. All rights reserved.
            </div>
        </div>
    </footer>
    \`;

    const existingFooter = document.querySelector('footer');
    if (existingFooter) {
        existingFooter.outerHTML = footerHTML;
    } else {
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
}

function initBackToTop() {
    const btn = document.createElement('div');
    btn.innerHTML = '↑';
    btn.style.cssText = 'position:fixed; bottom:80px; right:20px; width:40px; height:40px; background:#232f3e; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.3s; z-index:9999; font-size:20px; box-shadow:0 2px 5px rgba(0,0,0,0.3);';
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.style.opacity = '1';
        } else {
            btn.style.opacity = '0';
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function updateMobileNav() {
  const path = window.location.pathname;
  const navItems = document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    const href = item.getAttribute('href');
    if (href && href !== '#' && path.includes(href.replace('../', '').replace('./', ''))) {
      item.classList.add('active');
    }
  });
  if (path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/frontend/')) {
    if (navItems[0]) navItems[0].classList.add('active');
  }
}
`;
    fs.writeFileSync(mainJsPath, mainJsContent + additionalFunctions);
    console.log('main.js updated with footer, back-to-top, and mobile nav logic.');
}

// 3. FIX BRANDING IN ALL HTML FILES
function fixBranding(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixBranding(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = false;

            // Replace plain ZONIX with ZONIX.in in the logo
            // Need to match exactly what is used in shop/cart/checkout/profile/product/login
            const logoPattern1 = /<a[^>]*class="logo-text"[^>]*>\s*ZONIX\s*<\/a>/g;
            if (logoPattern1.test(content)) {
                content = content.replace(logoPattern1, (match) => {
                    return match.replace('ZONIX', 'ZONIX<span class="logo-in">.in</span>');
                });
                updated = true;
            }

            // In login page, there is a specific logo:
            const loginLogoPattern = /ZONIX\s*<svg viewBox="0 0 100 15"/g;
            if (loginLogoPattern.test(content)) {
                content = content.replace(loginLogoPattern, 'ZONIX<span class="logo-in" style="color:#f3a847">.in</span>\n              <svg viewBox="0 0 100 15"');
                updated = true;
            }

            if (updated) {
                fs.writeFileSync(fullPath, content);
                console.log('Branding updated in:', fullPath);
            }
        }
    });
}
fixBranding(__dirname);
