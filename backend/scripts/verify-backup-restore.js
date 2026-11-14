const { execSync } = require('child_process');
const { Client } = require('pg');

const dumpFile = 'backend/backups/kanvtech_sm_dev_custom_user_id_predeploy_backup.dump';
const testDb = 'kanvtech_test_restore_audit';
const dropdb = 'C:\\Program Files\\PostgreSQL\\18\\bin\\dropdb.exe';
const createdb = 'C:\\Program Files\\PostgreSQL\\18\\bin\\createdb.exe';
const pgRestore = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';

const env = { ...process.env, PGPASSWORD: 'root' };

try {
  try {
    execSync(`"${dropdb}" -h localhost -p 5432 -U postgres --if-exists ${testDb}`, { env, stdio: 'pipe' });
  } catch {}

  execSync(`"${createdb}" -h localhost -p 5432 -U postgres ${testDb}`, { env, stdio: 'pipe' });
  console.log(`✓ Created test restore database: ${testDb}`);

  execSync(`"${pgRestore}" -h localhost -p 5432 -U postgres -d ${testDb} --no-owner --role=postgres "${dumpFile}"`, {
    env,
    stdio: 'pipe',
  });
  console.log(`✓ Restored backup dump into ${testDb}`);

  const client = new Client({
    connectionString: `postgresql://postgres:root@localhost:5432/${testDb}?schema=public`
  });
  client.connect().then(async () => {
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const empCount = await client.query('SELECT COUNT(*) FROM employees');
    const histCount = await client.query('SELECT COUNT(*) FROM user_id_change_history');
    const resCount = await client.query('SELECT COUNT(*) FROM reserved_user_ids');
    console.log('Restored table counts:', {
      users: userCount.rows[0].count,
      employees: empCount.rows[0].count,
      user_id_change_history: histCount.rows[0].count,
      reserved_user_ids: resCount.rows[0].count,
    });
    await client.end();

    execSync(`"${dropdb}" -h localhost -p 5432 -U postgres ${testDb}`, { env, stdio: 'pipe' });
    console.log(`✓ Cleaned up test restore database: ${testDb}`);
  });
} catch (e) {
  console.error('Restore verification failed:', e);
}

