const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');

const rootPath = 'd:\\Desktop\\Website\\Amazon';
const port = 8080;

const app = express();
app.use(express.static(rootPath));

const server = app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
    runAudit();
});

const pages = [
    { name: 'Home', url: `http://localhost:${port}/frontend/` },
    { name: 'Profile', url: `http://localhost:${port}/frontend/profile/` },
    { name: 'Cart', url: `http://localhost:${port}/frontend/cart/` },
    { name: 'Checkout', url: `http://localhost:${port}/frontend/checkout/` },
    { name: 'Shop', url: `http://localhost:${port}/frontend/shop/` },
    { name: 'PDP', url: `http://localhost:${port}/frontend/product/` },
    { name: 'Login', url: `http://localhost:${port}/frontend/login/` },
];

async function runAudit() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        const logs = {};
        let currentPage = '';

        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || type === 'warning' || text.includes('Firebase') || text.toLowerCase().includes('error') || text.includes('index') || text.includes('Index')) {
                if (currentPage) {
                    logs[currentPage].push(`[${type}] ${text}`);
                }
            }
        });

        page.on('pageerror', err => {
            if (currentPage) {
                logs[currentPage].push(`[pageerror] ${err.message}`);
            }
        });

        page.on('requestfailed', request => {
            if (currentPage && request.failure()) {
                logs[currentPage].push(`[requestfailed] ${request.url()} - ${request.failure().errorText}`);
            }
        });

        for (const p of pages) {
            currentPage = p.name;
            logs[currentPage] = [];
            console.log(`Navigating to ${p.name} (${p.url})...`);
            try {
                await page.goto(p.url, { waitUntil: 'networkidle0', timeout: 30000 });
                // wait an extra 5 seconds for any delayed Firebase index errors or renders
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (err) {
                logs[currentPage].push(`[navigation_error] ${err.message}`);
            }
        }

        fs.writeFileSync(path.join(__dirname, 'audit_logs2.json'), JSON.stringify(logs, null, 2));
        console.log('Audit complete. Logs saved to audit_logs2.json');

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        if (browser) await browser.close();
        server.close();
        process.exit(0);
    }
}
