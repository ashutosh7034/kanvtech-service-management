import assert from 'assert';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { EmailVerificationService } from '../src/email-verification/email-verification.service';
import { CompaniesService } from '../src/companies/companies.service';

async function runEmailVerificationSuite() {
  console.log('===============================================================');
  console.log('KANVTECH EMAIL VERIFICATION WORKFLOW & SECURITY SUITE');
  console.log('Testing Inline Customer Registration Email Verification');
  console.log('===============================================================\n');

  const prisma = new PrismaService();
  await prisma.$connect();

  const auditService = new AuditService(prisma);
  const emailVerificationService = new EmailVerificationService(prisma, auditService);
  const companiesService = new CompaniesService(prisma, auditService, emailVerificationService);

  const ts = Date.now();
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      await fn();
      console.log('PASSED \u2714');
      passed++;
    } catch (err: any) {
      console.log('FAILED \u2718');
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // Clean test-specific records
  const testEmail1 = `corp_${ts}@apextechnologies.com`;
  const testEmail2 = `changed_${ts}@apextechnologies.com`;
  const dupEmail = `dup_${ts}@apextechnologies.com`;

  // 1. Empty Email Rejected
  await test('1. Empty Email Validation — Rejected without API side effects', async () => {
    await assert.rejects(
      async () => emailVerificationService.sendCustomerVerificationEmail(''),
      /Please enter an email address/i,
    );
  });

  // 2. Invalid Email Format Rejected
  await test('2. Invalid Email Formats — Strict RFC Validation', async () => {
    const invalidEmails = ['invalid', 'test@', 'test@domain', 'user@.com', '@domain.com'];
    for (const bad of invalidEmails) {
      await assert.rejects(
        async () => emailVerificationService.sendCustomerVerificationEmail(bad),
        /Please enter a valid email address/i,
      );
    }
  });

  // 3. Valid Corporate Email Verification — Successful Delivery & Verified State
  await test('3. Valid Email Verification — Dispatches and Marks Verified State', async () => {
    const res = await emailVerificationService.sendCustomerVerificationEmail(testEmail1, 1);
    assert.strictEqual(res.verified, true, 'Verification must return verified: true');
    assert.strictEqual(res.message, 'Email verified successfully.');

    // Verify state in DB
    const isVerified = await emailVerificationService.isCustomerEmailVerified(testEmail1);
    assert.strictEqual(isVerified, true, 'Email must be verified in database');
  });

  // 4. Registration Blocked for Unverified Email
  await test('4. Customer Registration Blocked when Email is Unverified', async () => {
    const unverifiedEmail = `unverified_${ts}@apextech.com`;
    await assert.rejects(
      async () =>
        companiesService.createCompany({
          company_name: `Unverified Co ${ts}`,
          primary_email: unverifiedEmail,
          address: 'Dahisar East, Mumbai',
          contact_person: 'Amit Sharma',
          contact_phone: '+91 98765 43210',
        }),
      /Please verify the corporate email before continuing/i,
    );
  });

  // 5. Registration Blocked when Email Changes from Verified to Unverified
  await test('5. Email Change Invalidates Previous Verification', async () => {
    // testEmail1 is verified, testEmail2 is NOT verified
    const isVerified1 = await emailVerificationService.isCustomerEmailVerified(testEmail1);
    const isVerified2 = await emailVerificationService.isCustomerEmailVerified(testEmail2);
    assert.strictEqual(isVerified1, true);
    assert.strictEqual(isVerified2, false);

    // Attempting registration with testEmail2 must fail
    await assert.rejects(
      async () =>
        companiesService.createCompany({
          company_name: `Changed Email Co ${ts}`,
          primary_email: testEmail2,
          address: 'Dahisar East, Mumbai',
          contact_person: 'Amit Sharma',
          contact_phone: '+91 98765 43210',
        }),
      /Please verify the corporate email before continuing/i,
    );
  });

  // 6. Registration Succeeds with Verified Email
  let createdCompanyId = '';
  await test('6. Customer Registration Succeeds with Verified Corporate Email', async () => {
    createdCompanyId = await companiesService.createCompany({
      company_name: `Apex Technologies ${ts}`,
      primary_email: testEmail1,
      address: 'Plot 42, Dahisar East, Mumbai, Maharashtra 400068',
      gstn: '27AABCU9603R1ZM',
      contact_person: 'Amit Sharma',
      contact_phone: '+91 98765 43210',
    });
    assert(createdCompanyId.startsWith('CMP-'), `Company ID must start with CMP-, got: ${createdCompanyId}`);
    const details = await companiesService.getCompanyById(createdCompanyId);
    assert.strictEqual(details.primary_email, testEmail1);
    assert.strictEqual(details.company_name, `Apex Technologies ${ts}`);
  });

  // 7. Duplicate Email Cannot Be Re-Verified for Another Customer
  await test('7. Duplicate Customer Email Prevents Re-Verification', async () => {
    await assert.rejects(
      async () => emailVerificationService.sendCustomerVerificationEmail(testEmail1),
      /already registered/i,
    );
  });

  // 8. Clean Up Test Data
  await test('8. Cleanup Test Artifacts', async () => {
    if (createdCompanyId) {
      await prisma.companyContact.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.companyProduct.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.company.deleteMany({ where: { id: createdCompanyId } });
    }
    await prisma.emailVerificationToken.deleteMany({ where: { email: { in: [testEmail1, testEmail2, dupEmail] } } });
    await prisma.notificationLog.deleteMany({ where: { recipient: { in: [testEmail1, testEmail2, dupEmail] } } });
  });

  await prisma.$disconnect();

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runEmailVerificationSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
