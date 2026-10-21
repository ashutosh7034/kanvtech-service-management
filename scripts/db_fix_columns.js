const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public'
    }
  }
});

async function main() {
  console.log('[DB Sync] Ensuring missing staging columns on port 5433...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE company_product_modules ADD COLUMN IF NOT EXISTS submodule_ids TEXT;
  `);
  console.log('company_product_modules.submodule_ids ensured!');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE branch_product_modules ADD COLUMN IF NOT EXISTS submodule_ids TEXT;
  `);
  console.log('branch_product_modules.submodule_ids ensured!');

  // Ensure CMP-0001 has PROD-0001 (Tally ERP) assigned
  await prisma.$executeRawUnsafe(`
    INSERT INTO company_products (company_id, product_id, purchase_type, is_active, created_at, updated_at)
    VALUES ('CMP-0001', 'PROD-0001', 'COMPLETE', true, NOW(), NOW())
    ON CONFLICT (company_id, product_id) DO UPDATE SET is_active = true;
  `);
  console.log('CMP-0001 product PROD-0001 entitlement ensured!');

  // Ensure department DEP-0001 has product specialization PROD-0001
  await prisma.$executeRawUnsafe(`
    INSERT INTO department_products (department_id, product_id)
    VALUES ('DEP-0001', 'PROD-0001')
    ON CONFLICT (department_id, product_id) DO NOTHING;
  `);
  console.log('DEP-0001 department product PROD-0001 ensured!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
