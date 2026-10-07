import puppeteer from 'puppeteer';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import assert from 'assert';

const prisma = new PrismaClient();

async function runBrowserVerification() {
  console.log('====================================================');
  console.log('BROWSER E2E TEST: INTERNAL MESSAGES & NOTIFICATIONS');
  console.log('====================================================');

  const ts = Date.now();
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Setup Test Employees in DB
  console.log('\n[1/10] Preparing test employees in database...');
  const createTestUser = async (email: string, name: string, role: UserRole, empId: string) => {
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          isActive: true,
          employee: {
            create: {
              id: empId,
              name,
              email,
              phone: '9876543210',
              department: 'Technical Operations',
              designation: role === 'MANAGER' ? 'Technical Manager' : 'Support Specialist',
              level: role === 'MANAGER' ? 'L3' : 'L2',
            },
          },
        },
      });
    }
    return u;
  };

  const empA = await createTestUser(`browser_alice_${ts}@kanvtech.internal`, `Alice Browser ${ts}`, UserRole.L1_EMPLOYEE, `BEMP-A-${ts.toString().slice(-4)}`);
  const empB = await createTestUser(`browser_bob_${ts}@kanvtech.internal`, `Bob Browser ${ts}`, UserRole.L2_EMPLOYEE, `BEMP-B-${ts.toString().slice(-4)}`);
  const empC = await createTestUser(`browser_charlie_${ts}@kanvtech.internal`, `Charlie Browser ${ts}`, UserRole.MANAGER, `BEMP-C-${ts.toString().slice(-4)}`);
  const unrelatedEmpD = await createTestUser(`browser_david_${ts}@kanvtech.internal`, `David Browser ${ts}`, UserRole.L1_EMPLOYEE, `BEMP-D-${ts.toString().slice(-4)}`);

  console.log('✓ Test personas created');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Helper function to login in UI via direct login API & token setting
  const loginAs = async (email: string) => {
    // 1. Get JWT token from backend auth API
    const authRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const authData = await authRes.json();
    assert(authData.token, `Auth failed for ${email}: ${JSON.stringify(authData)}`);
    const token = authData.token;

    // 2. Clear previous session & inject token into localStorage
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate((jwt) => {
      localStorage.setItem('kanvtech_token', jwt);
    }, token);

    // 3. Reload page to initialize session with new token
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // 4. Wait for sidebar navigation to be rendered
    await page.waitForSelector('.sidebar', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 800));
  };

  try {
    // 1. Login as Employee A
    console.log('\n[2/10] Logging in as Employee A (Alice)...');
    await loginAs(empA.email);

    // 2. Open Internal Messages
    console.log('[3/10] Navigating to Internal Messages via Sidebar...');
    await page.waitForSelector('.sidebar');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const msgItem = items.find((i) => i.textContent?.includes('Internal Messages'));
      if (msgItem) (msgItem as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const pageText = await page.evaluate(() => document.body.innerText);
    assert(pageText.includes('Internal Messages'), 'Internal Messages page not loaded');
    console.log('✓ Internal Messages page loaded successfully');

    // 3. Click Compose & fill message
    console.log('[4/10] Opening Compose Modal and composing message...');
    await page.evaluate(() => {
      const composeBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Compose')
      );
      if (composeBtn) (composeBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify Compose Modal
    const modalText = await page.evaluate(() => document.body.innerText);
    assert(modalText.includes('New Internal Message'), 'Compose modal did not open');
    console.log('✓ Compose Modal opened');

    // Select To: Bob
    await page.click('input[placeholder*="Type employee name"]');
    await page.type('input[placeholder*="Type employee name"]', empB.email, { delay: 15 });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]'));
      const match = options.find((o) => o.textContent?.includes('Bob Browser') || o.textContent?.includes('browser_bob'));
      if (match) (match as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      else if (options.length > 0) (options[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 600));

    // Select CC: Charlie
    await page.click('input[placeholder*="Type employee name or email for CC"]');
    await page.type('input[placeholder*="Type employee name or email for CC"]', empC.email, { delay: 15 });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('div[style*="cursor: pointer"]'));
      const match = options.find((o) => o.textContent?.includes('Charlie Browser') || o.textContent?.includes('browser_charlie'));
      if (match) (match as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      else if (options.length > 0) (options[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 600));

    const testSubject = `Escalation Critical Batch #${ts}`;
    const testBody = `Please verify the SLA parameters and server health status for batch #${ts}.`;

    // Type Subject and Message
    await page.type('input[placeholder*="Ticket Escalation Required"]', testSubject, { delay: 10 });
    await page.type('textarea[placeholder*="Write your internal message"]', testBody, { delay: 10 });
    await new Promise((r) => setTimeout(r, 500));

    // Submit Send
    console.log('[5/10] Sending message...');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 3000));

    // 4. Verify message in thread view for Employee A
    const afterSendText = await page.evaluate(() => document.body.innerText);
    assert(afterSendText.includes(testSubject), 'Thread subject not visible after sending');
    console.log('✓ Message sent and active in sender view');

    // 5. Login as Employee B (Recipient) & Check Notification Bell
    console.log('\n[6/10] Logging in as Employee B (Bob) to verify In-App Notification Bell...');
    await loginAs(empB.email);

    // Wait for notification count badge on bell
    await new Promise((r) => setTimeout(r, 1500));
    const bellBadgeText = await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title="Notifications"]');
      return bellBtn ? bellBtn.textContent?.trim() : '';
    });
    console.log(`Notification badge on bell: "${bellBadgeText}"`);
    assert(Number(bellBadgeText) >= 1, 'Notification bell badge should show unread count >= 1');
    console.log('✓ In-App Notification badge verified on Header Bell');

    // 6. Click Bell to Open Notification Dropdown
    console.log('[7/10] Opening Notification dropdown panel...');
    await page.click('button[title="Notifications"]');
    await new Promise((r) => setTimeout(r, 1000));

    const dropdownText = await page.evaluate(() => document.body.innerText);
    assert(dropdownText.includes('Notifications'), 'Notification dropdown not opened');
    assert(dropdownText.includes(testSubject), 'Notification dropdown should display message subject');
    console.log('✓ Notification dropdown displays new internal message with subject and sender');

    // 7. Click Notification to open Thread & Mark Read
    console.log('[8/10] Clicking notification to open message thread...');
    await page.evaluate((subj) => {
      const notifItem = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.includes(subj as string) && d.style.cursor === 'pointer'
      );
      if (notifItem) (notifItem as HTMLElement).click();
    }, testSubject);
    await new Promise((r) => setTimeout(r, 2000));

    const threadViewText = await page.evaluate(() => document.body.innerText);
    assert(threadViewText.includes(testSubject), 'Conversation thread not opened from notification click');
    console.log('✓ Clicking notification successfully opened the conversation thread');

    // 8. Reply in Thread
    console.log('[9/10] Replying to conversation thread as Bob...');
    await page.evaluate(() => {
      const replyBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.trim() === 'Reply'
      );
      if (replyBtn) (replyBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const replyMsgText = `Acknowledged by Bob at ${new Date().toLocaleTimeString()}. Task assigned.`;
    await page.type('textarea[placeholder*="Type your reply"]', replyMsgText, { delay: 10 });
    await new Promise((r) => setTimeout(r, 400));

    await page.evaluate(() => {
      const sendReplyBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
        b.textContent?.includes('Send Reply')
      );
      if (sendReplyBtn) (sendReplyBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    const updatedThreadText = await page.evaluate(() => document.body.innerText);
    assert(updatedThreadText.includes(replyMsgText), 'Reply not visible in thread');
    console.log('✓ Reply successfully added to thread');

    // 9. Login as Unrelated Employee D & Verify Strict Private Isolation
    console.log('\n[10/10] Verifying strict participant security for unrelated Employee D...');
    await loginAs(unrelatedEmpD.email);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const msgItem = items.find((i) => i.textContent?.includes('Internal Messages'));
      if (msgItem) (msgItem as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const empDText = await page.evaluate(() => document.body.innerText);
    assert(!empDText.includes(testSubject), 'Unrelated Employee D must NOT see private conversation');
    console.log('✓ Unrelated Employee D cannot see private message thread');

    console.log('\n====================================================');
    console.log('ALL BROWSER VERIFICATIONS PASSED ✔');
    console.log('====================================================');
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runBrowserVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('BROWSER TEST FAILED:', err);
    process.exit(1);
  });
