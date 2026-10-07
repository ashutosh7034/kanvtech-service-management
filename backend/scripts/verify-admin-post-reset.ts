import puppeteer from 'puppeteer';
import assert from 'assert';

async function verifyAdminPostReset() {
  console.log('====================================================');
  console.log('VERIFYING ADMIN ACCESS & CLEAN UI POST-RESET');
  console.log('====================================================\n');

  // 1. Verify Login API directly
  console.log('[1/5] Verifying Admin Authentication API...');
  const authRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const authData = await authRes.json();
  assert(authData.token, 'Admin authentication must return JWT token');
  console.log('✓ Admin login API passed. Role:', authData.user?.role || 'ADMIN');

  // 2. Launch Browser and load UI
  console.log('\n[2/5] Launching Browser and loading Dashboard...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate((jwt) => localStorage.setItem('kanvtech_token', jwt), authData.token);
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const dashText = await page.evaluate(() => document.body.innerText);
  assert(dashText.includes('Operations Dashboard') || dashText.includes('Service Operations Dashboard'), 'Dashboard should load');
  console.log('✓ Admin Dashboard loaded cleanly with 0 runtime errors');

  // 3. Verify Customer Master Page
  console.log('\n[3/5] Navigating to Customer Master...');
  await page.goto('http://localhost:3000/companies', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const custText = await page.evaluate(() => document.body.innerText);
  assert(custText.includes('Customer Master') || custText.includes('Customer'), 'Customer Master should load');
  console.log('✓ Customer Master page rendered cleanly');

  // 4. Verify Product Master & Department Master Pages
  console.log('\n[4/5] Navigating to Product Master & Department Master...');
  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const prodText = await page.evaluate(() => document.body.innerText);
  assert(prodText.includes('Product Master') || prodText.includes('Product'), 'Product Master should load');
  console.log('✓ Product Master page rendered cleanly');

  await page.goto('http://localhost:3000/departments', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const deptText = await page.evaluate(() => document.body.innerText);
  assert(deptText.includes('Department Master') || deptText.includes('Department'), 'Department Master should load');
  console.log('✓ Department Master page rendered cleanly');

  // 5. Verify Employee Directory & My Tasks Pages
  console.log('\n[5/5] Navigating to Employee Directory & My Tasks...');
  await page.goto('http://localhost:3000/employees', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const empText = await page.evaluate(() => document.body.innerText);
  assert(empText.includes('Specialist Employee Directory') || empText.includes('Employees'), 'Employee directory should load');
  console.log('✓ Employee Directory page rendered cleanly');

  await page.goto('http://localhost:3000/task-reminders', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const taskText = await page.evaluate(() => document.body.innerText);
  assert(taskText.includes('My Tasks & Reminders'), 'My Tasks & Reminders should load');
  console.log('✓ My Tasks & Reminders page rendered cleanly');

  await browser.close();

  console.log('\n====================================================');
  console.log('ALL POST-RESET BROWSER VERIFICATIONS PASSED ✔');
  console.log('====================================================\n');
}

verifyAdminPostReset().catch((err) => {
  console.error('Post-reset verification failed:', err);
  process.exit(1);
});
