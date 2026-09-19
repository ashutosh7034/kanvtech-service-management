import bcrypt from 'bcryptjs';
import { db } from './database';

export async function seedDatabase() {
  console.log('[Seed] Starting database seeding with production master records...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Roles
  const roles = [
    { name: 'ADMIN', description: 'Full Platform Administrator', permissions: ['all'] },
    { name: 'MANAGER', description: 'Service Operations Manager (Approvals, Reassignments, Reports)', permissions: ['tickets:read', 'tickets:approve', 'tickets:reopen', 'reports:read', 'companies:manage', 'employees:manage'] },
    { name: 'L1_EMPLOYEE', description: 'Level 1 Support Specialist (Initial Resolution & Triage)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l2', 'tickets:resolve'] },
    { name: 'L2_EMPLOYEE', description: 'Level 2 Technical Specialist (In-depth Troubleshooting)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l3', 'tickets:resolve'] },
    { name: 'L3_EMPLOYEE', description: 'Level 3 Senior Engineer (Core Architecture & Vendor Escalation)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_parent', 'tickets:resolve'] },
    { name: 'CUSTOMER', description: 'Client Portal User (Ticket Creation & Feedback)', permissions: ['tickets:create', 'tickets:read_own', 'feedback:submit'] },
  ];

  for (const r of roles) {
    const existing = await db.query('SELECT name FROM roles WHERE name = ?', [r.name]);
    if (existing.length === 0) {
      await db.execute('INSERT INTO roles (name, description, permissions_json) VALUES (?, ?, ?)', [
        r.name,
        r.description,
        JSON.stringify(r.permissions),
      ]);
    }
  }

  // 2. SLA Configurations
  const slas = [
    { priority: 'HIGH', response_time_hours: 0.5, resolution_time_hours: 4.0, warning_threshold_percent: 75 },
    { priority: 'MEDIUM', response_time_hours: 2.0, resolution_time_hours: 12.0, warning_threshold_percent: 75 },
    { priority: 'LOW', response_time_hours: 4.0, resolution_time_hours: 24.0, warning_threshold_percent: 75 },
  ];

  for (const s of slas) {
    const existing = await db.query('SELECT id FROM sla_configurations WHERE priority = ?', [s.priority]);
    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO sla_configurations (priority, response_time_hours, resolution_time_hours, warning_threshold_percent, is_active) VALUES (?, ?, ?, ?, 1)',
        [s.priority, s.response_time_hours, s.resolution_time_hours, s.warning_threshold_percent]
      );
    }
  }

  // 3. System Settings
  const settings = [
    { key: 'AUTO_ASSIGNMENT_ENABLED', value: 'true', description: 'Automatically assign new tickets to available L1 employees based on workload' },
    { key: 'AUTO_CLOSURE_HOURS', value: '48', description: 'Automatic ticket closure hours after manager approval if customer does not respond' },
    { key: 'TWO_TICKET_RULE_ENABLED', value: 'true', description: 'Enforce max 2 open tickets per customer contact' },
    { key: 'MAX_ATTACHMENT_SIZE_MB', value: '10', description: 'Maximum allowed attachment file size in MB' },
  ];

  for (const st of settings) {
    const existing = await db.query('SELECT setting_key FROM system_settings WHERE setting_key = ?', [st.key]);
    if (existing.length === 0) {
      await db.execute('INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)', [
        st.key,
        st.value,
        st.description,
      ]);
    }
  }

  // Helper to ensure user
  async function ensureUser(email: string, role: string): Promise<number> {
    const rows = await db.query<{ id: number }>('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return rows[0].id;
    const res = await db.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      [email, passwordHash, role]
    );
    return res.insertId;
  }

  // 4. Default System Users & Employees
  const adminUserId = await ensureUser('admin@kanvtech.com', 'ADMIN');
  const managerUserId = await ensureUser('manager@kanvtech.com', 'MANAGER');
  const l1UserId = await ensureUser('l1.amit@kanvtech.com', 'L1_EMPLOYEE');
  const l1AltUserId = await ensureUser('l1.neha@kanvtech.com', 'L1_EMPLOYEE');
  const l2UserId = await ensureUser('l2.vikram@kanvtech.com', 'L2_EMPLOYEE');
  const l3UserId = await ensureUser('l3.priya@kanvtech.com', 'L3_EMPLOYEE');
  const customerUserId = await ensureUser('rajesh@acme.com', 'CUSTOMER');
  const customerZenithUserId = await ensureUser('anjali@zenith.com', 'CUSTOMER');

  // 5. Employees
  const employees = [
    { id: 'EMP-001', userId: managerUserId, name: 'Rahul Verma', email: 'manager@kanvtech.com', phone: '+91 98765 43210', dept: 'Service Delivery', desig: 'Service Operations Manager', level: 'L3', managerId: null },
    { id: 'EMP-002', userId: l1UserId, name: 'Amit Sharma', email: 'l1.amit@kanvtech.com', phone: '+91 98765 43211', dept: 'Service Desk', desig: 'L1 Support Engineer', level: 'L1', managerId: 'EMP-001' },
    { id: 'EMP-003', userId: l1AltUserId, name: 'Neha Gupta', email: 'l1.neha@kanvtech.com', phone: '+91 98765 43212', dept: 'Service Desk', desig: 'L1 Support Engineer', level: 'L1', managerId: 'EMP-001' },
    { id: 'EMP-004', userId: l2UserId, name: 'Vikram Malhotra', email: 'l2.vikram@kanvtech.com', phone: '+91 98765 43213', dept: 'Technical Services', desig: 'L2 Senior Specialist', level: 'L2', managerId: 'EMP-001' },
    { id: 'EMP-005', userId: l3UserId, name: 'Priya Nair', email: 'l3.priya@kanvtech.com', phone: '+91 98765 43214', dept: 'Core Engineering', desig: 'L3 Principal Architect', level: 'L3', managerId: 'EMP-001' },
  ];

  for (const emp of employees) {
    const existing = await db.query('SELECT id FROM employees WHERE id = ?', [emp.id]);
    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO employees (id, user_id, name, email, phone, department, designation, level, manager_id, availability, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'AVAILABLE\', \'ACTIVE\')',
        [emp.id, emp.userId, emp.name, emp.email, emp.phone, emp.dept, emp.desig, emp.level, emp.managerId]
      );
    }
  }

  // 6. Companies & Contacts
  const existingCompany = await db.query('SELECT id FROM companies WHERE id = ?', ['CMP-0001']);
  if (existingCompany.length === 0) {
    await db.execute(
      `INSERT INTO companies (
        id, company_name, address, gstn, primary_email, alternate_emails,
        contact_person, contact_phone, contact_address, contact_status,
        alternate_contact, alternate_contact_phone, alternate_contact_email, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 1)`,
      [
        'CMP-0001',
        'Acme Technologies Pvt Ltd',
        'Tower B, 4th Floor, Tech Park, Bangalore 560100',
        '29AABCA1234F1Z5',
        'contact@acme.com',
        'billing@acme.com, alerts@acme.com',
        'Rajesh Mehta',
        '+91 98200 11223',
        'Bangalore Office',
        'Sunita Rao',
        '+91 98200 99887',
        'sunita@acme.com',
      ]
    );

    // Primary Contact
    await db.execute(
      `INSERT INTO company_contacts (company_id, user_id, name, email, phone, designation, is_primary, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      ['CMP-0001', customerUserId, 'Rajesh Mehta', 'rajesh@acme.com', '+91 98200 11223', 'IT Director']
    );

    // Alternate Contact
    await db.execute(
      `INSERT INTO company_contacts (company_id, user_id, name, email, phone, designation, is_primary, is_active)
       VALUES (?, NULL, ?, ?, ?, ?, 0, 1)`,
      ['CMP-0001', 'Sunita Rao', 'sunita@acme.com', '+91 98200 99887', 'System Administrator']
    );
  }

  const existingCompany2 = await db.query('SELECT id FROM companies WHERE id = ?', ['CMP-0002']);
  if (existingCompany2.length === 0) {
    await db.execute(
      `INSERT INTO companies (
        id, company_name, address, gstn, primary_email,
        contact_person, contact_phone, contact_status, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)`,
      [
        'CMP-0002',
        'Zenith Infotech Global',
        'DLF Cyber City, Phase 3, Gurugram 122002',
        '06XYZPA5678B2Z9',
        'support@zenith.com',
        'Anjali Patel',
        '+91 97110 55443',
      ]
    );

    await db.execute(
      `INSERT INTO company_contacts (company_id, user_id, name, email, phone, designation, is_primary, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      ['CMP-0002', customerZenithUserId, 'Anjali Patel', 'anjali@zenith.com', '+91 97110 55443', 'VP Infrastructure']
    );
  }

  console.log('[Seed] Database successfully seeded with standard enterprise users, roles, SLAs, and masters!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
