const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../../')));

const server = app.listen(3000, async () => {
    console.log('Server started on port 3000');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Catch console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3000/frontend/index.html');
    
    // Inject and run query
    await page.evaluate(async () => {
        try {
            const module = await import('../backend/js/db.js');
            console.log('Executing getOrders...');
            await module.getOrders('test_user_id_123');
            console.log('getOrders executed successfully without error.');
        } catch (e) {
            console.error('ERROR from getOrders:', e.message);
        }
    });
    
    await browser.close();
    server.close();
});
