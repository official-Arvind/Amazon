const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../../')));

const server = app.listen(3004, async () => {
    console.log('Server started on port 3004');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3004/frontend/index.html');
    
    // Inject and run query
    await page.evaluate(async () => {
        try {
            const authModule = await import('../backend/js/auth.js');
            const { db } = await import('../backend/js/firebase-config.js');
            const { collection, query, where, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
            
            console.log('Registering test user...');
            const email = 'test' + Date.now() + '@example.com';
            const user = await authModule.signUpWithEmail(email, 'Password123!', 'Test User');
            
            console.log('User created:', user.uid);
            
            console.log('Executing test query...');
            const ordersRef = collection(db, 'orders');
            // Deliberately query by userId and sort by total to force an index error
            const q = query(ordersRef, where('userId', '==', user.uid), orderBy('total', 'desc'));
            await getDocs(q);
            console.log('Test query executed successfully (should not happen!).');
        } catch (e) {
            console.error('ERROR from query:', e.message);
        }
    });
    
    await browser.close();
    server.close();
});
