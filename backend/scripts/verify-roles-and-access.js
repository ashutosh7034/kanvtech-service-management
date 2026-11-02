const http = require('http');

function post(path, body, token) {
  return request('POST', path, body, token);
}

function get(path, token) {
  return request('GET', path, null, token);
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json;
          try {
            json = JSON.parse(data);
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('KANVTECH ACCESS CONTROL & ROLE ASSIGNMENT VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details}`);
      failed++;
    }
  }

  // --- TEST GROUP 1: Account 1 (ashutosh@kanvtech.com) ---
  console.log('--- TEST GROUP 1: Account 1 (ashutosh@kanvtech.com) ---');
  const ashutoshLogin = await post('/auth/login', {
    email: 'ashutosh@kanvtech.com',
    password: 'Password@123',
  });
  assert(
    'ashutosh@kanvtech.com login succeeds (HTTP 201/200)',
    ashutoshLogin.status === 201 || ashutoshLogin.status === 200,
    `Status: ${ashutoshLogin.status}`
  );
  assert(
    'ashutosh@kanvtech.com has role PLATFORM_INCHARGE',
    ashutoshLogin.body?.user?.role === 'PLATFORM_INCHARGE',
    `Role: ${ashutoshLogin.body?.user?.role}`
  );
  assert(
    'ashutosh@kanvtech.com is NOT super admin (isSuperAdmin === false)',
    ashutoshLogin.body?.user?.isSuperAdmin === false,
    `isSuperAdmin: ${ashutoshLogin.body?.user?.isSuperAdmin}`
  );
  assert(
    'ashutosh@kanvtech.com has isPlatformIncharge flag',
    ashutoshLogin.body?.user?.isPlatformIncharge === true,
    `isPlatformIncharge: ${ashutoshLogin.body?.user?.isPlatformIncharge}`
  );

  const ashutoshToken = ashutoshLogin.body?.token;

  // GET /auth/me for ashutosh
  const ashutoshMe = await get('/auth/me', ashutoshToken);
  const ashutoshUser = ashutoshMe.body?.user || ashutoshMe.body;
  assert(
    'GET /auth/me returns role PLATFORM_INCHARGE',
    ashutoshUser?.role === 'PLATFORM_INCHARGE',
    `Role: ${ashutoshUser?.role}`
  );
  assert(
    'GET /auth/me returns isPlatformIncharge === true',
    ashutoshUser?.isPlatformIncharge === true,
    `isPlatformIncharge: ${ashutoshUser?.isPlatformIncharge}`
  );
  assert(
    'GET /auth/me returns isSuperAdmin === false',
    ashutoshUser?.isSuperAdmin === false,
    `isSuperAdmin: ${ashutoshUser?.isSuperAdmin}`
  );

  // Platform Administration endpoints access
  const platformOverview = await get('/platform/overview', ashutoshToken);
  assert(
    'ashutosh@kanvtech.com can access GET /platform/overview (HTTP 200)',
    platformOverview.status === 200,
    `Status: ${platformOverview.status}`
  );

  const platformTenants = await get('/platform/tenants', ashutoshToken);
  assert(
    'ashutosh@kanvtech.com can access GET /platform/tenants (HTTP 200)',
    platformTenants.status === 200,
    `Status: ${platformTenants.status}`
  );

  // --- TEST GROUP 2: Account 2 (admin@kanvtech.com) ---
  console.log('\n--- TEST GROUP 2: Account 2 (admin@kanvtech.com) ---');
  const adminLogin = await post('/auth/login', {
    email: 'admin@kanvtech.com',
    password: 'Password@123',
  });
  assert(
    'admin@kanvtech.com login succeeds (HTTP 201/200)',
    adminLogin.status === 201 || adminLogin.status === 200,
    `Status: ${adminLogin.status}`
  );
  assert(
    'admin@kanvtech.com has role SUPER_ADMIN',
    adminLogin.body?.user?.role === 'SUPER_ADMIN',
    `Role: ${adminLogin.body?.user?.role}`
  );
  assert(
    'admin@kanvtech.com is scoped to KANVTECH tenant',
    adminLogin.body?.user?.tenantId === 'KANVTECH',
    `Tenant: ${adminLogin.body?.user?.tenantId}`
  );
  assert(
    'admin@kanvtech.com is NOT global super admin (isSuperAdmin === false)',
    adminLogin.body?.user?.isSuperAdmin === false,
    `isSuperAdmin: ${adminLogin.body?.user?.isSuperAdmin}`
  );

  const adminToken = adminLogin.body?.token;

  // GET /auth/me for admin
  const adminMe = await get('/auth/me', adminToken);
  const adminUser = adminMe.body?.user || adminMe.body;
  assert(
    'admin GET /auth/me returns role SUPER_ADMIN',
    adminUser?.role === 'SUPER_ADMIN',
    `Role: ${adminUser?.role}`
  );
  assert(
    'admin GET /auth/me returns tenantId KANVTECH',
    adminUser?.tenantId === 'KANVTECH',
    `TenantId: ${adminUser?.tenantId}`
  );
  assert(
    'admin GET /auth/me returns isSuperAdmin === false',
    adminUser?.isSuperAdmin === false,
    `isSuperAdmin: ${adminUser?.isSuperAdmin}`
  );

  // --- TEST GROUP 3: Platform Guard Denial for Tenant SUPER_ADMIN ---
  console.log('\n--- TEST GROUP 3: Platform Guard Denial for Tenant SUPER_ADMIN ---');
  const adminOverview = await get('/platform/overview', adminToken);
  assert(
    'admin@kanvtech.com is DENIED access to GET /platform/overview (HTTP 403 Forbidden)',
    adminOverview.status === 403,
    `Status: ${adminOverview.status}, Error: ${JSON.stringify(adminOverview.body)}`
  );

  const adminTenants = await get('/platform/tenants', adminToken);
  assert(
    'admin@kanvtech.com is DENIED access to GET /platform/tenants (HTTP 403 Forbidden)',
    adminTenants.status === 403,
    `Status: ${adminTenants.status}, Error: ${JSON.stringify(adminTenants.body)}`
  );

  // --- TEST GROUP 4: Tenant Isolation & Scoping ---
  console.log('\n--- TEST GROUP 4: Tenant Isolation & Scoping ---');
  const adminMyTenants = await get('/auth/my-tenants', adminToken);
  const tenantList = adminMyTenants.body?.tenants || adminMyTenants.body || [];
  const returnedTenantIds = (Array.isArray(tenantList) ? tenantList : []).map((t) => t.id);
  assert(
    'admin@kanvtech.com only sees their own tenant membership (KANVTECH)',
    returnedTenantIds.includes('KANVTECH') && !returnedTenantIds.includes('TENANT-APEX'),
    `Tenants returned: ${JSON.stringify(returnedTenantIds)}`
  );

  const unauthorizedSwitch = await post(
    '/auth/switch-tenant',
    { tenantId: 'TENANT-APEX' },
    adminToken
  );
  assert(
    'admin@kanvtech.com CANNOT switch to unauthorized tenant TENANT-APEX (HTTP 403)',
    unauthorizedSwitch.status === 403,
    `Status: ${unauthorizedSwitch.status}, Error: ${JSON.stringify(unauthorizedSwitch.body)}`
  );

  // --- TEST GROUP 5: Tenant Super Admin Permissions in KANVTECH ---
  console.log('\n--- TEST GROUP 5: Tenant Super Admin Permissions in KANVTECH ---');
  const adminCompanies = await get('/companies', adminToken);
  assert(
    'admin@kanvtech.com can access GET /companies in KANVTECH (HTTP 200)',
    adminCompanies.status === 200,
    `Status: ${adminCompanies.status}`
  );

  const adminDepartments = await get('/departments', adminToken);
  assert(
    'admin@kanvtech.com can access GET /departments in KANVTECH (HTTP 200)',
    adminDepartments.status === 200,
    `Status: ${adminDepartments.status}`
  );

  const adminEmployees = await get('/employees', adminToken);
  assert(
    'admin@kanvtech.com can access GET /employees in KANVTECH (HTTP 200)',
    adminEmployees.status === 200,
    `Status: ${adminEmployees.status}`
  );

  const adminTickets = await get('/tickets', adminToken);
  assert(
    'admin@kanvtech.com can access GET /tickets in KANVTECH (HTTP 200)',
    adminTickets.status === 200,
    `Status: ${adminTickets.status}`
  );

  const adminAuditLogs = await get('/audit-logs', adminToken);
  assert(
    'admin@kanvtech.com can access GET /audit-logs in KANVTECH (HTTP 200)',
    adminAuditLogs.status === 200,
    `Status: ${adminAuditLogs.status}`
  );

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
