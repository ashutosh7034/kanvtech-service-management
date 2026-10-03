/**
 * seed-test-users.ts — Local Development Test Fixture Seeding
 *
 * This script is SAFE TO RUN MULTIPLE TIMES (idempotent).
 * It does NOT use destructive deleteMany for records that may be
 * referenced by tickets or other FK-constrained tables.
 *
 * Strategy for CompanyContact:
 *   - Find existing contact by (companyId + email)
 *   - If found: UPDATE (no delete — avoids FK RESTRICT violation from tickets)
 *   - If not found: CREATE
 *
 * This ensures the seed is repeatable even after test suites create
 * tickets that reference these contacts.
 */
import { PrismaClient, UserRole, EmployeeLevel, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertCompanyContact(data: {
  companyId: string;
  email: string;
  userId: number;
  name: string;
  phone: string;
  designation: string;
  isPrimary: boolean;
}) {
  // Safe upsert: find by (companyId + email), then update or create.
  // Does NOT delete existing contacts — avoids FK RESTRICT from tickets.customerContactId.
  const existing = await prisma.companyContact.findFirst({
    where: { companyId: data.companyId, email: data.email },
  });

  if (existing) {
    await prisma.companyContact.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        phone: data.phone,
        designation: data.designation,
        isPrimary: data.isPrimary,
        isActive: true,
        userId: data.userId,
      },
    });
  } else {
    await prisma.companyContact.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        designation: data.designation,
        isPrimary: data.isPrimary,
        isActive: true,
        companyId: data.companyId,
        userId: data.userId,
      },
    });
  }
}

async function seedTestUsers() {
  console.log('[Test Seed] Seeding local test users...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const testUsers = [
    { email: 'manager@kanvtech.com', role: UserRole.MANAGER },
    { email: 'l1.amit@kanvtech.com', role: UserRole.L1_EMPLOYEE },
    { email: 'l2.vikram@kanvtech.com', role: UserRole.L2_EMPLOYEE },
    { email: 'l3.priya@kanvtech.com', role: UserRole.L3_EMPLOYEE },
    { email: 'rajesh@acme.com', role: UserRole.CUSTOMER },
    { email: 'anjali@zenith.com', role: UserRole.CUSTOMER },
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, isActive: true, passwordHash },
      create: { email: user.email, role: user.role, isActive: true, passwordHash },
    });
  }

  // ── 2. Acme Corp (CMP-0001) ───────────────────────────────────────────────
  await prisma.company.upsert({
    where: { id: 'CMP-0001' },
    update: { isActive: true },
    create: {
      id: 'CMP-0001',
      companyName: 'Acme Corp',
      address: '123 Acme St',
      primaryEmail: 'rajesh@acme.com',
      contactPerson: 'Rajesh',
      contactPhone: '1234567890',
      isActive: true,
    },
  });

  const rajesh = await prisma.user.findUnique({ where: { email: 'rajesh@acme.com' } });
  if (rajesh) {
    await upsertCompanyContact({
      companyId: 'CMP-0001',
      email: 'rajesh@acme.com',
      userId: rajesh.id,
      name: 'Rajesh',
      phone: '1234567890',
      designation: 'Manager',
      isPrimary: true,
    });
  }

  // ── 3. Zenith Corp (CMP-0002) ─────────────────────────────────────────────
  await prisma.company.upsert({
    where: { id: 'CMP-0002' },
    update: { isActive: true },
    create: {
      id: 'CMP-0002',
      companyName: 'Zenith Corp',
      address: '456 Zenith St',
      primaryEmail: 'anjali@zenith.com',
      contactPerson: 'Anjali',
      contactPhone: '1234567890',
      isActive: true,
    },
  });

  const anjali = await prisma.user.findUnique({ where: { email: 'anjali@zenith.com' } });
  if (anjali) {
    await upsertCompanyContact({
      companyId: 'CMP-0002',
      email: 'anjali@zenith.com',
      userId: anjali.id,
      name: 'Anjali',
      phone: '1234567890',
      designation: 'Admin',
      isPrimary: true,
    });
  }

  // ── 4. Employees ──────────────────────────────────────────────────────────
  const employees = [
    { id: 'EMP-001', name: 'Manager', email: 'manager@kanvtech.com', level: EmployeeLevel.MANAGER },
    { id: 'EMP-002', name: 'Amit',    email: 'l1.amit@kanvtech.com', level: EmployeeLevel.L1 },
    { id: 'EMP-004', name: 'Vikram',  email: 'l2.vikram@kanvtech.com', level: EmployeeLevel.L2 },
    { id: 'EMP-005', name: 'Priya',   email: 'l3.priya@kanvtech.com', level: EmployeeLevel.L3 },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: { id: emp.id, level: emp.level, status: EmployeeStatus.ACTIVE },
      create: {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        level: emp.level,
        designation: emp.level,
        department: 'Support',
        phone: '1234567890',
        status: EmployeeStatus.ACTIVE,
        user: { connect: { email: emp.email } },
      },
    });
  }

  // ── 5. Base Product ───────────────────────────────────────────────────────
  await prisma.product.upsert({
    where: { id: 'PROD-0001' },
    update: { isActive: true },
    create: {
      id: 'PROD-0001',
      name: 'Test Product',
      code: 'PROD-0001',
      category: 'Software',
      isActive: true,
    },
  });

  // ── 6. Company-Product mapping for Acme Corp ──────────────────────────────
  // Ensure CMP-0001 owns PROD-0001 (needed for qa-comprehensive-suite ticket creation)
  const existingMapping = await prisma.companyProduct.findFirst({
    where: { companyId: 'CMP-0001', productId: 'PROD-0001' },
  });
  if (!existingMapping) {
    await prisma.companyProduct.create({
      data: {
        companyId: 'CMP-0001',
        productId: 'PROD-0001',
        purchaseType: 'COMPLETE',
        isActive: true,
        notes: 'Seeded for local test fixtures',
      },
    });
  } else if (!existingMapping.isActive) {
    await prisma.companyProduct.update({
      where: { id: existingMapping.id },
      data: { isActive: true },
    });
  }

  console.log('[Test Seed] Test users and basic fixtures seeded successfully.');
}

seedTestUsers()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('[Test Seed] ERROR:', e.message); await prisma.$disconnect(); process.exit(1); });
