const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  const roles = await prisma.role.count();
  const slas = await prisma.slaConfiguration.count();
  const settings = await prisma.systemSetting.count();
  const sequences = await prisma.sequenceTracker.count();
  const users = await prisma.user.count();
  const companies = await prisma.company.count();
  const tickets = await prisma.ticket.count();

  console.log('=======================================================');
  console.log('PRODUCTION SEED VERIFICATION ON STAGING DB');
  console.log('=======================================================');
  console.log(`- Roles: ${roles}`);
  console.log(`- SLA Configurations: ${slas}`);
  console.log(`- System Settings: ${settings}`);
  console.log(`- Sequence Trackers: ${sequences}`);
  console.log(`- Users: ${users}`);
  console.log(`- Companies: ${companies}`);
  console.log(`- Tickets: ${tickets}`);

  const roleList = await prisma.role.findMany({ select: { name: true, description: true } });
  console.log('Roles list:', roleList.map(r => r.name).join(', '));

  const slaList = await prisma.slaConfiguration.findMany({ select: { priority: true, responseTimeHours: true, resolutionTimeHours: true } });
  console.log('SLAs list:', slaList.map(s => `${s.priority}: ${s.responseTimeHours}h resp / ${s.resolutionTimeHours}h resol`).join(', '));

  const settingList = await prisma.systemSetting.findMany({ select: { settingKey: true, settingValue: true } });
  console.log('Settings list:', settingList.map(s => `${s.settingKey}=${s.settingValue}`).join(', '));

  const seqList = await prisma.sequenceTracker.findMany();
  console.log('Sequences list:', seqList.map(s => `${s.name}=${s.currentValue}`).join(', '));

  await prisma.$disconnect();

  if (
    roles === 6 &&
    slas === 3 &&
    settings === 4 &&
    sequences === 2 &&
    users === 0 &&
    companies === 0 &&
    tickets === 0
  ) {
    console.log('VERIFICATION: PASS (Zero test users, zero test companies, zero demo credentials, pure production masters)');
  } else {
    console.error('VERIFICATION: FAIL (Unexpected record count)');
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
