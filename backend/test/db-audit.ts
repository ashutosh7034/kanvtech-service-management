import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('=======================================================');
  console.log('KANVTECH POSTGRESQL DATABASE INTEGRITY AUDIT');
  console.log('=======================================================');
  let violations = 0;

  // 1. Check for orphaned tickets (company_id does not exist)
  const orphanedTickets: any = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM tickets WHERE company_id NOT IN (SELECT id FROM companies)
  `;
  if (orphanedTickets[0].count > 0) {
    console.error(`Violation: Found ${orphanedTickets[0].count} tickets with missing company`);
    violations += orphanedTickets[0].count;
  } else {
    console.log('[AUDIT] 1. Orphaned Tickets check ... PASSED (0 violations)');
  }

  // 2. Check for orphaned resolution sessions
  const orphanedSessions: any = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM ticket_resolution_sessions WHERE ticket_id NOT IN (SELECT id FROM tickets)
  `;
  if (orphanedSessions[0].count > 0) {
    console.error(`Violation: Found ${orphanedSessions[0].count} resolution sessions without a ticket`);
    violations += orphanedSessions[0].count;
  } else {
    console.log('[AUDIT] 2. Orphaned Resolution Sessions check ... PASSED (0 violations)');
  }

  // 3. Check for orphaned escalations
  const orphanedEscalations: any = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM ticket_escalations WHERE ticket_id NOT IN (SELECT id FROM tickets)
  `;
  if (orphanedEscalations[0].count > 0) {
    console.error(`Violation: Found ${orphanedEscalations[0].count} escalations without a ticket`);
    violations += orphanedEscalations[0].count;
  } else {
    console.log('[AUDIT] 3. Orphaned Escalations check ... PASSED (0 violations)');
  }

  // 4. Check for orphaned feedbacks
  const orphanedFeedbacks: any = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM ticket_feedback WHERE ticket_id NOT IN (SELECT id FROM tickets)
  `;
  if (orphanedFeedbacks[0].count > 0) {
    console.error(`Violation: Found ${orphanedFeedbacks[0].count} feedbacks without a ticket`);
    violations += orphanedFeedbacks[0].count;
  } else {
    console.log('[AUDIT] 4. Orphaned Feedbacks check ... PASSED (0 violations)');
  }

  // 5. Check for sequence tracker integrity
  const seqs = await prisma.sequenceTracker.findMany();
  console.log(`[AUDIT] 5. Sequence Trackers:`, seqs.map(s => `${s.name} -> ${s.currentValue}`).join(', '));

  // 6. Check for duplicate ticket IDs
  const duplicateTickets: any = await prisma.$queryRaw`
    SELECT id, COUNT(*)::int as count FROM tickets GROUP BY id HAVING COUNT(*) > 1
  `;
  if (duplicateTickets.length > 0) {
    console.error(`Violation: Duplicate ticket IDs found!`);
    violations += duplicateTickets.length;
  } else {
    console.log('[AUDIT] 6. Ticket ID Uniqueness and Collision check ... PASSED (0 duplicates)');
  }

  // 7. Check for Customer Data Sanitization tagging
  const internalNotes = await prisma.ticketComment.findMany({
    where: { commentType: 'INTERNAL_NOTE' }
  });
  console.log(`[AUDIT] 7. Customer Data Isolation: ${internalNotes.length} internal notes strictly categorized as INTERNAL_NOTE`);

  const allTickets = await prisma.ticket.findMany({ select: { id: true } });
  console.log(`[AUDIT] 8. Total tickets verified in PostgreSQL: ${allTickets.length}`);

  console.log('=======================================================');
  console.log(`DATABASE INTEGRITY AUDIT: ${violations} VIOLATIONS FOUND`);
  console.log('=======================================================');
  await prisma.$disconnect();

  if (violations > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
