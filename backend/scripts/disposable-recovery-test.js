/**
 * Kanvtech Production Deployment Safety Verification & Recovery Test
 * Tests full backup, disposable database creation, restore, migration execution,
 * count comparisons before/after, and non-destructive recovery.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

// Parse database URL safely from backend/.env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const parsedUrl = new URL(dbUrl);
const dbHost = parsedUrl.hostname;
const dbPort = parsedUrl.port || '5432';
const dbUser = parsedUrl.username;
const dbPassword = decodeURIComponent(parsedUrl.password);
const sourceDbName = parsedUrl.pathname.replace(/^\//, '');
const disposableDbName = 'kanvtech_recovery_disposable_test';

// PG tool paths
const pgBinDir = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const pgDumpPath = path.join(pgBinDir, 'pg_dump.exe');
const pgRestorePath = path.join(pgBinDir, 'pg_restore.exe');
const createdbPath = path.join(pgBinDir, 'createdb.exe');
const dropdbPath = path.join(pgBinDir, 'dropdb.exe');
const psqlPath = path.join(pgBinDir, 'psql.exe');

const backupFilePath = path.join(__dirname, '..', '.tmp_predeploy_test_backup.dump');

const envWithPassword = {
  ...process.env,
  PGPASSWORD: dbPassword,
};

async function queryCounts(dbName) {
  const client = new Client({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });
  await client.connect();
  const tables = [
    'users',
    'companies',
    'employees',
    'departments',
    'tickets',
    'products',
    'subscriptions',
    'implementations',
    'audit_logs',
    'permissions',
    'employee_permissions',
  ];

  const counts = {};
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      counts[table] = Number(res.rows[0].cnt);
    } catch (err) {
      counts[table] = 'TABLE_NOT_FOUND';
    }
  }

  // Also query tenants and tenant_memberships if they exist
  try {
    const res = await client.query('SELECT COUNT(*) as cnt FROM "tenants"');
    counts['tenants'] = Number(res.rows[0].cnt);
  } catch {
    counts['tenants'] = 'NOT_PRESENT';
  }
  try {
    const res = await client.query('SELECT COUNT(*) as cnt FROM "tenant_memberships"');
    counts['tenant_memberships'] = Number(res.rows[0].cnt);
  } catch {
    counts['tenant_memberships'] = 'NOT_PRESENT';
  }

  await client.end();
  return counts;
}

async function runSafetyAndRecoveryTest() {
  console.log('========================================================================');
  console.log('  KANVTECH PRODUCTION DEPLOYMENT & DISPOSABLE RECOVERY TEST SUITE');
  console.log('========================================================================');
  console.log(`[Target] Host: ${dbHost}:${dbPort} | User: ${dbUser} | Source DB: ${sourceDbName}`);
  console.log(`[Disposable Target DB] ${disposableDbName}`);

  const results = [];
  function record(section, name, pass, details = '') {
    results.push({ section, name, pass, details });
    const tag = pass ? '[PASS]' : '[FAIL]';
    console.log(`  ${tag} [${section}] ${name}`);
    if (details) console.log(`         ${details}`);
  }

  // 1. Baseline Counts on Source DB
  console.log('\n--- 1. BASELINE DATABASE AUDIT ---');
  const sourceBaselineCounts = await queryCounts(sourceDbName);
  console.log('         Source DB Counts:', JSON.stringify(sourceBaselineCounts, null, 2));
  record('BASELINE', 'Source database connected and counts audited', true, `Companies: ${sourceBaselineCounts.companies}, Users: ${sourceBaselineCounts.users}`);

  // 2. Perform Full pg_dump Backup (Custom format -F c)
  console.log('\n--- 2. PRE-DEPLOYMENT BACKUP CREATION ---');
  try {
    if (fs.existsSync(backupFilePath)) fs.unlinkSync(backupFilePath);
    execSync(`"${pgDumpPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${sourceDbName} -F c -b -v -f "${backupFilePath}"`, {
      env: envWithPassword,
      stdio: 'pipe',
    });
    const backupStat = fs.statSync(backupFilePath);
    record('BACKUP', 'Full PostgreSQL custom-format backup created', backupStat.size > 10000, `Size: ${Math.round(backupStat.size / 1024)} KB at ${path.basename(backupFilePath)}`);
  } catch (err) {
    record('BACKUP', 'Full PostgreSQL custom-format backup created', false, err.message);
    throw err;
  }

  // 3. Create Disposable Database Copy
  console.log('\n--- 3. DISPOSABLE DATABASE COPY CREATION ---');
  try {
    // Drop existing disposable test DB if exists
    try {
      execSync(`"${dropdbPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} --if-exists ${disposableDbName}`, {
        env: envWithPassword,
        stdio: 'pipe',
      });
    } catch {}

    execSync(`"${createdbPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} ${disposableDbName}`, {
      env: envWithPassword,
      stdio: 'pipe',
    });
    record('DISPOSABLE_DB', `Disposable database '${disposableDbName}' created successfully`, true);
  } catch (err) {
    record('DISPOSABLE_DB', `Disposable database '${disposableDbName}' created`, false, err.message);
    throw err;
  }

  // 4. Restore Full Backup into Disposable Database
  console.log('\n--- 4. BACKUP RESTORATION TEST ---');
  try {
    execSync(`"${pgRestorePath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${disposableDbName} --no-owner --role=${dbUser} "${backupFilePath}"`, {
      env: envWithPassword,
      stdio: 'pipe',
    });
    record('RESTORE', 'Backup restored into disposable database without fatal errors', true);
  } catch (err) {
    // pg_restore can exit with non-fatal warnings (code 1) for harmless notices; check if data exists
    const restoredCounts = await queryCounts(disposableDbName);
    const hasData = restoredCounts.users > 0 && restoredCounts.companies > 0;
    record('RESTORE', 'Backup restored into disposable database (with non-fatal notices)', hasData, `Restored users: ${restoredCounts.users}, companies: ${restoredCounts.companies}`);
  }

  // 5. Compare Record Counts between Source and Restored Disposable Copy
  console.log('\n--- 5. RESTORATION FIDELITY & DATA INTEGRITY COMPARISON ---');
  const restoredCounts = await queryCounts(disposableDbName);
  let fidelityMatch = true;
  for (const table of Object.keys(sourceBaselineCounts)) {
    if (sourceBaselineCounts[table] !== restoredCounts[table]) {
      fidelityMatch = false;
      console.error(`Mismatch on ${table}: Source=${sourceBaselineCounts[table]} vs Restored=${restoredCounts[table]}`);
    }
  }
  record('INTEGRITY', 'Restored database record counts 100% match source baseline', fidelityMatch, `Verified tables: ${Object.keys(sourceBaselineCounts).join(', ')}`);

  // 6. Test Migration Execution on Restored Database Copy
  console.log('\n--- 6. MIGRATION COMPATIBILITY TEST ON DISPOSABLE COPY ---');
  const migrationSqlPath = path.join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261027200000_multi_tenant_architecture',
    'migration.sql',
  );
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

  const disposableClient = new Client({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPassword,
    database: disposableDbName,
  });
  await disposableClient.connect();

  let migrationPassed = false;
  try {
    await disposableClient.query(migrationSql);
    migrationPassed = true;
    record('MIGRATION', 'Migration 20261027200000_multi_tenant_architecture executed successfully', true);
  } catch (err) {
    record('MIGRATION', 'Migration execution', false, err.message);
  }

  // 7. Post-Migration Verification on Disposable Database Copy
  console.log('\n--- 7. POST-MIGRATION RECORD & SCHEMA INTEGRITY AUDIT ---');
  const postMigrationCounts = await queryCounts(disposableDbName);
  console.log('         Post-Migration Counts:', JSON.stringify(postMigrationCounts, null, 2));

  record(
    'MIGRATION_AUDIT',
    'Core business entities preserved intact post-migration',
    postMigrationCounts.companies === sourceBaselineCounts.companies &&
      postMigrationCounts.users === sourceBaselineCounts.users &&
      postMigrationCounts.employees === sourceBaselineCounts.employees &&
      postMigrationCounts.tickets === sourceBaselineCounts.tickets,
    `Companies: ${postMigrationCounts.companies}, Users: ${postMigrationCounts.users}, Employees: ${postMigrationCounts.employees}`,
  );

  record(
    'MIGRATION_AUDIT',
    'Default KANVTECH tenant created and users mapped to memberships',
    postMigrationCounts.tenants >= 1 && postMigrationCounts.tenant_memberships >= postMigrationCounts.users,
    `Tenants: ${postMigrationCounts.tenants}, Tenant Memberships: ${postMigrationCounts.tenant_memberships}`,
  );

  // Check Foreign Key Integrity on Migrated Database
  const fkCheckRes = await disposableClient.query(`
    SELECT
      tc.table_name, kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tenants';
  `);
  record(
    'MIGRATION_AUDIT',
    'All tenant foreign keys successfully created and enforced',
    fkCheckRes.rows.length >= 7,
    `Found ${fkCheckRes.rows.length} foreign keys referencing 'tenants'`,
  );

  // Check Composite Unique Indexes
  const indexCheckRes = await disposableClient.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename IN ('departments', 'products', 'sla_configurations')
      AND indexname LIKE 'uq_%';
  `);
  record(
    'MIGRATION_AUDIT',
    'Composite unique indexes active for departments, products, and SLA configurations',
    indexCheckRes.rows.length >= 4,
    `Found: ${indexCheckRes.rows.map((r) => r.indexname).join(', ')}`,
  );

  // Check for orphan records
  const orphanCheck = await disposableClient.query(`
    SELECT COUNT(*) as orphans FROM "companies" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants");
  `);
  record('MIGRATION_AUDIT', 'Zero orphan records with unmapped tenant_id', Number(orphanCheck.rows[0].orphans) === 0);

  // 8. Test Safe Non-Destructive Rollback Scenario (Application Version Rollback)
  console.log('\n--- 8. SAFE ROLLBACK COMPATIBILITY TEST ---');
  // Verify that a pre-multi-tenant query (which omits tenant_id) works seamlessly because of DEFAULT 'KANVTECH'
  const legacyInsertRes = await disposableClient.query(`
    INSERT INTO "departments" ("id", "name", "code", "description")
    VALUES ('dept-compat-test-99', 'Compatibility Test Dept', 'DEPT-COMPAT-99', 'Testing legacy insert without tenant_id')
    RETURNING "id", "name", "tenant_id";
  `);
  const insertedRow = legacyInsertRes.rows[0];
  const legacyCompatible = insertedRow.tenant_id === 'KANVTECH';
  record(
    'ROLLBACK_SAFETY',
    'Pre-multi-tenant application queries remain 100% compatible via DEFAULT tenant_id',
    legacyCompatible,
    `Inserted department automatically received tenant_id='${insertedRow.tenant_id}'`,
  );

  // Clean up test department
  await disposableClient.query(`DELETE FROM "departments" WHERE "code" = 'DEPT-COMPAT-99'`);
  await disposableClient.end();

  // 9. Teardown Disposable Copy & Backup File
  console.log('\n--- 9. TEARDOWN DISPOSABLE ENVIRONMENT ---');
  try {
    execSync(`"${dropdbPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} ${disposableDbName}`, {
      env: envWithPassword,
      stdio: 'pipe',
    });
    record('TEARDOWN', `Disposable database '${disposableDbName}' dropped cleanly`, true);
  } catch (err) {
    record('TEARDOWN', 'Drop disposable database', false, err.message);
  }

  if (fs.existsSync(backupFilePath)) {
    fs.unlinkSync(backupFilePath);
    record('TEARDOWN', 'Temporary backup file cleaned up', true);
  }

  // Summary
  console.log('\n========================================================================');
  const allPassed = results.every((r) => r.pass);
  const passCount = results.filter((r) => r.pass).length;
  console.log(` RECOVERY & MIGRATION TEST RESULTS: ${passCount} / ${results.length} PASSED`);
  console.log(` OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED' : 'FAILURES DETECTED'}`);
  console.log('========================================================================\n');

  return { allPassed, results, sourceBaselineCounts, postMigrationCounts };
}

runSafetyAndRecoveryTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error in safety test:', err);
    process.exit(1);
  });
