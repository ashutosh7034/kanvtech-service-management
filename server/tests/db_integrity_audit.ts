import { db } from '../src/db/database';

async function checkIntegrity() {
  console.log('[Audit] Running deep database integrity check...');

  // 1. Orphaned tickets without companies
  const orphans = await db.query<any>(
    'SELECT t.id FROM tickets t LEFT JOIN companies c ON t.company_id = c.id WHERE c.id IS NULL'
  );

  // 2. Duplicate tickets
  const dupTickets = await db.query<any>(
    'SELECT id, COUNT(*) as c FROM tickets GROUP BY id HAVING c > 1'
  );

  // 3. Duplicate companies
  const dupComps = await db.query<any>(
    'SELECT id, COUNT(*) as c FROM companies GROUP BY id HAVING c > 1'
  );

  // 4. Broken ticket histories
  const brokenHistory = await db.query<any>(
    'SELECT h.id FROM ticket_history h LEFT JOIN tickets t ON h.ticket_id = t.id WHERE t.id IS NULL'
  );

  // 5. Broken escalations
  const brokenEsc = await db.query<any>(
    'SELECT esc.id FROM ticket_escalations esc LEFT JOIN tickets t ON esc.ticket_id = t.id WHERE t.id IS NULL'
  );

  // 6. Broken timer sessions
  const brokenSessions = await db.query<any>(
    'SELECT s.id FROM ticket_resolution_sessions s LEFT JOIN tickets t ON s.ticket_id = t.id WHERE t.id IS NULL'
  );

  // 7. Invalid ticket statuses
  const invalidStatuses = await db.query<any>(
    `SELECT id, status FROM tickets WHERE status NOT IN ('OPEN','IN_PROGRESS','RESOLVED','MANAGER_REVIEW','CUSTOMER_FEEDBACK','CLOSED')`
  );

  // 8. Broken assignments without employee
  const brokenAssignments = await db.query<any>(
    'SELECT a.id FROM ticket_assignments a LEFT JOIN employees e ON a.employee_id = e.id WHERE e.id IS NULL'
  );

  // 9. Negative timer durations
  const negativeTimers = await db.query<any>(
    'SELECT id, duration_seconds FROM ticket_resolution_sessions WHERE duration_seconds < 0'
  );

  // 10. Broken feedback records
  const brokenFeedback = await db.query<any>(
    'SELECT fb.id FROM ticket_feedback fb LEFT JOIN tickets t ON fb.ticket_id = t.id WHERE t.id IS NULL'
  );

  const report = {
    orphanedTickets: orphans.length,
    duplicateTickets: dupTickets.length,
    duplicateCompanies: dupComps.length,
    brokenHistory: brokenHistory.length,
    brokenEscalations: brokenEsc.length,
    brokenSessions: brokenSessions.length,
    invalidStatuses: invalidStatuses.length,
    brokenAssignments: brokenAssignments.length,
    negativeTimers: negativeTimers.length,
    brokenFeedback: brokenFeedback.length,
  };

  console.log(JSON.stringify(report, null, 2));

  const totalViolations = Object.values(report).reduce((a, b) => a + b, 0);
  if (totalViolations === 0) {
    console.log('[Audit] 100% DATA INTEGRITY CONFIRMED - 0 violations detected.');
    process.exit(0);
  } else {
    console.error(`[Audit] FAILED: ${totalViolations} integrity violations detected!`);
    process.exit(1);
  }
}

checkIntegrity().catch((err) => {
  console.error('[Audit] Fatal error:', err);
  process.exit(1);
});
