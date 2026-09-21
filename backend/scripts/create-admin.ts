import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createProductionAdmin() {
  console.log('====================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT - PROVISION ADMIN USER');
  console.log('====================================================');

  const email = process.env.INITIAL_ADMIN_EMAIL || process.argv[2];
  const password = process.env.INITIAL_ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error('ERROR: Admin credentials must be provided via environment variables or CLI:');
    console.error('  INITIAL_ADMIN_EMAIL="admin@domain.com" INITIAL_ADMIN_PASSWORD="YourSecurePassword!" npm run admin:create');
    console.error('  or: npx ts-node scripts/create-admin.ts <email> <password>');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('ERROR: Password must be at least 10 characters long.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User '${email}' already exists in database (User ID: ${existing.id}, Role: ${existing.role}).`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`SUCCESS: Administrator '${email}' provisioned with User ID ${user.id} and role ADMIN.`);
  await prisma.$disconnect();
}

createProductionAdmin().catch((err) => {
  console.error('Failed to create admin user:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
