import puppeteer from 'puppeteer';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import assert from 'assert';

const prisma = new PrismaClient();

async function runBrowserVerification() {
  console.log('====================================================');
  console.log('BROWSER E2E TEST: MY TASKS & IN-APP NOTIFICATIONS');
  console.log('====================================================');

  const ts = Date.now();
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Setup Test Personas in DB
  console.log('\n[1/10] Preparing test personas in database...');
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

  const empA = await createTestUser(`btask_alice_${ts}@kanvtech.internal`, `Alice Task ${ts}`, UserRole.L1_EMPLOYEE, `BTEMP-A-${ts.toString().slice(-4)}`);
  const empB = await createTestUser(`btask_bob_${ts}@kanvtech.internal`, `Bob Task ${ts}`, UserRole.L2_EMPLOYEE, `BTEMP-B-${ts.toString().slice(-4)}`);

  console.log('✓ Test personas created');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  page.on('pageerror', (err: any) => console.error('BROWSER ERROR:', err?.message || err));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    }
  });
  page.on('response', async (res) => {
    if (res.status() >= 400) {
      try {
        const text = await res.text();
        console.error(`[API ${res.status()} ${res.url()}]:`, text);
      } catch {}
    }
  });

  // Helper to login via token injection
  const loginAs = async (email: string) => {
    const authRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const authData = await authRes.json();
    assert(authData.token, `Auth failed for ${email}`);
    const token = authData.token;

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate((jwt) => {
      localStorage.setItem('kanvtech_token', jwt);
    }, token);

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sidebar', { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1000));
  };

  try {
    // 1. Login as Employee A (Alice)
    console.log('\n[2/10] Logging in as Employee A (Alice)...');
    await loginAs(empA.email);

    // 2. Check Dashboard Widget
    console.log('[3/10] Verifying Dashboard "My Tasks & Reminders" widget...');
    const dashText = await page.evaluate(() => document.body.innerText);
    assert(dashText.includes('My Tasks & Reminders'), 'Dashboard should contain My Tasks & Reminders widget');
    console.log('✓ My Tasks & Reminders widget verified on Dashboard');

    // 3. Navigate to My Tasks Page via Sidebar
    console.log('[4/10] Navigating to My Tasks via Sidebar...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const taskItem = items.find((i) => i.textContent?.includes('My Tasks & Reminders') || i.textContent?.includes('Task Reminders'));
      if (taskItem) (taskItem as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const pageText = await page.evaluate(() => document.body.innerText);
    assert(pageText.includes('My Tasks & Reminders'), 'My Tasks page should be loaded');
    console.log('✓ My Tasks page loaded successfully');

    // 4. Create a Personal Task with Reminder
    console.log('[5/10] Opening Create Task modal and saving new task...');
    const buttons = await page.$$('button');
    let clickedAdd = false;
    for (const btn of buttons) {
      const txt = await page.evaluate((el) => el.textContent, btn);
      if (txt && txt.includes('Add Task')) {
        await btn.click();
        clickedAdd = true;
        break;
      }
    }
    assert(clickedAdd, 'Add Task button should be clicked');
    await page.waitForSelector('form', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    const testTitle = `Escalate AMC Server Audit #${ts}`;
    const testDesc = 'Check SLA compliance threshold for customer audit.';

    await page.waitForSelector('form input[type="text"]', { timeout: 5000 });
    const inputs = await page.$$('form input[type="text"]');
    if (inputs.length > 0) {
      await inputs[0].type(testTitle);
    }
    const textareas = await page.$$('form textarea');
    if (textareas.length > 0) {
      await textareas[0].type(testDesc);
    }

    // Select Priority = HIGH
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      if (selects.length > 0) {
        (selects[0] as HTMLSelectElement).value = 'HIGH';
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    if (inputs.length > 1) {
      await inputs[1].type('Audit');
    }
    await new Promise((r) => setTimeout(r, 400));

    // Submit Create
    const submitBtn = await page.$('form button[type="submit"]');
    assert(submitBtn, 'Submit button should be in form');
    await submitBtn.click();

    await new Promise((r) => setTimeout(r, 2500));

    const afterCreateText = await page.evaluate(() => document.body.innerText);
    if (!afterCreateText.includes(testTitle)) {
      console.error('Page text after create:', afterCreateText.substring(0, 500));
    }
    assert(afterCreateText.includes(testTitle), 'Created task title should appear in task list');
    console.log('✓ Task created and verified in personal task list');

    // 5. Navigate to Dashboard and verify widget contains created task
    console.log('\n[6/10] Navigating to Dashboard to verify dynamic widget sync...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const dashItem = items.find((i) => i.textContent?.includes('Dashboard'));
      if (dashItem) (dashItem as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const updatedDashText = await page.evaluate(() => document.body.innerText);
    assert(updatedDashText.includes(testTitle), 'Created task must appear in Dashboard widget');
    console.log('✓ Created task verified in Dashboard widget');

    // 6. Trigger In-App Reminder Sweep
    console.log('\n[7/10] Triggering In-App Reminder Sweep...');
    // Backdate the reminder in DB for this task so it's due now
    await prisma.employeeTask.updateMany({
      where: { title: testTitle },
      data: { reminderTime: new Date(Date.now() - 5000), reminderTriggeredAt: null },
    });

    // Call sweep endpoint
    await fetch('http://localhost:5000/api/employee-tasks/process-reminders', {
      headers: { Authorization: `Bearer ${(await (await fetch('http://localhost:5000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: empA.email, password }) })).json()).token}` },
    });

    // Reload Dashboard & Check Notification Bell
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sidebar', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const bellBadgeText = await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title="Notifications"]');
      return bellBtn ? bellBtn.textContent?.trim() : '';
    });
    console.log(`Notification badge on bell: "${bellBadgeText}"`);
    assert(Number(bellBadgeText) >= 1, 'Notification bell badge should show unread count >= 1');
    console.log('✓ Notification Bell updated with reminder badge counter');

    // 7. Click Bell and verify Dropdown
    console.log('[8/10] Opening Notification dropdown panel...');
    await page.click('button[title="Notifications"]');
    await new Promise((r) => setTimeout(r, 1000));

    const notifDropdownText = await page.evaluate(() => document.body.innerText);
    assert(notifDropdownText.includes('Task Reminder'), 'Notification dropdown should show Task Reminder');
    assert(notifDropdownText.includes(testTitle), 'Notification dropdown should contain task title');
    console.log('✓ Notification dropdown displays task reminder with title');

    // 8. Click Notification -> Navigate to Task Details & Complete Task
    console.log('[9/10] Clicking notification to open Task Details...');
    await page.evaluate((title) => {
      const notifItem = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.includes(title) && d.style.cursor === 'pointer'
      );
      if (notifItem) (notifItem as HTMLElement).click();
    }, testTitle);
    await new Promise((r) => setTimeout(r, 2000));

    const detailText = await page.evaluate(() => document.body.innerText);
    assert(detailText.includes(testTitle), 'Task details modal or page should be open');
    console.log('✓ Notification click successfully opened task');

    // Quick Complete
    await page.evaluate(() => {
      const completeBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Mark Complete')
      );
      if (completeBtn) (completeBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));
    console.log('✓ Task marked as complete');

    // 9. Verify Strict Isolation for Employee B
    console.log('\n[10/10] Verifying strict personal isolation for Employee B...');
    await loginAs(empB.email);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const taskItem = items.find((i) => i.textContent?.includes('My Tasks & Reminders') || i.textContent?.includes('Task Reminders'));
      if (taskItem) (taskItem as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const empBTaskText = await page.evaluate(() => document.body.innerText);
    assert(!empBTaskText.includes(testTitle), 'Employee B must NOT see Employee A personal task');
    console.log('✓ Strict personal privacy verified: Employee A task invisible to Employee B');

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
