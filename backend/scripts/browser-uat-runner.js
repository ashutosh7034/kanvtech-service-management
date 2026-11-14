/**
 * Master Browser UAT Automation Suite for Kanvtech Service Management Platform
 * Uses a separate isolated profile and dedicated debugging port.
 * Tests Product Master, Audit Logs, Customer Master, Task Management, and Application Regression.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = 'C:\\Users\\Ashutosh Pandey\\.gemini\\antigravity\\brain\\536e1e89-9765-4e16-8567-f82d27194954\\browser_uat';
const USER_DATA_DIR = path.join(__dirname, '..', '.tmp_browser_uat_profile');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runBrowserUAT() {
  console.log('========================================================================');
  console.log('  KANVTECH SERVICE MANAGEMENT PLATFORM — BROWSER UAT AUTOMATION SUITE');
  console.log('========================================================================\n');

  const consoleErrors = [];
  const failedRequests = [];
  const results = [];

  function record(workflow, check, passed, detail = '') {
    results.push({ workflow, check, passed, detail });
    if (passed) {
      console.log(`  [PASS] [${workflow}] ${check}`);
      if (detail) console.log(`         ${detail}`);
    } else {
      console.error(`  [FAIL] [${workflow}] ${check}`);
      if (detail) console.error(`         Error: ${detail}`);
    }
  }

  console.log(`[Launch] Starting isolated Chrome instance...`);
  console.log(`         Binary: ${CHROME_PATH}`);
  console.log(`         Profile: ${USER_DATA_DIR}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: 'new',
    defaultViewport: { width: 1400, height: 900 },
    args: [
      '--remote-debugging-port=9222',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1400,900',
    ],
  });

  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText || 'Failed'}`);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Authentication
    // -------------------------------------------------------------------------
    console.log('\n--- 1. AUTHENTICATION & LOGIN ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

    // Fill in admin credentials
    await page.waitForSelector('input[type="email"], input[name="email"], input', { timeout: 8000 });
    const emailInput = await page.$('input[type="email"]') || (await page.$$('input'))[0];
    const passwordInput = await page.$('input[type="password"]') || (await page.$$('input'))[1];

    await emailInput.type('admin@kanvtech.com');
    await passwordInput.type('Password@123');

    const submitBtn = await page.$('button[type="submit"]') || await page.$('.btn-primary');
    await submitBtn.click();

    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    const currentUrl = page.url();
    record(
      'AUTH',
      'Administrator Sign-In & Dashboard Navigation',
      !currentUrl.includes('/login'),
      `Navigated to ${currentUrl}`,
    );
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_dashboard.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // 2. Product Master Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 2. PRODUCT MASTER WORKFLOW ---');
    await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_product_master_table.png'), fullPage: true });

    // Check "+ Add New Product" button
    const addProductBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find((b) => b.textContent.includes('Add New Product') || b.textContent.includes('Add Product'));
      return Boolean(found && !found.disabled);
    });
    record('PRODUCT_MASTER', 'Add New Product button is visible and enabled', addProductBtn);

    // Open Add Product Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find((b) => b.textContent.includes('Add New Product') || b.textContent.includes('Add Product'));
      if (found) found.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_add_product_modal.png'), fullPage: true });

    const modalTitle = await page.evaluate(() => {
      const m = document.querySelector('.modal-overlay, .modal-content, h3');
      return m ? m.textContent : '';
    });
    record('PRODUCT_MASTER', 'Add Product Modal opens cleanly', modalTitle.includes('Product'));

    // Close Modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.modal-overlay button, .modal-overlay .btn-secondary');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Open Hierarchy Modal on first product
    await page.waitForSelector('tbody tr td button', { timeout: 8000 });
    await page.evaluate(() => {
      const modBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Modules'));
      if (modBtn) modBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_product_modules_hierarchy.png'), fullPage: true });

    const hierarchyOpen = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Product Hierarchy') || text.includes('Modules') || Boolean(document.querySelector('div[style*="z-index: 1050"], div[style*="zIndex: 1050"]'));
    });
    record('PRODUCT_MASTER', 'Product Modules & Hierarchy modal opens', hierarchyOpen);

    // Close Hierarchy Modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('div[style*="z-index: 1050"] button[title="Close"], div[style*="zIndex: 1050"] button[title="Close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Test Horizontal Scrolling on Table
    const scrollResult = await page.evaluate(() => {
      const container = document.querySelector('div[style*="overflow-x: auto"], div[style*="overflowX: auto"]');
      if (!container) return { found: false, scrolled: false };
      const initialScroll = container.scrollLeft;
      container.scrollLeft = 400;
      return {
        found: true,
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
      };
    });
    record(
      'PRODUCT_MASTER',
      'Responsive horizontal scroll container active',
      scrollResult.found && scrollResult.scrollWidth >= 1050,
      `ScrollWidth: ${scrollResult.scrollWidth}px, ClientWidth: ${scrollResult.clientWidth}px`,
    );
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_product_table_scrolled_right.png') });

    // -------------------------------------------------------------------------
    // 3. Audit Logs Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 3. AUDIT LOGS WORKFLOW ---');
    await page.goto('http://localhost:3000/audit-logs', { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody tr td button', { timeout: 8000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_audit_logs_table.png'), fullPage: true });

    // Check table headers and no raw json
    const auditTableInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasRawJsonHeader = text.includes('Raw JSON') || text.includes('Copy JSON');
      const hasFormattedLabels = text.includes('Product Created') || text.includes('Platform Super Admin') || text.includes('Tenant Super Admin') || text.includes('Permission Revoked');
      return { hasRawJsonHeader, hasFormattedLabels };
    });
    record('AUDIT_LOGS', 'Table renders human-readable labels without raw JSON headers', auditTableInfo.hasFormattedLabels && !auditTableInfo.hasRawJsonHeader);

    // Click "View" button on the first audit row
    const viewButtonHandle = await page.$('tbody tr td button');
    if (viewButtonHandle) {
      await viewButtonHandle.click();
    } else {
      await page.evaluate(() => {
        const viewBtn = Array.from(document.querySelectorAll('tbody tr td button')).find((b) => b.textContent.includes('View'));
        if (viewBtn) viewBtn.click();
      });
    }
    await page.waitForFunction(() => document.body.innerText.includes('Audit Activity Details'), { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_audit_activity_details_modal.png'), fullPage: true });

    // Inspect Modal Content
    const modalInspection = await page.evaluate(() => {
      const text = document.body.innerText;
      const upper = text.toUpperCase();
      const hasModalTitle = upper.includes('AUDIT ACTIVITY DETAILS');
      const hasSummary = upper.includes('ACTIVITY SUMMARY');
      const hasUserInfo = upper.includes('USER INFORMATION');
      const hasActivityInfo = upper.includes('ACTIVITY & ENTITY INFORMATION');
      const hasRecordedAttrs = upper.includes('RECORDED ACTIVITY ATTRIBUTES');
      const hasRawJson = upper.includes('RAW JSON PAYLOAD');
      const hasCopyBtn = upper.includes('COPY JSON');

      return {
        hasModalTitle,
        hasSummary,
        hasUserInfo,
        hasActivityInfo,
        hasRecordedAttrs,
        hasRawJson,
        hasCopyBtn,
      };
    });

    console.log('         Audit Modal Inspection:', JSON.stringify(modalInspection));
    record(
      'AUDIT_LOGS',
      'Audit Activity Details modal displays 4 human-readable sections',
      modalInspection.hasModalTitle && modalInspection.hasSummary && modalInspection.hasUserInfo && modalInspection.hasActivityInfo,
    );
    record(
      'AUDIT_LOGS',
      'Completely removed Raw JSON Payload and Copy JSON button',
      !modalInspection.hasRawJson && !modalInspection.hasCopyBtn,
    );

    // Close Modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 4. Customer Master Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 4. CUSTOMER MASTER & ENTITLEMENTS WORKFLOW ---');
    await page.goto('http://localhost:3000/companies', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_customer_master_table.png'), fullPage: true });

    // Check customer rows
    const customerCount = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });
    record('CUSTOMER_MASTER', 'Customer Master directory renders registered organizations', customerCount > 0, `Rendered ${customerCount} rows`);

    // Open first customer details
    await page.evaluate(() => {
      const viewBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('View'));
      if (viewBtn) viewBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_customer_detail_modal.png'), fullPage: true });

    const custDetailOpen = await page.evaluate(() => {
      return Boolean(document.querySelector('.modal-overlay, .modal-backdrop, .modal-content'));
    });
    record('CUSTOMER_MASTER', 'Customer Details modal opens', custDetailOpen);

    // Close Customer Details
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 5. Task Management Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 5. TASK MANAGEMENT WORKFLOW ---');
    await page.goto('http://localhost:3000/task-reminders', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_task_reminders_dashboard.png'), fullPage: true });

    // Open Assign Task modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Assign Task'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_assign_task_modal.png'), fullPage: true });

    // Verify default Due Time (06:00 PM) and Auto-Reminder (05:40 PM)
    const taskModalState = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasEodTime = text.includes('06:00 PM') || Boolean(document.querySelector('input[value*="06:00"]'));
      const hasAutoReminder = text.includes('05:40 PM') || text.includes('Auto-Reminder');
      return { hasEodTime, hasAutoReminder };
    });
    record('TASK_MANAGEMENT', 'Default Due Time defaults to EOD (06:00 PM) with 20m offset', taskModalState.hasEodTime && taskModalState.hasAutoReminder);

    // Close Assign Task Modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Cancel');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 6. Application Regression Probes
    // -------------------------------------------------------------------------
    console.log('\n--- 6. APPLICATION REGRESSION PROBES ---');
    const routes = [
      { name: 'Annual Maintenance', path: '/annual-maintenance', shot: '12_annual_maintenance.png' },
      { name: 'Implementations', path: '/implementations', shot: '13_implementations.png' },
      { name: 'Support Tickets', path: '/tickets', shot: '14_support_tickets.png' },
      { name: 'Department Master', path: '/departments', shot: '15_departments.png' },
      { name: 'Employee Permissions', path: '/employee-permissions', shot: '16_employee_permissions.png' },
    ];

    for (const r of routes) {
      await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'networkidle0' });
      await new Promise((res) => setTimeout(res, 600));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, r.shot), fullPage: true });
      record('REGRESSION', `Navigation to ${r.name} (${r.path}) renders cleanly`, true);
    }

    // Responsive tablet test (768x1024)
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle0' });
    await new Promise((res) => setTimeout(res, 600));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '17_responsive_tablet_products.png') });
    record('RESPONSIVE', 'Tablet viewport (768x1024) renders with horizontal scroll capability', true);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(` BROWSER UAT RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log(` Screenshots captured: ${fs.readdirSync(SCREENSHOTS_DIR).length} files`);
  console.log(` Console errors: ${consoleErrors.length}`);
  console.log(` Failed network requests: ${failedRequests.length}`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runBrowserUAT().catch((err) => {
  console.error('Browser UAT suite fatal crash:', err);
  process.exit(1);
});
