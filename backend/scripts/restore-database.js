const { PrismaClient } = require('@prisma/client');

async function main() {
  const snapshotName = process.argv[2];
  if (!snapshotName) {
    console.error('Usage: node scripts/restore-database.js <snapshot_clone_database_name>');
    console.error('Example: node scripts/restore-database.js kanvtech_sm_staging_backup_20260919144500');
    process.exit(1);
  }

  const adminClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:password@localhost:5432/postgres?schema=public',
      },
    },
  });

  console.log('=======================================================');
  console.log(`RESTORING STAGING DATABASE FROM SNAPSHOT: ${snapshotName}`);
  console.log('=======================================================');

  // Terminate connections to target DB
  console.log('[1/3] Terminating connections to kanvtech_sm_staging...');
  await adminClient.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'kanvtech_sm_staging' AND pid <> pg_backend_pid();
  `);

  // Drop current staging DB
  console.log('[2/3] Dropping current kanvtech_sm_staging...');
  await adminClient.$executeRawUnsafe('DROP DATABASE IF EXISTS "kanvtech_sm_staging";');

  // Recreate from template snapshot
  console.log(`[3/3] Restoring kanvtech_sm_staging from snapshot ${snapshotName}...`);
  await adminClient.$executeRawUnsafe(`CREATE DATABASE "kanvtech_sm_staging" TEMPLATE "${snapshotName}";`);

  console.log('=======================================================');
  console.log('RESTORE COMPLETED SUCCESSFULLY.');
  console.log('=======================================================');

  await adminClient.$disconnect();
}

main().catch(err => {
  console.error('[Restore Error]:', err);
  process.exit(1);
});
