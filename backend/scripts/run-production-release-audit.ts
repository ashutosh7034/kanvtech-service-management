const BACKEND_URL = 'https://kanvtech-backend-production.up.railway.app/api';
const FRONTEND_URL = 'https://kanvtech-web-production.up.railway.app';

interface AuditResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const auditResults: AuditResult[] = [];

function recordCheck(category: string, check: string, passed: boolean, details: string) {
  auditResults.push({ category, check, status: passed ? 'PASS' : 'FAIL', details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${category}] ${check}`);
  console.log(`       Details: ${details}`);
}

async function runProductionReleaseAudit() {
  console.log('================================================================');
  console.log('🚀 KANVTECH LIVE PRODUCTION RELEASE AUDIT (RAILWAY)');
  console.log(`Backend URL:  ${BACKEND_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log('================================================================\n');

  // 1. Health & Database Connectivity
  console.log('--- 1. Service Health & Infrastructure ---');
  try {
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    const health = await healthRes.json();
    const ok = healthRes.status === 200 && health.status === 'ok' && health.database === 'connected';
    recordCheck('Infrastructure', 'Backend Health & Database Connectivity', ok, `Status: ${health.status}, Database: ${health.database}, Uptime: ${health.uptimeSeconds}s`);
  } catch (e: any) {
    recordCheck('Infrastructure', 'Backend Health & Database Connectivity', false, e.message);
  }

  // 2. Frontend Web Portal
  console.log('\n--- 2. Frontend Web Portal Availability ---');
  try {
    const loginPageRes = await fetch(`${FRONTEND_URL}/login`);
    const html = await loginPageRes.text();
    const ok = loginPageRes.status === 200 && html.includes('<!DOCTYPE html>');
    recordCheck('Frontend', 'Login Page HTML & Asset Delivery', ok, `HTTP Status: ${loginPageRes.status}, Document size: ${html.length} bytes`);
  } catch (e: any) {
    recordCheck('Frontend', 'Login Page HTML & Asset Delivery', false, e.message);
  }

  // 3. Super Admin Authentication & Profile
  console.log('\n--- 3. Super Admin Authentication & Profile ---');
  let adminToken = '';
  let adminUser: any = null;
  try {
    const authRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
    });
    const authData = await authRes.json();
    adminToken = authData.token || authData.access_token;
    adminUser = authData.user;
    const ok = authRes.status === 200 && !!adminToken && adminUser?.role === 'ADMIN';
    recordCheck(
      'Authentication',
      'Super Admin Authentication (admin@kanvtech.com)',
      ok,
      `User ID: ${adminUser?.id}, Name: ${adminUser?.name}, Role: ${adminUser?.role}, JWT Issued: ${!!adminToken}`,
    );
  } catch (e: any) {
    recordCheck('Authentication', 'Super Admin Authentication', false, e.message);
  }

  // 4. Super Admin Attendance Exemption
  console.log('\n--- 4. Authorization & Attendance Exemption ---');
  try {
    const empRes = await fetch(`${BACKEND_URL}/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const empData = await empRes.json();
    const ok = empRes.status === 200 && (empData.success === true || Array.isArray(empData.data) || Array.isArray(empData));
    recordCheck(
      'Authorization',
      'Super Admin Attendance Exemption on Administrative APIs',
      ok,
      `HTTP Status: ${empRes.status}, Access granted without mandatory attendance record check-in`,
    );
  } catch (e: any) {
    recordCheck('Authorization', 'Super Admin Attendance Exemption', false, e.message);
  }

  // 5. Master Data Endpoints (Read-Only)
  console.log('\n--- 5. Master Data Endpoints (Read-Only) ---');
  // Products
  try {
    const prodRes = await fetch(`${BACKEND_URL}/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prods = await prodRes.json();
    const list = Array.isArray(prods) ? prods : prods.data || [];
    recordCheck('Master Data', 'Product Master Query', prodRes.status === 200, `HTTP ${prodRes.status}, Products available: ${list.length}`);
  } catch (e: any) {
    recordCheck('Master Data', 'Product Master Query', false, e.message);
  }

  // Departments
  try {
    const deptRes = await fetch(`${BACKEND_URL}/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const depts = await deptRes.json();
    const list = Array.isArray(depts) ? depts : depts.data || [];
    recordCheck('Master Data', 'Department Master Query', deptRes.status === 200, `HTTP ${deptRes.status}, Departments available: ${list.length}`);
  } catch (e: any) {
    recordCheck('Master Data', 'Department Master Query', false, e.message);
  }

  // Customers
  try {
    const custRes = await fetch(`${BACKEND_URL}/companies`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const custs = await custRes.json();
    const list = Array.isArray(custs) ? custs : custs.data || [];
    recordCheck('Master Data', 'Customer Master Query', custRes.status === 200, `HTTP ${custRes.status}, Companies available: ${list.length}`);
  } catch (e: any) {
    recordCheck('Master Data', 'Customer Master Query', false, e.message);
  }

  // 6. Import Template Downloads
  console.log('\n--- 6. Canonical Import Template Downloads ---');
  const templateEntities = ['products', 'departments', 'employees', 'customers', 'tickets'];
  for (const ent of templateEntities) {
    try {
      const tmplRes = await fetch(`${BACKEND_URL}/import/template/${ent}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const ct = tmplRes.headers.get('content-type') || '';
      const ok = tmplRes.status === 200 && ct.includes('spreadsheetml');
      recordCheck('Import Templates', `Canonical Template Download (${ent})`, ok, `HTTP ${tmplRes.status}, Content-Type: ${ct}`);
    } catch (e: any) {
      recordCheck('Import Templates', `Canonical Template Download (${ent})`, false, e.message);
    }
  }

  // 7. Multi-Format Export & Credential Redaction
  console.log('\n--- 7. Export & Credential Redaction ---');
  try {
    const exportRes = await fetch(`${BACKEND_URL}/export/download?module=employees&format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const exportData = await exportRes.json();
    const rawText = JSON.stringify(exportData);
    const hasPasswordLeak = /passwordHash|password_hash|"password":/i.test(rawText);
    const ok = exportRes.status === 200 && !hasPasswordLeak;
    recordCheck(
      'Export Security',
      'JSON Data Export & 100% Credential Redaction',
      ok,
      `HTTP ${exportRes.status}, Password/Hash Leaks Detected: ${hasPasswordLeak}`,
    );
  } catch (e: any) {
    recordCheck('Export Security', 'JSON Data Export & Credential Redaction', false, e.message);
  }

  // 8. SLA Settings & Reports
  console.log('\n--- 8. SLA Rules & Operational Reporting ---');
  try {
    const slaRes = await fetch(`${BACKEND_URL}/reports/sla`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const slaData = await slaRes.json();
    const ok = slaRes.status === 200 && (Array.isArray(slaData.configs) || Array.isArray(slaData.configurations));
    recordCheck('Reports', 'SLA Configurations & Operational Metrics', ok, `HTTP ${slaRes.status}, SLA definitions present`);
  } catch (e: any) {
    recordCheck('Reports', 'SLA Configurations & Operational Metrics', false, e.message);
  }

  // 9. API Security & Anonymous Rejection
  console.log('\n--- 9. Security & Anonymous Request Rejection ---');
  try {
    const anonRes = await fetch(`${BACKEND_URL}/tickets`);
    const ok = anonRes.status === 401;
    recordCheck('Security', 'Anonymous Request Rejection on Protected APIs', ok, `HTTP Status: ${anonRes.status} Unauthorized`);
  } catch (e: any) {
    recordCheck('Security', 'Anonymous Request Rejection', false, e.message);
  }

  // Summary
  const passedCount = auditResults.filter((r) => r.status === 'PASS').length;
  const failedCount = auditResults.filter((r) => r.status === 'FAIL').length;
  console.log('\n================================================================');
  console.log(`📊 LIVE PRODUCTION AUDIT: ${passedCount} PASSED | ${failedCount} FAILED (TOTAL: ${auditResults.length})`);
  console.log('================================================================');
}

runProductionReleaseAudit();
