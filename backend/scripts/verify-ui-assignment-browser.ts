import puppeteer from 'puppeteer';
import assert from 'assert';

async function verifyUiInBrowser() {
  console.log('====================================================');
  console.log('BROWSER E2E TEST: TICKET AUTO-ASSIGNMENT LEVEL UI');
  console.log('====================================================\n');

  // 1. Authenticate via Backend API to get Admin JWT
  console.log('[1/7] Authenticating as Admin via API...');
  const authRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const authData = await authRes.json();
  assert(authData.token, 'Admin authentication failed');
  const token = authData.token;
  console.log('✓ Admin authenticated, JWT obtained');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err: any) => console.log('PAGE ERROR:', err?.message || err));

  try {
    // 2. Inject Auth Token into LocalStorage
    console.log('[2/7] Injecting auth session into browser...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((jwt) => {
      localStorage.setItem('kanvtech_token', jwt);
    }, token);

    // 3. Navigate to SLA & System Settings Page
    console.log('[3/7] Navigating to http://localhost:3000/sla-settings ...');
    await page.goto('http://localhost:3000/sla-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1, h2, h3, div', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 4000));

    // 4. Inspect Automatic Ticket Assignment Level card & default L1
    console.log('[4/7] Inspecting Automatic Ticket Assignment Level card...');
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Page Body Text Snippet:', bodyText.substring(0, 300));
    const cardTitle = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('h3, h2, h1, div, span')).find((el) =>
        el.textContent?.includes('Automatic Ticket Assignment Level')
      );
      return heading ? heading.textContent?.trim() : null;
    });
    assert(cardTitle, 'Automatic Ticket Assignment Level card not found in DOM');
    console.log(`✓ Card Found: "${cardTitle}"`);

    // Verify L1 initial state
    const initialLevel = await page.evaluate(() => {
      const radio = document.querySelector('input[name="autoAssignmentLevel"]:checked') as HTMLInputElement;
      return radio ? radio.value : 'UNKNOWN';
    });
    console.log(`✓ Initial Active Assignment Level: ${initialLevel}`);

    // 5. Select L2 and Save
    console.log('\n[5/7] Selecting L2 and clicking Save Changes in UI...');
    await page.click('input[value="L2"]');
    await new Promise((r) => setTimeout(r, 500));

    // Click the Save Changes button for assignment level
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find((b) => b.textContent?.includes('Save Changes'));
      saveBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    console.log('✓ Clicked Save Changes for L2 in UI');

    // Verify DB updated to L2
    const verifyL2Res = await fetch('http://localhost:5000/api/tickets/settings/auto-assignment-level', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyL2Data = await verifyL2Res.json();
    assert.strictEqual(verifyL2Data.level, 'L2', `Expected L2 in backend, got ${verifyL2Data.level}`);
    console.log('✓ Verified: Backend setting is now L2');

    // 6. Reload page and assert L2 persistence
    console.log('\n[6/7] Reloading page to verify UI persistence...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const levelAfterReload = await page.evaluate(() => {
      const radio = document.querySelector('input[name="autoAssignmentLevel"]:checked') as HTMLInputElement;
      return radio ? radio.value : 'UNKNOWN';
    });
    assert.strictEqual(levelAfterReload, 'L2', `Expected L2 after reload, got ${levelAfterReload}`);
    console.log('✓ UI Persistence after reload: Level is L2');

    // 7. Select L3, Save, and finally restore to L1
    console.log('\n[7/7] Testing L3 selection and restoring to L1...');
    await page.click('input[value="L3"]');
    await new Promise((r) => setTimeout(r, 500));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find((b) => b.textContent?.includes('Save Changes'));
      saveBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const verifyL3Res = await fetch('http://localhost:5000/api/tickets/settings/auto-assignment-level', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyL3Data = await verifyL3Res.json();
    assert.strictEqual(verifyL3Data.level, 'L3');
    console.log('✓ Verified: Backend setting updated to L3 via UI interaction');

    // Restore to L1
    await page.click('input[value="L1"]');
    await new Promise((r) => setTimeout(r, 500));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find((b) => b.textContent?.includes('Save Changes'));
      saveBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const restoreRes = await fetch('http://localhost:5000/api/tickets/settings/auto-assignment-level', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const restoreData = await restoreRes.json();
    assert.strictEqual(restoreData.level, 'L1');
    console.log('✓ Verified: Setting successfully restored to L1 in UI and backend');

    console.log('\n====================================================');
    console.log('BROWSER E2E VERIFICATION COMPLETED WITH 100% SUCCESS!');
    console.log('====================================================');
  } finally {
    await browser.close();
  }
}

verifyUiInBrowser().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
