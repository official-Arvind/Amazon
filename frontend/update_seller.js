const fs = require("fs");
const path = require("path");

const sellerPath = path.join(__dirname, "seller", "index.html");
let content = fs.readFileSync(sellerPath, "utf8");

const newSellerContent = `
    <!-- Hero Section -->
    <section class="hero" style="background: linear-gradient(135deg, #131921 0%, #37475a 100%); padding: 120px 20px; text-align: center; color: white;">
        <div class="hero-wrapper" style="max-width: 800px; margin: 0 auto;">
            <h1 style="font-size: 3.5rem; margin-bottom: 20px; color: #fff;">Grow Your Business with ZONIX</h1>
            <p style="font-size: 1.3rem; margin-bottom: 40px; color: #ddd; line-height: 1.6;">
                Join India's most transparent marketplace. Reach millions of engaged customers with lower fees, faster payouts, and dedicated support.
            </p>
            <a href="../contact/" style="background: #f3a847; color: #111; padding: 15px 40px; font-size: 1.2rem; font-weight: bold; border-radius: 4px; text-decoration: none; display: inline-block; transition: background 0.3s;">Start Selling Today</a>
        </div>
    </section>

    <!-- Why Sell on ZONIX -->
    <section style="background: #fff; padding: 80px 20px;">
        <div style="max-width: 1200px; margin: 0 auto;">
            <h2 style="font-size: 2.5rem; text-align: center; color: #111; margin-bottom: 50px;">Why Sell on ZONIX?</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px;">
                <div style="text-align: center; padding: 30px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 4rem; margin-bottom: 20px;">💰</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 15px;">Lower Fees than Amazon</h3>
                    <p style="color: #555; line-height: 1.6;">Keep more of what you earn. Our commission structures are transparent and significantly lower than competitors, allowing you to price competitively.</p>
                </div>
                <div style="text-align: center; padding: 30px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 4rem; margin-bottom: 20px;">⚡</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 15px;">Faster Payouts</h3>
                    <p style="color: #555; line-height: 1.6;">No more waiting 14 days for your money. Receive your funds within 48 hours of successful delivery.</p>
                </div>
                <div style="text-align: center; padding: 30px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🤝</div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 15px;">Dedicated Support</h3>
                    <p style="color: #555; line-height: 1.6;">Speak to real humans. You get a dedicated account manager to help you onboard, optimize listings, and grow your sales.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Testimonials -->
    <section style="background: #f7f7f7; padding: 80px 20px;">
        <div style="max-width: 1200px; margin: 0 auto;">
            <h2 style="font-size: 2.5rem; text-align: center; color: #111; margin-bottom: 50px;">What Our Sellers Say</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="color: #f3a847; font-size: 1.2rem; margin-bottom: 15px;">★★★★★</div>
                    <p style="font-style: italic; color: #444; margin-bottom: 20px; line-height: 1.6;">"Moving to ZONIX was the best decision for our electronics brand. The lower fees meant we could pass savings to customers, doubling our sales volume in just 3 months."</p>
                    <div style="font-weight: bold; color: #111;">— Rahul Sharma, TechGear India</div>
                </div>
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="color: #f3a847; font-size: 1.2rem; margin-bottom: 15px;">★★★★★</div>
                    <p style="font-style: italic; color: #444; margin-bottom: 20px; line-height: 1.6;">"The transparency is refreshing. I know exactly what I'm being charged and why. Plus, the 48-hour payouts keep our cash flow healthy."</p>
                    <div style="font-weight: bold; color: #111;">— Priya Patel, Elegant Attire</div>
                </div>
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="color: #f3a847; font-size: 1.2rem; margin-bottom: 15px;">★★★★★</div>
                    <p style="font-style: italic; color: #444; margin-bottom: 20px; line-height: 1.6;">"Whenever I have an issue, I just call my dedicated account manager. No automated bots, no endless tickets. Just real, helpful support."</p>
                    <div style="font-weight: bold; color: #111;">— Vikram Singh, HomeEssentials</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Final CTA -->
    <section style="background: #232f3e; padding: 60px 20px; text-align: center; color: white;">
        <h2 style="font-size: 2.2rem; margin-bottom: 20px;">Ready to reach more customers?</h2>
        <p style="font-size: 1.2rem; margin-bottom: 30px; color: #ddd;">Join thousands of successful sellers on ZONIX.in</p>
        <a href="../contact/" style="background: #f3a847; color: #111; padding: 15px 40px; font-size: 1.2rem; font-weight: bold; border-radius: 4px; text-decoration: none; display: inline-block;">Start Selling Today</a>
    </section>
`;

content = content.replace(/<title>.*?<\/title>/, "<title>Sell on ZONIX</title>");
content = content.replace(/<!-- Hero Section -->[\s\S]*?<!-- Footer -->/, newSellerContent + "\n\n    <!-- Footer -->");
fs.writeFileSync(sellerPath, content);
console.log("Seller page updated.");
