const fs = require("fs");
const path = require("path");

const aboutPath = path.join(__dirname, "about", "index.html");
let content = fs.readFileSync(aboutPath, "utf8");

const newAboutContent = `
    <!-- Hero Section -->
    <section class="hero" id="about-hero" style="background: linear-gradient(135deg, #131921 0%, #37475a 100%); padding: 100px 20px; text-align: center; color: white;">
        <div class="hero-wrapper" style="max-width: 800px; margin: 0 auto;">
            <div class="hero-content">
                <h1 class="hero-title" style="font-size: 3rem; margin-bottom: 20px;">The ZONIX Story</h1>
                <p class="hero-subtitle" style="font-size: 1.2rem; color: #f3a847;">Founded by Arvind Ji to redefine the marketplace for India</p>
            </div>
        </div>
    </section>

    <!-- Mission Statement -->
    <section style="background: #fff; padding: 60px 20px; text-align: center;">
        <div style="max-width: 800px; margin: 0 auto;">
            <h2 style="font-size: 2rem; color: #111; margin-bottom: 20px;">Our Mission</h2>
            <p style="font-size: 1.5rem; font-style: italic; color: #555; line-height: 1.6;">
                "To make shopping transparent, fair, and joyful for every Indian."
            </p>
        </div>
    </section>

    <!-- The Arvind Ji Story -->
    <section style="background: #f7f7f7; padding: 80px 20px;">
        <div style="max-width: 1000px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 40px;">
            <div style="flex: 1; min-width: 300px;">
                <img src="../assets/images/placeholder.jpg" alt="Arvind Ji" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            </div>
            <div style="flex: 1; min-width: 300px;">
                <h2 style="font-size: 2rem; color: #111; margin-bottom: 20px;">Founded by Arvind Ji</h2>
                <p style="font-size: 1.1rem; color: #444; line-height: 1.8; margin-bottom: 15px;">
                    Arvind Ji recognized a gap in the Indian e-commerce landscape: a lack of genuine transparency and a disconnect between marketplaces and both buyers and sellers. 
                </p>
                <p style="font-size: 1.1rem; color: #444; line-height: 1.8;">
                    With a vision to build a platform that champions fairness, he created ZONIX.in. Today, ZONIX stands as India's most transparent marketplace, dedicated to empowering local businesses and providing customers with an unparalleled shopping experience built on trust.
                </p>
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section style="background: #131921; padding: 60px 20px; color: white;">
        <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; text-align: center;">
            <div>
                <h3 style="font-size: 2.5rem; color: #f3a847; margin-bottom: 10px;">10K+</h3>
                <p style="font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">Products</p>
            </div>
            <div>
                <h3 style="font-size: 2.5rem; color: #f3a847; margin-bottom: 10px;">1M+</h3>
                <p style="font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">Happy Customers (projected)</p>
            </div>
            <div>
                <h3 style="font-size: 2.5rem; color: #f3a847; margin-bottom: 10px;">100%</h3>
                <p style="font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">Secure Payments</p>
            </div>
            <div>
                <h3 style="font-size: 2.5rem; color: #f3a847; margin-bottom: 10px;">24/7</h3>
                <p style="font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">Support</p>
            </div>
        </div>
    </section>

    <!-- Values Section -->
    <section style="padding: 80px 20px; background: #fff;">
        <div style="max-width: 1200px; margin: 0 auto;">
            <h2 style="font-size: 2rem; color: #111; margin-bottom: 40px; text-align: center;">Our Core Values</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
                <div style="padding: 30px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🔍</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 10px; color: #111;">Transparency</h3>
                    <p style="color: #555;">No hidden fees. Honest pricing and clear communication every step of the way.</p>
                </div>
                <div style="padding: 30px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">⭐</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 10px; color: #111;">Quality</h3>
                    <p style="color: #555;">We carefully vet all our products to ensure they meet the highest standards.</p>
                </div>
                <div style="padding: 30px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🚀</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 10px; color: #111;">Speed</h3>
                    <p style="color: #555;">Fast processing and delivery so you get what you need, when you need it.</p>
                </div>
                <div style="padding: 30px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🤝</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 10px; color: #111;">Trust</h3>
                    <p style="color: #555;">Building long-lasting relationships with our buyers and sellers based on mutual respect.</p>
                </div>
            </div>
        </div>
    </section>
`;

content = content.replace(/<!-- Hero Section -->[\s\S]*?<!-- Footer -->/, newAboutContent + "\n\n    <!-- Footer -->");
fs.writeFileSync(aboutPath, content);
console.log("About page updated.");
