const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  console.log('=======================================================');
  console.log('KANVTECH FRESH DATABASE MIGRATION VERIFICATION');
  console.log('=======================================================');

  // 1. Check _prisma_migrations table
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, started_at, finished_at, applied_steps_count, rolled_back_at
    FROM "_prisma_migrations";
  `);
  console.log('[1] _prisma_migrations records:');
  console.table(migrations);

  // 2. List all user tables in public schema
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log(`[2] Created Tables (Total: ${tables.length}):`);
  console.log(tables.map(t => t.table_name).join(', '));

  // 3. Foreign keys count and sample
  const fks = await prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log(`[3] Foreign Key Constraints (Total: ${fks.length}):`);
  fks.forEach(fk => {
    console.log(`  - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  });

  // 4. Unique constraints
  const uniques = await prisma.$queryRawUnsafe(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log(`[4] Unique Constraints (Total: ${uniques.length}):`);
  uniques.forEach(u => {
    console.log(`  - ${u.table_name}.${u.column_name} (${u.constraint_name})`);
  });

  // 5. Indexes
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  console.log(`[5] PostgreSQL Indexes (Total: ${indexes.length}):`);
  indexes.forEach(idx => {
    console.log(`  - ${idx.tablename} :: ${idx.indexname}`);
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
