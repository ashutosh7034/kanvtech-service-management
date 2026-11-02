const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Connecting to kanvtech_sm_dev...');
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/kanvtech_sm_dev',
  });

  try {
    await client.connect();
    console.log('Connected to kanvtech_sm_dev.');

    const sqlPath = path.resolve(__dirname, '../prisma/migrations/20261027200000_multi_tenant_architecture/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing multi-tenant migration on isolated dev database...');
    await client.query(sql);
    console.log('Migration executed successfully on kanvtech_sm_dev!');

    // Verify tenants
    const tenants = await client.query('SELECT * FROM "tenants"');
    console.log('Tenants:', tenants.rows);

    // Verify memberships
    const memberships = await client.query('SELECT count(*) FROM "tenant_memberships"');
    console.log('Total memberships created:', memberships.rows[0].count);

    // Verify admin user
    const admin = await client.query("SELECT id, email, role, is_super_admin, default_tenant_id FROM \"users\" WHERE email = 'admin@kanvtech.com'");
    console.log('Admin user status:', admin.rows[0]);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
