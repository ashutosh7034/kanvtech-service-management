const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPostgresTables() {
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Total public tables:', tables.length);
  console.log(tables.map(t => t.table_name).join(', '));

  // Check columns on permissions and employee_permissions
  const permCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'permissions'
    ORDER BY ordinal_position;
  `;
  console.log('\nColumns on permissions:');
  console.table(permCols);

  const empPermCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'employee_permissions'
    ORDER BY ordinal_position;
  `;
  console.log('\nColumns on employee_permissions:');
  console.table(empPermCols);

  // Check constraints and indexes on employee_permissions
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'employee_permissions';
  `;
  console.log('\nIndexes on employee_permissions:');
  console.table(indexes);
}

checkPostgresTables().catch(console.error).finally(() => prisma.$disconnect());

