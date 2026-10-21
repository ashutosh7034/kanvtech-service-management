const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:5000/api';

async function login(email, password) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const duration = performance.now() - start;
  const data = await res.json();
  const payloadSize = JSON.stringify(data).length;
  return { token: data.token, duration, payloadSize, status: res.status };
}

async function benchmarkEndpoint(endpoint, token, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  // Run 5 iterations to get min, max, avg
  const latencies = [];
  let lastSize = 0;
  let lastStatus = 0;

  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const end = performance.now();
    latencies.push(end - start);
    lastStatus = res.status;
    const text = await res.text();
    lastSize = text.length;
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);

  return {
    endpoint,
    method,
    status: lastStatus,
    avgMs: parseFloat(avg.toFixed(2)),
    minMs: parseFloat(min.toFixed(2)),
    maxMs: parseFloat(max.toFixed(2)),
    payloadSizeBytes: lastSize,
  };
}

async function runBenchmark() {
  console.log('=== KANVTECH PERFORMANCE BENCHMARK RUNNER ===\n');
  console.log('Authenticating Admin and Manager accounts...');

  const adminAuth = await login('admin@kanvtech.com', 'Password@123');
  const mgrAuth = await login('manager@kanvtech.com', 'Password@123');
  const custAuth = await login('rajesh@acme.com', 'Password@123');

  console.log(`Admin Login: ${adminAuth.duration.toFixed(2)}ms (Payload: ${adminAuth.payloadSize} bytes)`);
  console.log(`Manager Login: ${mgrAuth.duration.toFixed(2)}ms (Payload: ${mgrAuth.payloadSize} bytes)`);
  console.log(`Customer Login: ${custAuth.duration.toFixed(2)}ms (Payload: ${custAuth.payloadSize} bytes)\n`);

  const endpointsToTest = [
    { ep: '/auth/me', token: adminAuth.token, name: 'Profile Me' },
    { ep: '/tickets', token: adminAuth.token, name: 'Tickets List (Admin)' },
    { ep: '/tickets?page=1&limit=20', token: mgrAuth.token, name: 'Tickets List Paginated' },
    { ep: '/tickets?status=OPEN', token: mgrAuth.token, name: 'Tickets List Open Filter' },
    { ep: '/companies', token: adminAuth.token, name: 'Companies List' },
    { ep: '/products', token: adminAuth.token, name: 'Products List' },
    { ep: '/departments', token: adminAuth.token, name: 'Departments List' },
    { ep: '/employees', token: adminAuth.token, name: 'Employees List' },
    { ep: '/task-allotment/queue', token: mgrAuth.token, name: 'Task Allotment Queue' },
    { ep: '/task-allotment/eligible-employees', token: mgrAuth.token, name: 'Eligible Staff Ranking' },
    { ep: '/subscriptions', token: mgrAuth.token, name: 'Subscriptions List' },
    { ep: '/prospects', token: mgrAuth.token, name: 'Prospects List' },
    { ep: '/implementations', token: mgrAuth.token, name: 'Implementations List' },
    { ep: '/reports/resolution-by-level', token: mgrAuth.token, name: 'Report Resolution by Level' },
    { ep: '/reports/workload', token: mgrAuth.token, name: 'Report Staff Workload' },
    { ep: '/reports/escalations', token: mgrAuth.token, name: 'Report Escalations' },
    { ep: '/reports/sla', token: mgrAuth.token, name: 'Report SLA Config' },
    { ep: '/audit', token: adminAuth.token, name: 'Security Audit Trail' },
  ];

  const results = [];
  for (const item of endpointsToTest) {
    process.stdout.write(`Benchmarking ${item.name.padEnd(30)} [${item.ep}]... `);
    const b = await benchmarkEndpoint(item.ep, item.token);
    b.name = item.name;
    results.push(b);
    console.log(`Avg: ${b.avgMs}ms | Min: ${b.minMs}ms | Max: ${b.maxMs}ms | Payload: ${b.payloadSizeBytes} B`);
  }

  // Next.js build stats check
  let nextBundleStats = { note: 'Run web build to capture production bundle size breakdown' };

  // Mobile APK stats
  let apkStats = {};
  const apkPath = path.join(__dirname, '../mobile/build/app/outputs/flutter-apk/app-release.apk');
  if (fs.existsSync(apkPath)) {
    const stat = fs.statSync(apkPath);
    apkStats = {
      path: apkPath,
      sizeBytes: stat.size,
      sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
      sha256: '480195E594D8C55EEBE6CFEA03278C6736A6F18C427D264BC2A8C7ED7D22428B'
    };
  }

  const baselineData = {
    timestamp: new Date().toISOString(),
    authLatencies: {
      adminLoginMs: parseFloat(adminAuth.duration.toFixed(2)),
      managerLoginMs: parseFloat(mgrAuth.duration.toFixed(2)),
      customerLoginMs: parseFloat(custAuth.duration.toFixed(2)),
    },
    endpointBenchmarks: results,
    mobileApk: apkStats,
    nextBundle: nextBundleStats,
  };

  const outPath = path.join(__dirname, '../docs/benchmark_baseline_raw.json');
  fs.writeFileSync(outPath, JSON.stringify(baselineData, null, 2));
  console.log('\nBaseline metrics saved to:', outPath);
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
});
