const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../../frontend')));

const PORT = 3001;
const server = app.listen(PORT, async () => {
    console.log(`Server started on port ${PORT}`);
    const browser = await puppeteer.launch({ headless: "new" });
    const pagesToVisit = [
        '/',
        '/profile/',
        '/cart/',
        '/checkout/',
        '/shop/',
        '/product/?id=1',
        '/login/'
    ];

    let hasErrors = false;

    for (const p of pagesToVisit) {
        const page = await browser.newPage();
        
        page.on('pageerror', err => {
            console.error(`PAGE ERROR on ${p}:`, err.message);
            hasErrors = true;
        });
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`CONSOLE ERROR on ${p}:`, msg.text());
                hasErrors = true;
            }
        });

        try {
            await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: 'networkidle2' });
        } catch (err) {
            console.error(`GOTO ERROR on ${p}:`, err.message);
            hasErrors = true;
        }
        await page.close();
    }

    await browser.close();
    server.close();
    if (hasErrors) {
        process.exit(1);
    } else {
        console.log("No client-side errors found!");
        process.exit(0);
    }
});
