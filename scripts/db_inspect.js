const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public'
    }
  }
});

async function main() {
  await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(100);");
  console.log('active_session_id column ensured on staging DB!');
  const columns = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';");
  console.log('Columns in users:', columns);
}

main().catch(console.error).finally(() => prisma.$disconnect());
