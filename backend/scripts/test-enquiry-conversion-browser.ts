import puppeteer from 'puppeteer';
import assert from 'assert';

async function runEnquiryBrowserTest() {
  console.log('====================================================');
  console.log('BROWSER E2E TEST: ENQUIRY TERMINOLOGY & CONVERT MODAL');
  console.log('====================================================\n');

  // 1. Authenticate via Backend API to get Admin JWT
  console.log('[1/14] Authenticating as Admin via API...');
  const authRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const authData = await authRes.json();
  assert(authData.token, 'Admin authentication failed');
  const token = authData.token;
  console.log('✓ Admin authenticated, JWT obtained');

  // Create a test enquiry via API to test UI conversion
  const ts = Date.now();
  const testEnquiryRes = await fetch('http://localhost:5000/api/prospects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      companyName: `Test Horizon HorizonCorp ${ts}`,
      contactPerson: 'Aditya Sharma',
      phone: '+91 9876543210',
      email: `aditya_${ts}@horizoncorp.com`,
      enquiry: 'Looking for ERP & HRMS suite for 500 users',
      source: 'Website',
    }),
  });
  const enquiryData = await testEnquiryRes.json();
  console.log(`✓ Test Enquiry Created: ${enquiryData.id || enquiryData.prospect?.id || 'ID OK'}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 2. Inject Auth Token into LocalStorage
    console.log('[2/14] Setting auth session in browser...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((jwt) => {
      localStorage.setItem('kanvtech_token', jwt);
    }, token);

    // 3. Navigate to Main Portal (loads App.tsx) and click Enquiries in Sidebar
    console.log('[3/14] Navigating to portal and verifying Enquiries menu in Sidebar...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const sidebarText = await page.evaluate(() => document.querySelector('.sidebar')?.textContent || '');
    assert(sidebarText.includes('Enquiries'), 'Sidebar does not show "Enquiries"');
    console.log('✓ Sidebar shows "Enquiries" menu item');

    // Click on Enquiries
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.nav-item')).find((b) =>
        b.textContent?.includes('Enquiries')
      );
      if (btn) (btn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // 4. Verify Enquiries Header Terminology
    console.log('[4/14] Verifying Enquiries Page terminology...');
    const pageContent = await page.evaluate(() => document.body.innerText);
    assert(pageContent.includes('Enquiries'), 'Header does not contain "Enquiries"');
    assert(pageContent.includes('New Enquiry'), 'Button does not say "New Enquiry"');
    assert(pageContent.includes('Enquiry ID'), 'Table header does not say "Enquiry ID"');
    console.log('✓ User-facing terminology verified: Enquiries, New Enquiry, Enquiry ID');

    // 5. Locate Convert button and click it
    console.log('[5/14] Clicking "Convert to Customer" button on enquiry...');
    const targetName = `Test Horizon HorizonCorp ${ts}`;
    await page.waitForSelector('table tbody tr', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1500));

    const rowLogs = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map((r) => r.textContent?.trim());
    });
    console.log('DOM Rows found:', rowLogs);

    const convertBtnClicked = await page.evaluate((companyName: string) => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const row = rows.find((r) => r.textContent?.includes(companyName)) || rows[0];
      if (!row) return false;
      const convertBtn = Array.from(row.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Convert')
      );
      if (convertBtn) {
        (convertBtn as HTMLElement).click();
        return true;
      }
      return false;
    }, targetName);
    assert(convertBtnClicked, 'Could not find or click "Convert to Customer" button');
    await new Promise((r) => setTimeout(r, 1200));

    // 6. Verify Convert Modal Opened with Prominent Close (X) button
    console.log('[6/14] Verifying Convert Modal opened with header and X button...');
    const modalHeader = await page.evaluate(() => {
      const h3 = document.querySelector('h3');
      const xBtn = document.querySelector('button[title*="Close"]');
      return {
        text: document.body.innerText,
        hasXBtn: !!xBtn,
      };
    });
    assert(modalHeader.text.includes('Convert Enquiry to Customer'), 'Modal title is not "Convert Enquiry to Customer"');
    assert(modalHeader.hasXBtn, 'Modal does not have a Close (X) button');
    assert(modalHeader.text.includes('This enquiry will become a Customer account.'), 'Missing descriptive conversion message');
    assert(modalHeader.text.includes('Customer ID will be generated automatically.'), 'Missing automatic customer ID message');
    assert(modalHeader.text.includes('Select Initial Products'), 'Label does not say "Select Initial Products"');
    console.log('✓ Convert Modal verified with "Convert Enquiry to Customer", message, and X button');

    // 7. Test Close (X) button closes modal
    console.log('[7/14] Testing Close (X) button closes the modal...');
    await page.evaluate(() => {
      const xBtn = document.querySelector('button[title*="Close"]') as HTMLElement;
      if (xBtn) xBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const isClosedAfterX = await page.evaluate(() => {
      return !document.body.innerText.includes('Convert Enquiry to Customer');
    });
    assert(isClosedAfterX, 'Modal did not close after clicking X button');
    console.log('✓ X button successfully closed the modal');

    // 8. Reopen Modal and test Cancel button
    console.log('[8/14] Reopening modal and testing Cancel button...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const convertBtn = Array.from(rows[0]?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Convert')
      );
      if (convertBtn) (convertBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Cancel'
      ) as HTMLElement;
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const isClosedAfterCancel = await page.evaluate(() => {
      return !document.body.innerText.includes('Convert Enquiry to Customer');
    });
    assert(isClosedAfterCancel, 'Modal did not close after clicking Cancel button');
    console.log('✓ Cancel button successfully closed the modal');

    // 9. Reopen Modal, select products, and complete conversion
    console.log('[9/14] Reopening modal to perform full customer conversion...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const convertBtn = Array.from(rows[0]?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Convert')
      );
      if (convertBtn) (convertBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    // 10. Select initial products in modal
    console.log('[10/14] Verifying initial products selected in modal...');
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    const isChecked = await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      return checkbox ? checkbox.checked : false;
    });
    if (!isChecked) {
      await page.click('input[type="checkbox"]');
    }
    await new Promise((r) => setTimeout(r, 600));

    // 11. Click "Create Customer" button
    console.log('[11/14] Clicking "Create Customer" button...');
    await page.evaluate(() => {
      const modal = document.querySelector('.modal-content') || document.querySelector('form');
      const createBtn = Array.from(modal?.querySelectorAll('button') || []).find(
        (b) => b.textContent?.includes('Create Customer')
      );
      if (createBtn) (createBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 3500));

    // 12. Verify status changed to CONVERTED with CMP-XXXX link
    console.log('[12/14] Verifying enquiry status updated to CONVERTED with CMP-XXXX...');
    const updatedEnquiryText = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tbody tr'))[0];
      return row ? row.textContent : '';
    });
    console.log('Updated Enquiry Row Text:', updatedEnquiryText);
    assert(updatedEnquiryText?.includes('CONVERTED'), 'Enquiry status is not CONVERTED');
    assert(updatedEnquiryText?.includes('CMP-'), 'Enquiry row does not show generated CMP-XXXX customer ID');
    console.log(`✓ Enquiry marked CONVERTED with customer ID: ${updatedEnquiryText?.match(/CMP-\d+/)?.[0] || 'CMP-XXXX'}`);

    // 13. Navigate to Customer Master via Sidebar
    console.log('[13/14] Navigating to Customer Master in Sidebar to verify created Customer...');
    await page.evaluate(() => {
      const custBtn = Array.from(document.querySelectorAll('.nav-item')).find((b) =>
        b.textContent?.includes('Customer Master')
      );
      if (custBtn) (custBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    // 14. Verify Customer exists in Customer Master
    console.log('[14/14] Verifying customer in Customer Master...');
    const customerMasterText = await page.evaluate(() => document.body.innerText);
    assert(customerMasterText.includes(`Test Horizon HorizonCorp ${ts}`), 'Converted customer not found in Customer Master');
    console.log(`✓ Converted Customer "Test Horizon HorizonCorp ${ts}" successfully present in Customer Master!`);

    console.log('\n====================================================');
    console.log('BROWSER E2E TEST: ALL 14 VERIFICATIONS PASSED ✔');
    console.log('====================================================\n');
  } finally {
    await browser.close();
  }
}

runEnquiryBrowserTest().catch((err) => {
  console.error('BROWSER TEST FAILED:', err);
  process.exit(1);
});
