/**
 * Master Pre-Deployment Regression & Release Verification Script
 * Validates Sections 2, 3, 4, 5, 6, and 8 against live running NestJS services.
 */

const http = require('http');

function postJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function putJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function patchJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function deleteReq(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('  KANVTECH SERVICE MANAGEMENT PLATFORM — PRE-DEPLOYMENT MASTER AUDIT');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (detail) console.log(`         ${detail}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         Error: ${detail}`);
      failed++;
    }
  }

  // 1. Health check endpoint
  const healthRes = await getJson('/api/health');
  assert(
    healthRes.status === 200 && healthRes.body?.status === 'ok',
    'Health Check: Backend server is healthy and DB is connected',
    JSON.stringify(healthRes.body),
  );

  // 2. Authentication: Admin Sign-in
  const adminLogin = await postJson('/api/auth/login', {
    email: 'admin@kanvtech.com',
    password: 'Password@123',
  });
  const adminToken = adminLogin.body?.token;
  assert(Boolean(adminToken), 'Authentication: System Administrator sign-in successful');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 3. Section 2: Audit Logs Verification
  console.log('\n--- SECTION 2: AUDIT LOGS VERIFICATION ---');
  const auditRes = await getJson('/api/audit-logs?limit=50', adminHeaders);
  assert(auditRes.status === 200, 'Audit Logs: API returns HTTP 200 OK');
  const sampleLog = auditRes.body?.logs?.[0];
  assert(
    Boolean(sampleLog && sampleLog.action && !sampleLog.action.includes('_')),
    'Audit Logs: Event actions are rendered in human-readable Title Case',
    `Sample action: "${sampleLog?.action}"`,
  );
  assert(
    Boolean(sampleLog && sampleLog.actor_role && !sampleLog.actor_role.includes('_')),
    'Audit Logs: Actor roles are rendered in human-readable labels',
    `Sample role: "${sampleLog?.actor_role}"`,
  );
  assert(
    sampleLog?.old_values_json === undefined && sampleLog?.new_values_json === undefined,
    'Audit Logs: Technical raw JSON fields are omitted from normal responses',
  );

  // 4. Section 3: Product Master Verification
  console.log('\n--- SECTION 3: PRODUCT MASTER VERIFICATION ---');
  const productsRes = await getJson('/api/products', adminHeaders);
  assert(productsRes.status === 200, 'Product Master: GET /api/products returns HTTP 200');
  const productList = productsRes.body?.data || productsRes.body?.products || (Array.isArray(productsRes.body) ? productsRes.body : []);
  assert(productList.length > 0, `Product Master: Retrieved ${productList.length} products`);

  // Product Creation
  const newProductCode = `PRD-AUDIT-${Date.now().toString().slice(-4)}`;
  const createProdRes = await postJson(
    '/api/products',
    {
      code: newProductCode,
      name: 'Pre-Deployment Release Verifier Pro',
      category: 'Enterprise Software',
      description: 'Automated verification test item for pre-deployment audit',
      isActive: true,
    },
    adminHeaders,
  );
  assert(
    createProdRes.status === 200 || createProdRes.status === 201,
    'Product Master: Product creation succeeds (HTTP 200/201)',
    `Product Code: ${newProductCode}`,
  );
  const createdProductId = createProdRes.body?.product?.id || createProdRes.body?.id;

  if (createdProductId) {
    // Product Editing
    const updateProdRes = await putJson(
      `/api/products/${createdProductId}`,
      {
        name: 'Pre-Deployment Release Verifier Pro (Updated)',
        category: 'Enterprise Software',
        description: 'Updated release verification description',
        isActive: true,
      },
      adminHeaders,
    );
    assert(updateProdRes.status === 200, 'Product Master: Product update succeeds');

    // Product Status Toggle (POST /api/products/:id/status)
    const toggleRes = await postJson(
      `/api/products/${createdProductId}/status`,
      { isActive: false },
      adminHeaders,
    );
    assert(toggleRes.status === 200 || toggleRes.status === 201, 'Product Master: Product status toggle succeeds');

    // Module Creation under Product (POST /api/products/:id/modules)
    const createModuleRes = await postJson(
      `/api/products/${createdProductId}/modules`,
      {
        name: 'Automated Audit Verification Module',
        description: 'Module for regression testing',
      },
      adminHeaders,
    );
    assert(createModuleRes.status === 200 || createModuleRes.status === 201, 'Product Master: Module creation succeeds');
    const createdModuleId = createModuleRes.body?.module?.id || createModuleRes.body?.id;

    // Module Deletion (DELETE /api/products/modules/:moduleId)
    if (createdModuleId) {
      const deleteModRes = await deleteReq(`/api/products/modules/${createdModuleId}`, adminHeaders);
      assert(deleteModRes.status === 200, 'Product Master: Module deletion succeeds');
    }

    // Clean up created product
    const deleteProdRes = await deleteReq(`/api/products/${createdProductId}`, adminHeaders);
    assert(deleteProdRes.status === 200, 'Product Master: Product deletion cleanup succeeds');
  }

  // 5. Section 4: Customer Master & Entitlements Verification
  console.log('\n--- SECTION 4: CUSTOMER MASTER & ENTITLEMENTS VERIFICATION ---');
  const companiesRes = await getJson('/api/companies?page=1&limit=5', adminHeaders);
  assert(companiesRes.status === 200, 'Customer Master: GET /api/companies returns HTTP 200');
  const companyList = companiesRes.body?.companies || companiesRes.body?.data || [];
  assert(companyList.length > 0, `Customer Master: Found ${companyList.length} customer organizations`);

  const entRes = await getJson('/api/entitlements/tenant', adminHeaders);
  assert(
    entRes.status === 200,
    `Customer Entitlements: Retrieved tenant commercial entitlement summary`,
    `User Licences: ${entRes.body?.entitlement?.userLicences?.purchased ?? 'N/A'}, Company Licences: ${entRes.body?.entitlement?.companyLicences?.purchased ?? 'N/A'}`,
  );

  // 6. Section 5: Task & Reminders Verification
  console.log('\n--- SECTION 5: TASK & REMINDER VERIFICATION ---');
  const tasksRes = await getJson('/api/employee-tasks', adminHeaders);
  assert(tasksRes.status === 200, 'Task Management: GET /api/employee-tasks returns HTTP 200');

  // Create Personal Task assigned to EMP-000 (so Admin is the authorized assignee)
  const createTaskRes = await postJson(
    '/api/employee-tasks',
    {
      title: 'Pre-Deployment Release Checklist Task',
      description: 'Comprehensive verification task for release sign-off',
      assignedTo: 'EMP-000',
      priority: 'HIGH',
      dueTime: '06:00 PM',
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      reminderOffsetMinutes: 20,
    },
    adminHeaders,
  );
  assert(
    createTaskRes.status === 200 || createTaskRes.status === 201,
    'Task Management: Task creation succeeds',
  );
  const createdTaskId = createTaskRes.body?.task?.id || createTaskRes.body?.id;

  if (createdTaskId) {
    // Progress Update (POST /api/employee-tasks/:id/progress by Assignee)
    const progressRes = await postJson(
      `/api/employee-tasks/${createdTaskId}/progress`,
      {
        progress: 60,
        comment: 'Automated test verified progress update',
      },
      adminHeaders,
    );
    assert(progressRes.status === 200 || progressRes.status === 201, 'Task Management: Progress update succeeds');

    // Due date & time modification with dynamic reminder recalculation
    const updateTaskRes = await putJson(
      `/api/employee-tasks/${createdTaskId}`,
      {
        dueTime: '07:00 PM',
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        reminderOffsetMinutes: 20,
      },
      adminHeaders,
    );
    assert(updateTaskRes.status === 200, 'Task Management: Due time modification & reminder recalculation succeeds');

    // Task Completion
    const completeRes = await postJson(
      `/api/employee-tasks/${createdTaskId}/complete`,
      { comment: 'Task completed cleanly during verification' },
      adminHeaders,
    );
    assert(completeRes.status === 200 || completeRes.status === 201, 'Task Management: Task completion succeeds');

    // Clean up task
    const deleteTaskRes = await deleteReq(`/api/employee-tasks/${createdTaskId}`, adminHeaders);
    assert(deleteTaskRes.status === 200, 'Task Management: Task deletion cleanup succeeds');
  }

  // 7. Section 6: Regression verification across remaining modules
  console.log('\n--- SECTION 6: MODULE REGRESSION VERIFICATION ---');
  const modulesToProbe = [
    { name: 'Departments', path: '/api/departments' },
    { name: 'Employees', path: '/api/employees' },
    { name: 'Support Tickets', path: '/api/tickets?page=1&limit=5' },
    { name: 'Enquiries / Prospects', path: '/api/prospects' },
    { name: 'Annual Maintenance / Subscriptions', path: '/api/subscriptions' },
    { name: 'AMC Plans', path: '/api/subscriptions/plans' },
    { name: 'Implementations', path: '/api/implementations' },
    { name: 'Reports Dashboard', path: '/api/reports/dashboard' },
    { name: 'Reports SLA', path: '/api/reports/sla' },
    { name: 'Employee Permissions Catalog', path: '/api/permissions/catalog' },
    { name: 'Internal Messaging / Chat', path: '/api/chat/conversations' },
  ];

  for (const mod of modulesToProbe) {
    const res = await getJson(mod.path, adminHeaders);
    assert(
      res.status === 200,
      `Module Probe [${mod.name}]: ${mod.path} responds HTTP 200 OK`,
    );
  }

  // 8. Section 8: Security Verification
  console.log('\n--- SECTION 8: SECURITY VERIFICATION ---');
  // Direct access without token must return 401 Unauthorized
  const unauthRes = await getJson('/api/audit-logs');
  assert(unauthRes.status === 401, 'Security: Direct access to protected audit logs without token is blocked (HTTP 401)');

  const unauthProducts = await postJson('/api/products', { name: 'Exploit Product' });
  assert(unauthProducts.status === 401, 'Security: Unauthenticated product creation is blocked (HTTP 401)');

  // Tenant employee without permissions cannot delete products
  const employeeLogin = await postJson('/api/auth/login', {
    email: 'l1_agent@kanvtech.com',
    password: 'Password@123',
  });
  const employeeToken = employeeLogin.body?.token;
  if (employeeToken) {
    const empHeaders = { Authorization: `Bearer ${employeeToken}` };
    const empDelRes = await deleteReq('/api/products/PRD-0001', empHeaders);
    assert(
      empDelRes.status === 403,
      'Security: Normal tenant employee blocked from product deletion (HTTP 403 Forbidden)',
    );
  }

  console.log('\n========================================================================');
  console.log(` MASTER VERIFICATION FINISHED: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runMasterVerification().catch((e) => {
  console.error('Master verification script failed:', e);
  process.exit(1);
});
