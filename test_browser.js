const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
        page.on('requestfailed', request => {
            console.error('REQUEST FAILED:', request.url(), request.failure().errorText);
        });

        console.log('Navigating to specific page...');
        await page.goto('http://localhost:3000/inventory', { waitUntil: 'networkidle2', timeout: 8000 });
        
        console.log('Capture local storage just in case:');
        const ls = await page.evaluate(() => JSON.stringify(localStorage));
        console.log(ls);
        
        console.log('Done.');
        await browser.close();
    } catch (err) {
        console.error('SCRIPT ERROR:', err.message);
    }
})();
