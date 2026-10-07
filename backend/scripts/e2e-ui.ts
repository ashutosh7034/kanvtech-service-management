import puppeteer from 'puppeteer';

async function runTests() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000');
    
    // 1. Login
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@kanvtech.com');
    await page.type('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('.nav-item');
    console.log('[PASS] Login successful');
    
    console.log('All UI E2E Smoke Tests PASSED!');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
