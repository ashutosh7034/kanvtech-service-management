/**
 * Kanvtech Custom User ID Migration Script
 * Deterministically generates and assigns unique Custom User IDs to existing accounts.
 *
 * Usage:
 *   node backend/scripts/migrate-existing-user-ids.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KNOWN_EXPLICIT_MAPPINGS = {
  'admin@kanvtech.com': 'sysadmin',
  'ashutosh@kanvtech.com': 'ashutosh',
  'l1_agent@kanvtech.com': 'l1_agent',
  'l2_agent@kanvtech.com': 'l2_agent',
  'l3_agent@kanvtech.com': 'l3_agent',
  'amit.l1@kanvtech.com': 'amit.l1',
  'rahul.l2@kanvtech.com': 'rahul.l2',
  'priya.l3@kanvtech.com': 'priya.l3',
  'admin@apexcorp.com': 'admin.apex',
  'manager@kanvtech.com': 'manager.kanvtech',
  'l3.priya@kanvtech.com': 'l3.priya',
};

const SYSTEM_RESERVED = new Set([
  'admin', 'administrator', 'system', 'root', 'superuser', 'kanvtech',
  'support', 'helpdesk', 'api', 'null', 'undefined', 'anonymous',
  'guest', 'security', 'billing', 'contact', 'owner', 'master'
]);

function sanitizePrefix(email) {
  const prefix = email.split('@')[0].toLowerCase();
  // replace invalid chars with '_'
  let sanitized = prefix.replace(/[^a-z0-9._-]/g, '_');
  // ensure min 3 chars
  if (sanitized.length < 3) {
    sanitized = sanitized + '_usr';
  }
  if (sanitized.length > 25) {
    sanitized = sanitized.substring(0, 25);
  }
  if (SYSTEM_RESERVED.has(sanitized)) {
    sanitized = sanitized + '.user';
  }
  return sanitized;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== Kanvtech Custom User ID Migration (${isDryRun ? 'DRY RUN' : 'LIVE RUN'}) ===\n`);

  const users = await prisma.user.findMany({
    include: { employee: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${users.length} existing user records in database.`);

  // Load currently reserved IDs
  const reservedRecords = await prisma.reservedUserId.findMany();
  const reservedSet = new Set(reservedRecords.map(r => r.userId.toLowerCase()));
  for (const sys of SYSTEM_RESERVED) {
    reservedSet.add(sys.toLowerCase());
  }

  // Load existing customUserIds already set
  const assignedIds = new Set();
  for (const u of users) {
    if (u.customUserId) {
      assignedIds.add(u.customUserId.toLowerCase());
    }
  }

  const migrationPlan = [];

  for (const user of users) {
    if (user.customUserId) {
      console.log(`- User [${user.email}] already has customUserId: "${user.customUserId}". Skipping.`);
      continue;
    }

    let candidate = KNOWN_EXPLICIT_MAPPINGS[user.email.toLowerCase()];
    if (!candidate) {
      candidate = sanitizePrefix(user.email);
    }

    // Resolve collision if candidate is already taken or reserved
    let base = candidate;
    let counter = 1;
    while (assignedIds.has(candidate.toLowerCase()) || reservedSet.has(candidate.toLowerCase())) {
      candidate = `${base}_${counter++}`;
    }

    assignedIds.add(candidate.toLowerCase());

    migrationPlan.push({
      userId: user.id,
      email: user.email,
      role: user.role,
      assignedUserId: candidate,
      employeeId: user.employee ? user.employee.id : null,
      tenantId: user.employee ? user.employee.tenantId : null,
    });
  }

  console.log(`\nPlanned assignments for ${migrationPlan.length} accounts:`);
  console.table(migrationPlan.map(p => ({
    Email: p.email,
    Role: p.role,
    'Assigned User ID': p.assignedUserId,
    'Has Employee Record': !!p.employeeId,
  })));

  if (isDryRun) {
    console.log('\n[DRY RUN] No database changes written.');
    return;
  }

  console.log('\nExecuting database updates...');
  let updatedCount = 0;

  for (const item of migrationPlan) {
    await prisma.$transaction(async (tx) => {
      // 1. Update User
      await tx.user.update({
        where: { id: item.userId },
        data: { customUserId: item.assignedUserId },
      });

      // 2. Update Employee if exists
      if (item.employeeId) {
        await tx.employee.update({
          where: { id: item.employeeId },
          data: { customUserId: item.assignedUserId },
        });

        // 3. Record Initial Migration History
        await tx.userIdChangeHistory.create({
          data: {
            userId: item.userId,
            previousUserId: null,
            newUserId: item.assignedUserId,
            changedByUserId: item.userId,
            changedByName: 'System Migration',
            tenantId: item.tenantId || 'GLOBAL',
            changeReason: 'INITIAL_ACCOUNT_MIGRATION',
          },
        });
      }
    });

    updatedCount++;
    console.log(`✓ Updated [${item.email}] -> customUserId: "${item.assignedUserId}"`);
  }

  console.log(`\nMigration completed successfully. Updated ${updatedCount} users.`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
