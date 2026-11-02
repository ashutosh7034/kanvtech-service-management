const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api' + options.path,
        method: options.method || 'GET',
        headers: {
          ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          let parsed = resData;
          try {
            parsed = JSON.parse(resData);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== KANVTECH FULL SECURITY AUDIT & PENETRATION HARNESS ===\n');

  // 1. Authenticate Administrative Accounts
  const adminLogin = await request(
    { path: '/auth/login', method: 'POST' },
    { email: 'admin@kanvtech.com', password: 'Password@123' }
  );
  console.log(`[AUTH] Admin login: status=${adminLogin.status}, role=${adminLogin.body?.user?.role}, tenant=${adminLogin.body?.user?.tenantId}`);
  const adminToken = adminLogin.body?.token;

  const ashutoshLogin = await request(
    { path: '/auth/login', method: 'POST' },
    { email: 'ashutosh@kanvtech.com', password: 'Password@123' }
  );
  console.log(`[AUTH] Platform login: status=${ashutoshLogin.status}, role=${ashutoshLogin.body?.user?.role}`);
  const ashutoshToken = ashutoshLogin.body?.token;

  // Authenticate Customer
  let customerLogin = await request(
    { path: '/auth/login', method: 'POST' },
    { email: 'customer@acme.com', password: 'Password@123' }
  );
  if (customerLogin.status !== 200) {
    customerLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'customer@acme.com', password: 'cust123' }
    );
  }
  console.log(`[AUTH] Customer login: status=${customerLogin.status}, role=${customerLogin.body?.user?.role}, companyId=${customerLogin.body?.user?.companyId}`);
  const customerToken = customerLogin.body?.token;

  // Authenticate L1 Employee
  const l1Login = await request(
    { path: '/auth/login', method: 'POST' },
    { email: 'amit.l1@kanvtech.com', password: 'Password@123' }
  );
  console.log(`[AUTH] L1 Employee login: status=${l1Login.status}, role=${l1Login.body?.user?.role}`);
  const l1Token = l1Login.body?.token;

  // Authenticate Manager
  const mgrLogin = await request(
    { path: '/auth/login', method: 'POST' },
    { email: 'manager@kanvtech.com', password: 'Password@123' }
  );
  console.log(`[AUTH] Manager login: status=${mgrLogin.status}, role=${mgrLogin.body?.user?.role}`);
  const mgrToken = mgrLogin.body?.token;

  console.log('\n=============================================================');
  console.log('             ACTIVE VULNERABILITY TESTING');
  console.log('=============================================================');

  // TEST 1: KANV-SEC-001 - Cross-Tenant Admin Password Reset & Account Takeover
  console.log('\n[TEST 1] KANV-SEC-001: Admin Reset Password Privilege Escalation');
  // Attempt to reset password of ashutosh (PLATFORM_INCHARGE) using admin token
  const resetAshutosh = await request(
    { path: '/auth/admin/reset-password', method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } },
    { userId: ashutoshLogin.body?.user?.id || 1 }
  );
  console.log(`Reset ashutosh@kanvtech.com password via tenant admin: status=${resetAshutosh.status}, body=${JSON.stringify(resetAshutosh.body)}`);

  // TEST 2: KANV-SEC-002 - Inbound Email Webhook Forgery
  console.log('\n[TEST 2] KANV-SEC-002: Inbound Email Webhook Missing Signature Validation');
  const spoofedWebhook = await request(
    {
      path: '/inbound-email/webhook/generic',
      method: 'POST',
      headers: { Authorization: 'Bearer fake-unverified-token' },
    },
    {
      fromEmail: 'hacker@adversary.com',
      fromName: 'Adversary',
      subject: 'Exploit Ticket Injection',
      text: 'Proof of concept ticket injection.',
    }
  );
  console.log(`Spoofed Webhook: status=${spoofedWebhook.status}, success=${spoofedWebhook.body?.success}, logId=${spoofedWebhook.body?.logId}`);

  // TEST 3: KANV-SEC-004 - Attendance Check-in by Unauthorized Role (Customer)
  console.log('\n[TEST 3] KANV-SEC-004: Attendance Check-in Role Enforcement');
  if (customerToken) {
    const custCheckIn = await request(
      {
        path: '/employees/attendance/check-in',
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      },
      { employeeId: 'EMP-010', lat: 19.07, lng: 72.87, address: 'Unauthorized Check-in' }
    );
    console.log(`Customer invoking attendance check-in: status=${custCheckIn.status}, body=${JSON.stringify(custCheckIn.body)}`);
  }

  // TEST 4: KANV-SEC-005 - Customer Ticket Comment / Attachment IDOR
  console.log('\n[TEST 4] KANV-SEC-005: Customer Comment on Another Company Ticket');
  // Ticket KT-2026-000031 belongs to CMP-0001
  if (customerToken) {
    const custComment = await request(
      {
        path: '/tickets/KT-2026-000031/comments',
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      },
      { message: 'Injected customer comment on external ticket' }
    );
    console.log(`Customer commenting on CMP-0001 ticket: status=${custComment.status}, body=${JSON.stringify(custComment.body)}`);
  }

  // TEST 5: KANV-SEC-006 - Entitled Modules Information Disclosure
  console.log('\n[TEST 5] KANV-SEC-006: Entitled Modules Enumeration');
  const entitledEnum = await request({
    path: '/implementations/entitled-modules?companyId=CMP-0001&productId=PROD-001',
    headers: { Authorization: `Bearer ${customerToken || adminToken}` },
  });
  console.log(`Entitled modules enumeration: status=${entitledEnum.status}, modules=${JSON.stringify(entitledEnum.body?.modules)}`);

  console.log('\n=== AUDIT HARNESS EXECUTION COMPLETE ===\n');
}

run().catch((err) => console.error(err));
