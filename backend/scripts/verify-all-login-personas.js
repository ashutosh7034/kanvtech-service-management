const http = require('http');

function postLogin(port, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
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
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('  AUTHENTICATION VERIFICATION SUITE — ALL PERSONAS & LOGIN MODES');
  console.log('========================================================================\n');

  // 1. Registered Email Login for EMP-000 (admin@kanvtech.com)
  console.log('--- 1. Login using registered email for EMP-000 (admin@kanvtech.com) ---');
  const res1 = await postLogin(3000, {
    identifier: 'admin@kanvtech.com',
    password: 'Password@123',
  });
  console.log(`Status: ${res1.status} | Success: ${!!res1.body?.token} | User: ${res1.body?.user?.email} | Role: ${res1.body?.user?.role} | Custom ID: ${res1.body?.user?.customUserId}`);

  // 2. Actual Assigned Custom User ID for EMP-000 (sysadmin)
  console.log('\n--- 2. Login using actual assigned Custom User ID for EMP-000 (sysadmin) ---');
  const res2 = await postLogin(3000, {
    identifier: 'sysadmin',
    password: 'Password@123',
  });
  console.log(`Status: ${res2.status} | Success: ${!!res2.body?.token} | User: ${res2.body?.user?.email} | Role: ${res2.body?.user?.role} | Custom ID: ${res2.body?.user?.customUserId}`);

  // 3. Attempting login using Employee Code (EMP-000)
  console.log('\n--- 3. Attempting login using Employee Directory Code (EMP-000) ---');
  const res3 = await postLogin(3000, {
    identifier: 'EMP-000',
    password: 'Password@123',
  });
  console.log(`Status: ${res3.status} | Expected 401 Unauthorized because EMP-000 is employee code, not Custom User ID.`);
  console.log(`Error Response:`, res3.body?.message || res3.body?.error);

  // 4. Platform Administrator Login (ashutosh@kanvtech.com / ashutosh)
  console.log('\n--- 4. Platform Administrator Login (ashutosh@kanvtech.com / ashutosh) ---');
  const res4a = await postLogin(3000, {
    identifier: 'ashutosh@kanvtech.com',
    password: 'Password@123',
  });
  console.log(`Email Status: ${res4a.status} | Success: ${!!res4a.body?.token} | Role: ${res4a.body?.user?.role}`);

  const res4b = await postLogin(3000, {
    identifier: 'ashutosh',
    password: 'Password@123',
  });
  console.log(`User ID Status: ${res4b.status} | Success: ${!!res4b.body?.token} | Role: ${res4b.body?.user?.role}`);

  // 5. Tenant Employee Login (l1_agent@kanvtech.com / l1_agent)
  console.log('\n--- 5. Tenant Employee Login (l1_agent@kanvtech.com / l1_agent) ---');
  const res5a = await postLogin(3000, {
    identifier: 'l1_agent@kanvtech.com',
    password: 'Password@123',
  });
  console.log(`Email Status: ${res5a.status} | Success: ${!!res5a.body?.token} | Role: ${res5a.body?.user?.role}`);

  const res5b = await postLogin(3000, {
    identifier: 'l1_agent',
    password: 'Password@123',
  });
  console.log(`User ID Status: ${res5b.status} | Success: ${!!res5b.body?.token} | Role: ${res5b.body?.user?.role}`);
}

run().catch(console.error);

