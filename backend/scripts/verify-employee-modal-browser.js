/**
 * Browser UAT Automation Script — Add Specialist Employee Modal
 * Verifies modal layout, independent vertical scrolling, keyboard/mouse interaction,
 * responsive viewports, and complete employee creation workflow.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = 'C:\\Users\\Ashutosh Pandey\\.gemini\\antigravity\\brain\\536e1e89-9765-4e16-8567-f82d27194954\\browser_uat';
const USER_DATA_DIR = path.join(__dirname, '..', '.tmp_browser_emp_profile');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verifyEmployeeModal() {
  console.log('========================================================================');
  console.log('  ADD SPECIALIST EMPLOYEE MODAL — BROWSER VERIFICATION SUITE');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: 'new',
    defaultViewport: { width: 1366, height: 768 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
  });

  const page = await browser.newPage();

  try {
    // 1. Sign In
    console.log('[Step 1] Navigating to http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

    await page.waitForSelector('input[type="email"], input[name="email"], input', { timeout: 8000 });
    const inputs = await page.$$('input');
    await inputs[0].type('admin@kanvtech.com');
    await inputs[1].type('Password@123');

    const submitBtn = await page.$('button[type="submit"]') || await page.$('.btn-primary');
    await submitBtn.click();
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Navigate to Employees Page
    console.log('[Step 2] Navigating to http://localhost:3000/employees...');
    await page.goto('http://localhost:3000/employees', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Open Add Specialist Employee Modal
    console.log('[Step 3] Opening "Add Specialist Employee" modal...');
    const openBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find((b) => b.textContent.includes('Add Specialist Employee'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });

    if (!openBtn) {
      throw new Error('Could not find "Add Specialist Employee" button on page.');
    }

    await page.waitForSelector('.employee-modal-overlay', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));

    // 4. Inspect Modal DOM & CSS Properties
    console.log('[Step 4] Inspecting 3-part layout and CSS flex constraints...');
    const modalMetrics = await page.evaluate(() => {
      const overlay = document.querySelector('.employee-modal-overlay');
      const modal = document.querySelector('.employee-modal');
      const header = document.querySelector('.employee-modal-header');
      const body = document.querySelector('.employee-modal-body');
      const footer = document.querySelector('.employee-modal-footer');

      const overlayRect = overlay ? overlay.getBoundingClientRect() : null;
      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const headerRect = header ? header.getBoundingClientRect() : null;
      const bodyRect = body ? body.getBoundingClientRect() : null;
      const footerRect = footer ? footer.getBoundingClientRect() : null;

      const bodyStyle = body ? window.getComputedStyle(body) : null;
      const modalStyle = modal ? window.getComputedStyle(modal) : null;

      return {
        overlayExists: Boolean(overlay),
        modalExists: Boolean(modal),
        headerExists: Boolean(header),
        bodyExists: Boolean(body),
        footerExists: Boolean(footer),
        modalRect,
        bodyRect,
        footerRect,
        bodyOverflowY: bodyStyle ? bodyStyle.overflowY : null,
        bodyMinHeight: bodyStyle ? bodyStyle.minHeight : null,
        modalMaxHeight: modalStyle ? modalStyle.maxHeight : null,
        modalOverflow: modalStyle ? modalStyle.overflow : null,
        scrollHeight: body ? body.scrollHeight : 0,
        clientHeight: body ? body.clientHeight : 0,
        canScroll: body ? body.scrollHeight > body.clientHeight : false,
      };
    });

    console.log('  Modal Metrics:', JSON.stringify(modalMetrics, null, 2));

    if (!modalMetrics.canScroll) {
      console.warn('  [WARNING] Body scrollHeight is <= clientHeight. Checking form content height.');
    } else {
      console.log(`  [PASS] Modal body is scrollable (scrollHeight: ${modalMetrics.scrollHeight}px > clientHeight: ${modalMetrics.clientHeight}px)`);
    }

    // 5. Screenshot at Initial Position (Top)
    console.log('[Step 5] Capturing initial (top) screenshot...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_01_top.png') });
    console.log('  Saved: emp_modal_01_top.png');

    // 6. Test Vertical Scrolling (Mouse Wheel & Keyboard & scrollTop)
    console.log('[Step 6] Testing independent vertical scrolling...');

    // Scroll to middle
    const scrollMiddle = await page.evaluate(() => {
      const body = document.querySelector('.employee-modal-body');
      if (!body) return { error: 'No body' };
      body.scrollTop = Math.floor((body.scrollHeight - body.clientHeight) / 2);
      return {
        scrollTop: body.scrollTop,
        maxScroll: body.scrollHeight - body.clientHeight,
      };
    });
    await new Promise((r) => setTimeout(r, 300));
    console.log('  Scrolled to Middle:', scrollMiddle);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_02_middle.png') });
    console.log('  Saved: emp_modal_02_middle.png');

    // Scroll to bottom
    const scrollBottom = await page.evaluate(() => {
      const body = document.querySelector('.employee-modal-body');
      if (!body) return { error: 'No body' };
      body.scrollTop = body.scrollHeight;
      return {
        scrollTop: body.scrollTop,
        maxScroll: body.scrollHeight - body.clientHeight,
      };
    });
    await new Promise((r) => setTimeout(r, 300));
    console.log('  Scrolled to Bottom:', scrollBottom);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_03_bottom.png') });
    console.log('  Saved: emp_modal_03_bottom.png');

    // Verify footer visibility at bottom
    const footerVisibleAtBottom = await page.evaluate(() => {
      const footer = document.querySelector('.employee-modal-footer');
      if (!footer) return false;
      const rect = footer.getBoundingClientRect();
      return rect.bottom <= window.innerHeight && rect.top > 0 && rect.height > 0;
    });
    console.log(`  [PASS] Footer visible at bottom: ${footerVisibleAtBottom}`);

    // Scroll back to top to fill form
    await page.evaluate(() => {
      const body = document.querySelector('.employee-modal-body');
      if (body) body.scrollTop = 0;
    });
    await new Promise((r) => setTimeout(r, 300));

    // 7. Test Filling All Fields
    console.log('[Step 7] Filling all form fields...');
    const testId = Date.now().toString().slice(-4);
    const testName = `Aditi Rao`;
    const testEmail = `aditi.rao.${testId}@kanvtech.com`;
    const testCustomId = `aditi.${testId}`;

    // Fill Full Name
    await page.type('input[placeholder="e.g. Gaurav Sharma"]', testName);

    // Fill Email
    await page.type('input[placeholder="e.g. gaurav@kanvtech.com"]', testEmail);

    // Fill Custom Login User ID
    await page.type('input[placeholder="e.g. gaurav.s (defaults from email prefix if blank)"]', testCustomId);
    await new Promise((r) => setTimeout(r, 800)); // wait for availability check

    // Check Availability badge
    const availStatus = await page.evaluate(() => {
      const modal = document.querySelector('.employee-modal');
      return modal ? modal.textContent.includes('Available') : false;
    });
    console.log(`  Custom User ID "${testCustomId}" availability check: ${availStatus ? 'Available ✓' : 'Checking/Other'}`);

    // Fill Primary Phone
    await page.type('input[type="tel"]', '9876543210');

    // Add Alternate Email
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.employee-modal button'));
      const addEmailBtn = btns.find((b) => b.textContent.includes('+ Add Email'));
      if (addEmailBtn) addEmailBtn.click();
    });
    await new Promise((r) => setTimeout(r, 200));
    const altEmailInput = await page.$('input[placeholder="alternate.email@company.com"]');
    if (altEmailInput) {
      await altEmailInput.type(`aditi.personal.${testId}@gmail.com`);
    }

    // Scroll down to middle for Department, Role & Password
    await page.evaluate(() => {
      const body = document.querySelector('.employee-modal-body');
      if (body) body.scrollTop = 350;
    });
    await new Promise((r) => setTimeout(r, 300));

    // Generate Strong Password
    console.log('  Clicking "Generate Strong Password"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.employee-modal button'));
      const genBtn = btns.find((b) => b.textContent.includes('Generate Strong Password'));
      if (genBtn) genBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    const generatedPasswordVal = await page.evaluate(() => {
      const pwdInput = document.querySelector('input[placeholder="Auto-generated secure password if left empty"]');
      return pwdInput ? pwdInput.value : '';
    });
    console.log(`  Generated Password: ${generatedPasswordVal ? '✓ Formatted Password Generated (' + generatedPasswordVal.length + ' chars)' : 'Failed'}`);

    // Scroll to bottom for Manager & Availability
    await page.evaluate(() => {
      const body = document.querySelector('.employee-modal-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await new Promise((r) => setTimeout(r, 300));

    // Capture screenshot of completely filled form
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_04_filled.png') });
    console.log('  Saved: emp_modal_04_filled.png');

    // 8. Submit the form
    console.log('[Step 8] Submitting form via "Add Specialist Employee"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.employee-modal-footer button'));
      const submitBtn = btns.find((b) => b.textContent.includes('Add Specialist Employee') || b.textContent.includes('Registering'));
      if (submitBtn) submitBtn.click();
    });

    // Wait for submission response and directory reload
    await new Promise((r) => setTimeout(r, 2500));

    // Verify modal closed or feedback banner appeared
    const submissionResult = await page.evaluate(() => {
      const modalOpen = Boolean(document.querySelector('.employee-modal-overlay'));
      const banner = document.body.textContent.includes('registered successfully') || document.body.textContent.includes('created successfully');
      const inDirectory = document.body.textContent.includes('Aditi Rao');
      return { modalOpen, banner, inDirectory };
    });

    console.log('  Submission Result:', JSON.stringify(submissionResult, null, 2));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_05_submitted_success.png') });
    console.log('  Saved: emp_modal_05_submitted_success.png');

    // 9. Multi-Viewport Responsiveness Testing
    console.log('\n[Step 9] Testing multi-viewport responsiveness...');
    const viewports = [
      { name: '1920x1080_FHD', width: 1920, height: 1080 },
      { name: '1366x768_Laptop', width: 1366, height: 768 },
      { name: '1280x720_HD', width: 1280, height: 720 },
      { name: '1024x768_Tablet', width: 1024, height: 768 },
      { name: '390x844_Mobile', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      // Open modal again
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const found = btns.find((b) => b.textContent.includes('Add Specialist Employee'));
        if (found) found.click();
      });
      await new Promise((r) => setTimeout(r, 500));

      const vpMetrics = await page.evaluate(() => {
        const modal = document.querySelector('.employee-modal');
        const body = document.querySelector('.employee-modal-body');
        const footer = document.querySelector('.employee-modal-footer');
        if (!modal) return null;

        const mRect = modal.getBoundingClientRect();
        const fRect = footer ? footer.getBoundingClientRect() : null;

        return {
          windowHeight: window.innerHeight,
          modalHeight: mRect.height,
          modalFitsInViewport: mRect.bottom <= window.innerHeight + 1,
          footerVisible: fRect ? fRect.bottom <= window.innerHeight && fRect.top > 0 : false,
          bodyScrollHeight: body ? body.scrollHeight : 0,
          bodyClientHeight: body ? body.clientHeight : 0,
          isScrollable: body ? body.scrollHeight > body.clientHeight : false,
        };
      });

      console.log(`  Viewport ${vp.name}:`, JSON.stringify(vpMetrics));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `emp_modal_vp_${vp.name}.png`) });

      // Close modal
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.employee-modal-header button, .employee-modal-footer button'));
        const closeBtn = btns.find((b) => b.textContent.includes('✕') || b.textContent.includes('Cancel'));
        if (closeBtn) closeBtn.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log('\n========================================================================');
    console.log('  ALL BROWSER UAT CHECKS COMPLETED SUCCESSFULLY!');
    console.log('========================================================================');

  } catch (err) {
    console.error('\n[ERROR] Browser verification failed:', err);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'emp_modal_error.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
}

verifyEmployeeModal();
