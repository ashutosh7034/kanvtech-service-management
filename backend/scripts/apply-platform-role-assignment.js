const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('=== KANVTECH PLATFORM ROLE ASSIGNMENT & ACCESS CONTROL CORRECTION ===\n');

  // 1. Ensure enum UserRole in PostgreSQL contains PLATFORM_INCHARGE
  console.log('[1/5] Verifying PostgreSQL enum UserRole...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_INCHARGE'`);
    console.log('  -> Enum UserRole contains PLATFORM_INCHARGE');
  } catch (err) {
    console.log('  -> Enum check note:', err.message);
  }

  // 2. Upsert roles in the 'roles' table
  console.log('\n[2/5] Upserting Role definitions in "roles" table...');
  const rolesToUpsert = [
    {
      name: 'SUPER_ADMIN',
      description: 'Company Super Administrator (Full Tenant Workspace Management)',
      permissionsJson: JSON.stringify([
        'workspace:admin',
        'departments:manage',
        'employees:manage',
        'companies:manage',
        'tickets:manage',
        'reports:read',
        'settings:manage',
        'audit_logs:read',
        'mass_upload:manage'
      ]),
    },
    {
      name: 'PLATFORM_INCHARGE',
      description: 'Platform Incharge (Platform-Level Operational Management & Tenant Provisioning)',
      permissionsJson: JSON.stringify([
        'platform:overview',
        'platform:tenants:read',
        'platform:tenants:manage',
        'platform:status:manage',
        'platform:password_reset'
      ]),
    },
  ];

  for (const r of rolesToUpsert) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        permissionsJson: r.permissionsJson,
      },
      create: {
        name: r.name,
        description: r.description,
        permissionsJson: r.permissionsJson,
      },
    });
    console.log(`  -> Role "${r.name}" upserted.`);
  }

  // 3. Configure Account 2: admin@kanvtech.com (SUPER_ADMIN, scoped strictly to KANVTECH tenant)
  console.log('\n[3/5] Configuring Account 2: admin@kanvtech.com -> SUPER_ADMIN (Tenant: KANVTECH)...');
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@kanvtech.com' },
    include: { tenantMemberships: true },
  });

  if (!existingAdmin) {
    console.error('  -> ERROR: admin@kanvtech.com not found!');
  } else {
    // Update user role to SUPER_ADMIN, isSuperAdmin to false (to eliminate global bypass)
    const updatedAdmin = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: 'SUPER_ADMIN',
        isSuperAdmin: false,
        defaultTenantId: 'KANVTECH',
      },
    });
    console.log(`  -> User ${updatedAdmin.email} updated: role=${updatedAdmin.role}, isSuperAdmin=${updatedAdmin.isSuperAdmin}, defaultTenantId=${updatedAdmin.defaultTenantId}`);

    // Upsert tenant membership in KANVTECH with role SUPER_ADMIN
    const kanvtechMembership = await prisma.tenantMembership.upsert({
      where: {
        uq_user_tenant: {
          userId: existingAdmin.id,
          tenantId: 'KANVTECH',
        },
      },
      update: {
        role: 'SUPER_ADMIN',
        isActive: true,
        isDefault: true,
      },
      create: {
        userId: existingAdmin.id,
        tenantId: 'KANVTECH',
        role: 'SUPER_ADMIN',
        isActive: true,
        isDefault: true,
      },
    });
    console.log(`  -> Tenant membership in KANVTECH updated to SUPER_ADMIN (ID: ${kanvtechMembership.id})`);

    // Ensure admin@kanvtech.com does NOT have active membership in other tenants like TENANT-APEX
    const removedOtherMemberships = await prisma.tenantMembership.deleteMany({
      where: {
        userId: existingAdmin.id,
        tenantId: { not: 'KANVTECH' },
      },
    });
    if (removedOtherMemberships.count > 0) {
      console.log(`  -> Removed ${removedOtherMemberships.count} unauthorized cross-tenant memberships for admin@kanvtech.com`);
    } else {
      console.log('  -> Verified admin@kanvtech.com has no memberships outside KANVTECH.');
    }
  }

  // 4. Configure Account 1: ashutosh@kanvtech.com (PLATFORM_INCHARGE, Platform Operational Manager)
  console.log('\n[4/5] Configuring Account 1: ashutosh@kanvtech.com -> PLATFORM_INCHARGE...');
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  const existingAshutosh = await prisma.user.findUnique({
    where: { email: 'ashutosh@kanvtech.com' },
  });

  let ashutoshUser;
  if (!existingAshutosh) {
    ashutoshUser = await prisma.user.create({
      data: {
        email: 'ashutosh@kanvtech.com',
        passwordHash: defaultPasswordHash,
        role: 'PLATFORM_INCHARGE',
        isActive: true,
        isSuperAdmin: false,
        defaultTenantId: 'KANVTECH',
      },
    });
    console.log(`  -> Created new user: ashutosh@kanvtech.com (ID: ${ashutoshUser.id}, role: PLATFORM_INCHARGE)`);
  } else {
    ashutoshUser = await prisma.user.update({
      where: { id: existingAshutosh.id },
      data: {
        role: 'PLATFORM_INCHARGE',
        isActive: true,
        isSuperAdmin: false,
        defaultTenantId: 'KANVTECH',
      },
    });
    console.log(`  -> Updated existing user: ashutosh@kanvtech.com (ID: ${ashutoshUser.id}, role: PLATFORM_INCHARGE)`);
  }

  // Ensure Ashutosh has active membership in KANVTECH as PLATFORM_INCHARGE for operational root context
  const ashutoshMembership = await prisma.tenantMembership.upsert({
    where: {
      uq_user_tenant: {
        userId: ashutoshUser.id,
        tenantId: 'KANVTECH',
      },
    },
    update: {
      role: 'PLATFORM_INCHARGE',
      isActive: true,
      isDefault: true,
    },
    create: {
      userId: ashutoshUser.id,
      tenantId: 'KANVTECH',
      role: 'PLATFORM_INCHARGE',
      isActive: true,
      isDefault: true,
    },
  });
  console.log(`  -> Tenant membership in KANVTECH updated to PLATFORM_INCHARGE (ID: ${ashutoshMembership.id})`);

  // Ensure an Employee record exists for Ashutosh if needed
  const existingAshutoshEmp = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: 'ashutosh@kanvtech.com' },
        { userId: ashutoshUser.id },
      ],
    },
  });

  if (!existingAshutoshEmp) {
    const defaultDept = await prisma.department.findFirst({
      where: { tenantId: 'KANVTECH' },
    });
    await prisma.employee.create({
      data: {
        id: 'EMP-PLT-001',
        name: 'Ashutosh Pandey',
        email: 'ashutosh@kanvtech.com',
        phone: '9999999999',
        department: defaultDept?.name || 'Platform Operations',
        departmentId: defaultDept?.id,
        designation: 'Platform Incharge',
        level: 'MANAGER',
        userId: ashutoshUser.id,
        tenantId: 'KANVTECH',
      },
    });
    console.log('  -> Created Employee record EMP-PLT-001 for Platform Incharge.');
  }

  // 5. Verification Audit
  console.log('\n[5/5] Final Verification Audit...');
  const auditUsers = await prisma.user.findMany({
    where: {
      email: { in: ['ashutosh@kanvtech.com', 'admin@kanvtech.com'] },
    },
    select: {
      id: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      defaultTenantId: true,
      isActive: true,
      tenantMemberships: {
        select: {
          tenantId: true,
          role: true,
          isActive: true,
          isDefault: true,
        },
      },
    },
  });

  console.log(JSON.stringify(auditUsers, null, 2));
  console.log('\n=== ROLE ASSIGNMENT & ACCESS CONTROL SCRIPT COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

