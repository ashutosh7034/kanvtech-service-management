const { Client } = require('pg');

async function main() {
  console.log('Connecting to PostgreSQL server...');
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/postgres',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server.');

    // Check if kanvtech_sm_dev already exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'kanvtech_sm_dev'");
    if (res.rows.length > 0) {
      console.log('Database kanvtech_sm_dev already exists. Dropping for a fresh isolated copy...');
      // Terminate any active connections to kanvtech_sm_dev
      await client.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'kanvtech_sm_dev' AND pid <> pg_backend_pid();
      `);
      await client.query('DROP DATABASE kanvtech_sm_dev');
    }

    // Terminate any active connections to kanvtech_sm_staging so it can be used as template
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'kanvtech_sm_staging' AND pid <> pg_backend_pid();
    `);

    console.log('Creating isolated development database kanvtech_sm_dev as clone of kanvtech_sm_staging...');
    await client.query('CREATE DATABASE kanvtech_sm_dev TEMPLATE kanvtech_sm_staging');
    console.log('Successfully created isolated development database kanvtech_sm_dev!');
  } catch (err) {
    console.error('Error setting up isolated development database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
