const { PrismaClient } = require('@prisma/client');

async function main() {
  const adminClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:password@localhost:5432/postgres?schema=public',
      },
    },
  });

  console.log('[Staging DB Setup] Connecting to maintenance postgres DB...');
  
  // Terminate any existing connections to kanvtech_sm_staging
  try {
    await adminClient.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'kanvtech_sm_staging'
        AND pid <> pg_backend_pid();
    `);
  } catch (err) {
    // Ignore if db doesn't exist
  }

  console.log('[Staging DB Setup] Dropping kanvtech_sm_staging if exists...');
  await adminClient.$executeRawUnsafe('DROP DATABASE IF EXISTS kanvtech_sm_staging;');

  console.log('[Staging DB Setup] Creating completely clean, empty kanvtech_sm_staging database...');
  await adminClient.$executeRawUnsafe('CREATE DATABASE kanvtech_sm_staging;');

  console.log('[Staging DB Setup] SUCCESS: Completely fresh empty database kanvtech_sm_staging created.');
  await adminClient.$disconnect();
}

main().catch((e) => {
  console.error('[Staging DB Setup Error]:', e);
  process.exit(1);
});
