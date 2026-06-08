const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../../')));

const server = app.listen(3003, async () => {
    console.log('Server started on port 3003');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3003/frontend/index.html');
    
    // Inject and run query
    await page.evaluate(async () => {
        try {
            const authModule = await import('../backend/js/auth.js');
            const dbModule = await import('../backend/js/db.js');
            
            console.log('Registering test user...');
            const email = 'test' + Date.now() + '@example.com';
            const user = await authModule.signUpWithEmail(email, 'Password123!', 'Test User');
            
            console.log('User created:', user.uid);
            console.log('Executing getOrders...');
            
            await dbModule.getOrders(user.uid);
            console.log('getOrders executed successfully without error.');
        } catch (e) {
            console.error('ERROR from getOrders:', e.message);
        }
    });
    
    await browser.close();
    server.close();
});
