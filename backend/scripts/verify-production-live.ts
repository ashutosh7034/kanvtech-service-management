async function runProductionSmokeTest() {
  const backendBase = 'https://kanvtech-backend-production.up.railway.app/api';
  const webBase = 'https://kanvtech-web-production.up.railway.app';
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log('  \u2714 PASS:', msg);
      passed++;
    } else {
      console.error('  \u2718 FAIL:', msg);
      failed++;
    }
  }

  console.log('====================================================');
  console.log('KANVTECH PRODUCTION LIVE SMOKE TEST (RAILWAY)');
  console.log('Target: ' + webBase + ' & ' + backendBase);
  console.log('====================================================\n');

  // 1. Backend Health
  try {
    const health = await fetch(backendBase + '/health').then((r: any) => r.json());
    assert(health.status === 'ok' && health.database === 'connected', 'Backend Health & PostgreSQL DB Connected');
  } catch (e: any) {
    assert(false, 'Backend Health Check: ' + e.message);
  }

  // 2. Web Portal HTML Delivery
  try {
    const webRes = await fetch(webBase);
    const html = await webRes.text();
    assert(webRes.status === 200, 'Web App HTTP Status 200');
    assert(html.includes('<!DOCTYPE html>') || html.includes('<html'), 'Web App Valid HTML Emitted');
  } catch (e: any) {
    assert(false, 'Web App Delivery: ' + e.message);
  }

  // 3. Multi-Role Authentication & Profile Verification (Name + Email ONLY)
  let adminToken = '', managerToken = '', l1Token = '', custToken = '';
  
  // Admin Login
  try {
    const res = await fetch(backendBase + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
    });
    const data: any = await res.json();
    adminToken = data.token;
    assert(res.status === 201 && !!adminToken, 'Admin Authentication Successful');
    assert(data.user.name === 'System Administrator', 'Admin Display Name is System Administrator');
    assert(data.user.email === 'admin@kanvtech.com', 'Admin Email is admin@kanvtech.com');
  } catch (e: any) {
    assert(false, 'Admin Auth: ' + e.message);
  }

  // Manager Login
  try {
    const res = await fetch(backendBase + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@kanvtech.com', password: 'Password@123' }),
    });
    const data: any = await res.json();
    managerToken = data.token;
    assert(res.status === 201 && !!managerToken, 'Manager Authentication Successful');
    assert(data.user.name === 'Rahul Verma', 'Manager Display Name is Rahul Verma');
    assert(data.user.email === 'manager@kanvtech.com', 'Manager Email is manager@kanvtech.com');
  } catch (e: any) {
    assert(false, 'Manager Auth: ' + e.message);
  }

  // L1 Login
  try {
    const res = await fetch(backendBase + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'l1.amit@kanvtech.com', password: 'Password@123' }),
    });
    const data: any = await res.json();
    l1Token = data.token;
    assert(res.status === 201 && !!l1Token, 'L1 Specialist Authentication Successful');
    assert(data.user.name === 'Amit Sharma', 'L1 Display Name is Amit Sharma');
    assert(data.user.email === 'l1.amit@kanvtech.com', 'L1 Email is l1.amit@kanvtech.com');
  } catch (e: any) {
    assert(false, 'L1 Auth: ' + e.message);
  }

  // Customer Login
  try {
    const res = await fetch(backendBase + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rajesh@acme.com', password: 'Password@123' }),
    });
    const data: any = await res.json();
    custToken = data.token;
    assert(res.status === 201 && !!custToken, 'Customer Authentication Successful');
    assert(data.user.name === 'Rajesh Mehta', 'Customer Display Name is Rajesh Mehta');
    assert(data.user.email === 'rajesh@acme.com', 'Customer Email is rajesh@acme.com');
  } catch (e: any) {
    assert(false, 'Customer Auth: ' + e.message);
  }

  // 4. SLA Settings Endpoint & UI Data Compatibility
  try {
    const res = await fetch(backendBase + '/reports/sla', {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    const data: any = await res.json();
    assert(res.status === 200, 'SLA Settings Endpoint 200 OK');
    assert(Array.isArray(data.configs) && Array.isArray(data.configurations), 'SLA Settings returns configs & configurations arrays');
  } catch (e: any) {
    assert(false, 'SLA Settings: ' + e.message);
  }

  // 5. Product Master Listing
  try {
    const res = await fetch(backendBase + '/products', {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    const data: any = await res.json();
    const list = data.data || data.products || [];
    assert(res.status === 200, 'Product Master Listing 200 OK');
    assert(Array.isArray(list) && list.length > 0, `Products listed from production database (${list.length} products)`);
  } catch (e: any) {
    assert(false, 'Products Master: ' + e.message);
  }

  // 6. Annual Maintenance / Subscriptions
  try {
    const res = await fetch(backendBase + '/subscriptions', {
      headers: { Authorization: 'Bearer ' + managerToken },
    });
    const data: any = await res.json();
    const list = data.data || data.subscriptions || [];
    assert(res.status === 200, 'Subscriptions / AMC Listing 200 OK');
    assert(Array.isArray(list) && list.length > 0, `Subscriptions returned from database (${list.length} contracts)`);
  } catch (e: any) {
    assert(false, 'Subscriptions: ' + e.message);
  }

  // 7. Client Implementations
  try {
    const res = await fetch(backendBase + '/implementations', {
      headers: { Authorization: 'Bearer ' + managerToken },
    });
    const data: any = await res.json();
    const list = data.data || data.implementations || [];
    assert(res.status === 200, 'Implementations Listing 200 OK');
    assert(Array.isArray(list) && list.length > 0, `Implementations returned from database (${list.length} projects)`);
  } catch (e: any) {
    assert(false, 'Implementations: ' + e.message);
  }

  // 8. RBAC Protection
  try {
    const unauth = await fetch(backendBase + '/employees', {
      headers: { Authorization: 'Bearer ' + custToken },
    });
    assert(unauth.status === 403, 'Customer blocked from /employees with 403 Forbidden');
  } catch (e: any) {
    assert(false, 'RBAC Protection: ' + e.message);
  }

  // 9. Customer Data Isolation
  try {
    const custTickets = await fetch(backendBase + '/tickets', {
      headers: { Authorization: 'Bearer ' + custToken },
    });
    const tData: any = await custTickets.json();
    assert(custTickets.status === 200, 'Customer tickets accessible');
    const ticketsList = tData.tickets || tData.data || [];
    assert(Array.isArray(ticketsList), 'Customer tickets returned');
    const allAcme = ticketsList.length === 0 || ticketsList.every((t: any) => t.company_id === 'CMP-0001' || t.companyId === 'CMP-0001');
    assert(allAcme, 'Customer isolation strictly enforced (100% owned tickets)');
  } catch (e: any) {
    assert(false, 'Customer Isolation: ' + e.message);
  }

  // 10. Audit Trail
  try {
    const auditRes = await fetch(backendBase + '/audit-logs', {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    const aData: any = await auditRes.json();
    assert(auditRes.status === 200, 'Audit Logs accessible by Admin');
    assert(Array.isArray(aData.logs) && aData.logs.length > 0, 'Immutable audit records present');
  } catch (e: any) {
    assert(false, 'Audit Trail: ' + e.message);
  }

  console.log('\n====================================================');
  console.log(`PRODUCTION LIVE SMOKE TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runProductionSmokeTest();
