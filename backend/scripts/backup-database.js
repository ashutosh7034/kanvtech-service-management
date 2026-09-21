const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const adminClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:password@localhost:5432/postgres?schema=public',
      },
    },
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDbName = `kanvtech_sm_staging_backup_${timestamp.substring(0, 19).replace(/[^0-9]/g, '')}`;

  console.log('=======================================================');
  console.log('KANVTECH STAGING DATABASE BACKUP & SNAPSHOT');
  console.log('=======================================================');

  // 1. Terminate active connections to staging DB to enable clean template cloning
  console.log('[1/3] Terminating any stale client connections to kanvtech_sm_staging...');
  await adminClient.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'kanvtech_sm_staging' AND pid <> pg_backend_pid();
  `);

  // 2. Clone database via PostgreSQL TEMPLATE snapshot
  console.log(`[2/3] Creating PostgreSQL clone database snapshot: ${backupDbName}...`);
  await adminClient.$executeRawUnsafe(`CREATE DATABASE "${backupDbName}" TEMPLATE "kanvtech_sm_staging";`);
  console.log(`[2/3] PostgreSQL snapshot clone created successfully.`);

  // 3. Export data snapshot to JSON file
  const stagingClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:password@localhost:5432/kanvtech_sm_staging?schema=public',
      },
    },
  });

  console.log('[3/3] Exporting complete data tables to backup archive...');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const tables = [
    'roles',
    'system_settings',
    'sla_configurations',
    'sequence_trackers',
    'users',
    'companies',
    'company_contacts',
    'employees',
    'tickets',
    'ticket_assignments',
    'ticket_escalations',
    'ticket_resolution_sessions',
    'ticket_attachments',
    'ticket_comments',
    'ticket_feedback',
    'ticket_history',
    'notifications',
    'audit_logs',
  ];

  const snapshotData = {
    metadata: {
      timestamp: new Date().toISOString(),
      sourceDatabase: 'kanvtech_sm_staging',
      cloneSnapshotName: backupDbName,
    },
    tables: {},
  };

  for (const t of tables) {
    try {
      const rows = await stagingClient.$queryRawUnsafe(`SELECT * FROM "${t}";`);
      snapshotData.tables[t] = rows;
    } catch (err) {
      snapshotData.tables[t] = [];
    }
  }

  const backupFilePath = path.join(backupDir, `staging_backup_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(snapshotData, null, 2), 'utf8');

  console.log(`[3/3] File archive successfully saved to: ${backupFilePath}`);
  console.log('=======================================================');
  console.log(`BACKUP COMPLETE. Clone Snapshot: ${backupDbName}`);
  console.log('=======================================================');

  await stagingClient.$disconnect();
  await adminClient.$disconnect();
}

main().catch(err => {
  console.error('[Backup Error]:', err);
  process.exit(1);
});
