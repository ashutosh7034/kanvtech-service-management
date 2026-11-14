const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/kanvtech_sm_dev?schema=public'
  });
  await client.connect();

  console.log('--- 1. POSTGRESQL INDEXES ON users ---');
  const indexRes = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'users' 
      AND (indexname LIKE '%custom_user_id%' OR indexdef LIKE '%custom_user_id%')
  `);
  console.log(indexRes.rows);

  console.log('\n--- 2. DATABASE UNIQUENESS TEST (Attempting duplicate INSERT with case variation) ---');
  let lowerCaseCollisionBlocked = false;
  try {
    // Attempt inserting duplicate with mixed case: 'SYSADMIN' vs existing 'sysadmin'
    await client.query(`
      INSERT INTO users (email, password_hash, role, custom_user_id, is_active, created_at, updated_at)
      VALUES ('test_case_dup@kanvtech.com', 'dummy_hash', 'CUSTOMER', 'SYSADMIN', true, NOW(), NOW())
    `);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      lowerCaseCollisionBlocked = true;
      console.log('PostgreSQL blocked case-insensitive duplicate insertion:', err.message, '| Constraint:', err.constraint);
    } else {
      console.error('Unexpected error on duplicate insert:', err);
    }
  }
  console.log('Case-insensitive uniqueness enforced by PostgreSQL:', lowerCaseCollisionBlocked);

  console.log('\n--- 3. CONSISTENCY BETWEEN users.custom_user_id AND employees.custom_user_id ---');
  const inconsistencyRes = await client.query(`
    SELECT e.id as emp_id, e.user_id, e.custom_user_id as emp_custom_id, u.custom_user_id as user_custom_id
    FROM employees e
    JOIN users u ON e.user_id = u.id
    WHERE e.custom_user_id IS DISTINCT FROM u.custom_user_id
  `);
  console.log('Total inconsistent records found:', inconsistencyRes.rows.length);
  if (inconsistencyRes.rows.length > 0) {
    console.log('Inconsistent rows:', inconsistencyRes.rows);
  }

  console.log('\n--- 4. HISTORICAL RESERVED USER IDS ---');
  const reservedRes = await client.query(`
    SELECT user_id, reason, created_at 
    FROM reserved_user_ids 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  console.log('Sample reserved identifiers:', reservedRes.rows);

  console.log('\n--- 5. GRANULAR PERMISSIONS IN DATABASE ---');
  const permRes = await client.query(`
    SELECT permission_code, module, action, description 
    FROM permissions 
    WHERE permission_code LIKE 'employee.user_id%'
    ORDER BY permission_code ASC
  `);
  console.log('Granular custom user ID permissions in catalog:', permRes.rows);

  console.log('\n--- 6. PLATFORM INCHARGE / SUPER ADMIN ACCOUNTS ---');
  const platformAccounts = await client.query(`
    SELECT id, email, role, custom_user_id, is_active 
    FROM users 
    WHERE role IN ('PLATFORM_INCHARGE', 'SUPER_ADMIN')
    ORDER BY id ASC
  `);
  console.log('Platform accounts:', platformAccounts.rows);

  console.log('\n--- 7. PRISMA MIGRATIONS APPLIED IN DATABASE ---');
  const migrationsRes = await client.query(`
    SELECT id, migration_name, finished_at, applied_steps_count 
    FROM _prisma_migrations 
    ORDER BY finished_at DESC 
    LIMIT 5
  `);
  console.log('Recent Prisma migrations:', migrationsRes.rows);

  await client.end();
}

main().catch(console.error);

