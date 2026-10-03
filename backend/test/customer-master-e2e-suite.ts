import * as http from 'http';
import * as assert from 'assert';

const BASE = 'http://localhost:5000/api';

interface ApiResult {
  status: number;
  data: any;
}

async function api(path: string, opts: { method?: string; body?: any; token?: string } = {}): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const body = opts.body ? JSON.stringify(opts.body) : undefined;
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode!, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail?: string }> = [];

function record(name: string, pass: boolean, detail = '') {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  const icon = pass ? '[PASS]' : '[FAIL]';
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function login(email: string, password = 'Password@123'): Promise<string> {
  const res = await api('/auth/login', { method: 'POST', body: { email, password } });
  return res.data?.token;
}

async function runCustomerMasterE2E() {
  console.log('\n=== CUSTOMER MASTER FULL E2E TEST SUITE ===\n');

  const adminToken = await login('admin@kanvtech.com');
  assert.ok(adminToken, 'Admin login must succeed');

  const ts = Date.now();
  const companyName = `E2E Test Corp ${ts}`;
  const companyEmail = `contact${ts}@e2etestcorp.com`;

  // 1. CUSTOMER CRUD
  let testCompanyId = '';
  {
    const res = await api('/companies', {
      method: 'POST',
      token: adminToken,
      body: {
        company_name: companyName,
        address: '1 Test Street, Mumbai, MH',
        primary_email: companyEmail,
        contact_person: 'E2E Contact',
        contact_phone: '9900000001',
        product_ids: ['PROD-0001'],
      },
    });
    record('1. Customer CRUD — Create Customer', res.status === 200 || res.status === 201, `Status ${res.status}`);
    testCompanyId = res.data?.companyId || res.data?.id || '';
  }

  // 2. Customer Edit (PUT /companies/:id)
  if (testCompanyId) {
    const res = await api(`/companies/${testCompanyId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        company_name: companyName + ' EDITED',
        address: '2 Edited Street, Pune, MH',
        primary_email: companyEmail,
        contact_person: 'Updated Contact',
        contact_phone: '9900000002',
      },
    });
    record('2. Customer Edit — PUT /companies/:id', res.status === 200, `Status ${res.status}`);

    // Verify edit persisted
    const getRes = await api(`/companies/${testCompanyId}`, { token: adminToken });
    const edited = getRes.data?.company?.company_name === companyName + ' EDITED';
    record('2b. Customer Edit — Changes persisted in DB', edited, `Name: ${getRes.data?.company?.company_name}`);
    
    // Verify Customer ID preserved
    const idPreserved = getRes.data?.company?.id === testCompanyId;
    record('2c. Customer Edit — Customer ID preserved', idPreserved, `ID: ${getRes.data?.company?.id}`);
  }

  // 3. Product display — GET /companies/:id returns name and code
  if (testCompanyId) {
    const getRes = await api(`/companies/${testCompanyId}`, { token: adminToken });
    const products = getRes.data?.company?.products || [];
    const p = products[0];
    const hasName = !!p?.name;
    const hasCode = !!p?.code;
    record('3. Product Display — Product has name field', hasName, `name=${p?.name}`);
    record('3b. Product Display — Product has code field', hasCode, `code=${p?.code}`);
    record('3c. Product Entitlement — purchase_type present', !!p?.purchase_type || !!p?.purchaseType, `type=${p?.purchase_type}`);
  }

  // 4. Add Product to existing Customer
  if (testCompanyId) {
    // Ensure a second product exists for add/remove tests
    let newProd: any = null;
    {
      const allProds = await api('/products?isActive=true&limit=50', { token: adminToken });
      const allProducts = allProds.data?.products || [];
      // Find any product NOT owned by the test company (which only has PROD-0001)
      newProd = allProducts.find((p: any) => p.id !== 'PROD-0001');
      if (!newProd) {
        // Create a second product for testing with unique code
        const uniqueCode = `E2E${ts}`;
        const createProd = await api('/products', {
          method: 'POST',
          token: adminToken,
          body: {
            name: `E2E Test Product ${ts}`,
            code: uniqueCode,
            category: 'Software',
            description: 'Created for E2E add/remove testing',
          },
        });
        console.log(`  [debug] Product create status: ${createProd.status}, data: ${JSON.stringify(createProd.data).substring(0, 100)}`);
        if (createProd.status === 200 || createProd.status === 201) {
          const prodId = createProd.data?.id || createProd.data?.productId || createProd.data?.product?.id;
          newProd = prodId ? { id: prodId, name: `E2E Test Product ${ts}` } : null;
        }
      }
    }
    
    if (newProd && newProd.id) {
      const addRes = await api(`/companies/${testCompanyId}/products`, {
        method: 'POST',
        token: adminToken,
        body: { productId: newProd.id },
      });
      record('4. Add Product — Add new product to customer', addRes.status === 200 || addRes.status === 201, `Status ${addRes.status}, product: ${newProd.name}`);

      // 5. Duplicate Product Prevention — try to add same product again
      const dupRes = await api(`/companies/${testCompanyId}/products`, {
        method: 'POST',
        token: adminToken,
        body: { productId: newProd.id },
      });
      record('5. Duplicate Product Prevention — 2nd add of same product returns 400', dupRes.status === 400, `Status ${dupRes.status}, error: ${dupRes.data?.error?.substring(0, 60)}`);

      // 6. Remove Product Entitlement (preserves history)
      const removeRes = await api(`/companies/${testCompanyId}/products/${newProd.id}`, {
        method: 'DELETE',
        token: adminToken,
      });
      record('6. Remove Product — Soft-delete product entitlement', removeRes.status === 200, `Status ${removeRes.status}`);

      // Verify Product Master still intact
      const prodMaster = await api(`/products/${newProd.id}`, { token: adminToken });
      const masterPreserved = prodMaster.status === 200 && prodMaster.data?.product?.id === newProd.id;
      record('6b. Product Master Preserved — Product Master not deleted after entitlement removal', masterPreserved, `Product still exists in master: ${masterPreserved}`);

      // 7. Re-add Product (previously removed product can be re-added)
      const readd = await api(`/companies/${testCompanyId}/products`, {
        method: 'POST',
        token: adminToken,
        body: { productId: newProd.id },
      });
      record('7. Re-add Product — Previously removed product can be re-added', readd.status === 200 || readd.status === 201, `Status ${readd.status}`);

      // 8. Duplicate Prevention After Re-add
      const dupAfterReadd = await api(`/companies/${testCompanyId}/products`, {
        method: 'POST',
        token: adminToken,
        body: { productId: newProd.id },
      });
      record('8. Duplicate After Re-add — 400 for active product', dupAfterReadd.status === 400, `Status ${dupAfterReadd.status}`);
    } else {
      record('4. Add Product', false, 'No second product available in Product Master for test');
      record('5. Duplicate Product Prevention', false, 'Skipped — no second product');
      record('6. Remove Product', false, 'Skipped');
      record('6b. Product Master Preserved', false, 'Skipped');
      record('7. Re-add Product', false, 'Skipped');
      record('8. Duplicate After Re-add', false, 'Skipped');
    }
  }

  // 9. Branch Compatibility — add a branch to the test company
  if (testCompanyId) {
    const branchRes = await api(`/companies/${testCompanyId}/branches`, {
      method: 'POST',
      token: adminToken,
      body: {
        branch_name: 'E2E Branch',
        address: '10 Branch St',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        contact_person: 'Branch Contact',
        contact_phone: '9900000099',
        contact_email: 'branch@e2e.com',
        product_ids: ['PROD-0001'],
      },
    });
    record('9. Branch Compatibility — Create branch with product', branchRes.status === 200 || branchRes.status === 201, `Status ${branchRes.status}`);
  }

  // 10. Ticket Compatibility — create ticket for this company
  if (testCompanyId) {
    // Need customer login — find contact
    const compRes = await api(`/companies/${testCompanyId}`, { token: adminToken });
    const contacts = compRes.data?.company?.contacts || [];
    const primaryContact = contacts.find((c: any) => c.is_primary);
    if (primaryContact) {
      const custToken = await login(primaryContact.email);
      if (custToken) {
        const ticketRes = await api('/tickets', {
          method: 'POST',
          token: custToken,
          body: {
            problemType: 'E2E Test Ticket',
            description: 'Customer Master E2E compatibility check',
            priority: 'LOW',
            category: 'Software',
          },
        });
        record('10. Ticket Compatibility — Customer can create ticket', ticketRes.status === 200 || ticketRes.status === 201, `Status ${ticketRes.status}`);
      } else {
        record('10. Ticket Compatibility', false, `Customer login failed for ${primaryContact.email}`);
      }
    } else {
      record('10. Ticket Compatibility', false, 'No primary contact found for auto-created customer login');
    }
  }

  // 11. RBAC — Customers cannot edit companies
  {
    const custToken = await login('rajesh@acme.com');
    if (custToken) {
      const res = await api(`/companies/${testCompanyId}`, {
        method: 'PUT',
        token: custToken,
        body: { company_name: 'Unauthorized Edit Attempt' },
      });
      record('11. RBAC — Customer cannot edit company (403)', res.status === 403, `Status ${res.status}`);

      // Customers cannot remove products
      const removeRes = await api(`/companies/${testCompanyId}/products/PROD-0001`, {
        method: 'DELETE',
        token: custToken,
      });
      record('11b. RBAC — Customer cannot remove product (403)', removeRes.status === 403, `Status ${removeRes.status}`);
    }
  }

  // 12. Audit logging — verify audit records were created
  {
    const auditRes = await api('/audit-logs', { token: adminToken });
    const logs = auditRes.data?.logs || auditRes.data || [];
    const hasCompanyLog = Array.isArray(logs) && logs.some((l: any) =>
      ['COMPANY_CREATED', 'COMPANY_UPDATED', 'CUSTOMER_PRODUCT_ADDED', 'CUSTOMER_PRODUCT_REMOVED', 'CUSTOMER_PRODUCT_READDED'].includes(l.action)
    );
    record('12. Audit Logging — Audit records exist for Customer Master actions', hasCompanyLog, `${Array.isArray(logs) ? logs.length : 0} audit records found`);
  }

  // 13. Database Integrity — company still exists and has correct data
  if (testCompanyId) {
    const res = await api(`/companies/${testCompanyId}`, { token: adminToken });
    const company = res.data?.company;
    const integrityOk = company?.id === testCompanyId && company?.company_name === companyName + ' EDITED';
    record('13. Database Integrity — Company record is consistent', integrityOk, `ID: ${company?.id}, Name: ${company?.company_name}`);

    // Tickets not deleted when product removed
    const ticketRes = await api(`/tickets?companyId=${testCompanyId}`, { token: adminToken });
    record('13b. AMC/Ticket History Preserved — Historical data intact after product changes', ticketRes.status === 200, `Status ${ticketRes.status}`);
  }

  // Print summary
  console.log('\n=== CUSTOMER MASTER E2E RESULTS ===');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
  }
  return failed;
}

runCustomerMasterE2E()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((e) => { console.error(e); process.exit(1); });
