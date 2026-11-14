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
  console.log('--- TESTING DIRECT BACKEND (Port 5000) ---');
  
  // Test 1: Email login (admin@kanvtech.com)
  const resEmail = await postLogin(5000, {
    identifier: 'admin@kanvtech.com',
    password: 'Password@123',
    selectedTenantId: 'KANVTECH',
  });
  console.log('1. Email (admin@kanvtech.com):', resEmail.status, resEmail.body?.success ? 'SUCCESS' : resEmail.body);

  // Test 2: Custom User ID login (sysadmin)
  const resCustomId = await postLogin(5000, {
    identifier: 'sysadmin',
    password: 'Password@123',
    selectedTenantId: 'KANVTECH',
  });
  console.log('2. Custom User ID (sysadmin):', resCustomId.status, resCustomId.body?.success ? 'SUCCESS' : resCustomId.body);

  // Test 3: Employee ID (EMP-000)
  const resEmp000 = await postLogin(5000, {
    identifier: 'EMP-000',
    password: 'Password@123',
    selectedTenantId: 'KANVTECH',
  });
  console.log('3. Identifier EMP-000:', resEmp000.status, resEmp000.body?.success ? 'SUCCESS' : resEmp000.body);

  console.log('\n--- TESTING VIA NEXT.JS PROXY (Port 3000) ---');
  // Test 4: Next.js proxy with sysadmin
  const resProxyCustom = await postLogin(3000, {
    identifier: 'sysadmin',
    password: 'Password@123',
  });
  console.log('4. Proxy Custom User ID (sysadmin):', resProxyCustom.status, resProxyCustom.body?.success ? 'SUCCESS' : resProxyCustom.body);

  // Test 5: Next.js proxy with admin@kanvtech.com
  const resProxyEmail = await postLogin(3000, {
    identifier: 'admin@kanvtech.com',
    password: 'Password@123',
  });
  console.log('5. Proxy Email (admin@kanvtech.com):', resProxyEmail.status, resProxyEmail.body?.success ? 'SUCCESS' : resProxyEmail.body);

  // Test 6: Next.js proxy with EMP-000
  const resProxyEmp000 = await postLogin(3000, {
    identifier: 'EMP-000',
    password: 'Password@123',
  });
  console.log('6. Proxy Identifier EMP-000:', resProxyEmp000.status, resProxyEmp000.body?.success ? 'SUCCESS' : resProxyEmp000.body);
}

run().catch(console.error);

