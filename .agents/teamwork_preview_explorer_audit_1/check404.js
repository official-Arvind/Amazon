const puppeteer = require('puppeteer');

async function check404() {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto('http://localhost:8080/frontend/', { waitUntil: 'networkidle0', timeout: 30000 });
        console.log('Done');
    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}
check404();
