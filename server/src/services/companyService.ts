import { db } from '../db/database';
import { Company, CompanyContact } from '../types';
import { AuditService } from './auditService';

export class CompanyService {
  public static async getCompanies(params: {
    search?: string;
    isActive?: string;
    companyId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 20);
    const offset = (page - 1) * limit;

    let whereSql = '1=1';
    const queryParams: any[] = [];

    if (params.companyId) {
      whereSql += ' AND c.id = ?';
      queryParams.push(params.companyId);
    }

    if (params.search && params.search.trim()) {
      whereSql += ' AND (LOWER(c.company_name) LIKE ? OR LOWER(c.id) LIKE ? OR LOWER(c.primary_email) LIKE ? OR LOWER(c.contact_person) LIKE ?)';
      const s = `%${params.search.trim().toLowerCase()}%`;
      queryParams.push(s, s, s, s);
    }

    if (params.isActive !== undefined && params.isActive !== '') {
      whereSql += ' AND c.is_active = ?';
      queryParams.push(params.isActive === '1' || params.isActive === 'true' ? 1 : 0);
    }

    // Count
    const countRows = await db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM companies c WHERE ${whereSql}`,
      queryParams
    );
    const total = countRows[0]?.total || 0;

    // Data query with ticket stats
    const rows = await db.query<any>(
      `SELECT c.*,
              (SELECT COUNT(*) FROM tickets t WHERE t.company_id = c.id AND t.status IN ('OPEN', 'IN_PROGRESS')) as open_ticket_count,
              (SELECT COUNT(*) FROM tickets t WHERE t.company_id = c.id AND t.status = 'RESOLVED') as resolved_ticket_count,
              (SELECT COUNT(*) FROM tickets t WHERE t.company_id = c.id AND t.status = 'CLOSED') as closed_ticket_count
       FROM companies c
       WHERE ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return {
      data: rows,
      total,
      page,
      limit,
    };
  }

  public static async getCompanyById(id: string): Promise<any | null> {
    const rows = await db.query<Company>('SELECT * FROM companies WHERE id = ?', [id]);
    if (rows.length === 0) return null;

    const company = rows[0];

    // Get contacts
    const contacts = await db.query<CompanyContact>(
      'SELECT * FROM company_contacts WHERE company_id = ? ORDER BY is_primary DESC, created_at ASC',
      [id]
    );

    // Get ticket summary
    const summaryRows = await db.query<any>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
         SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_count,
         SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_count
       FROM tickets 
       WHERE company_id = ?`,
      [id]
    );

    // Recent 5 tickets
    const recentTickets = await db.query<any>(
      `SELECT id, problem_type, priority, status, created_at, sla_status
       FROM tickets
       WHERE company_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [id]
    );

    return {
      ...company,
      contacts,
      ticketSummary: {
        total: summaryRows[0]?.total || 0,
        open: summaryRows[0]?.open_count || 0,
        inProgress: summaryRows[0]?.in_progress_count || 0,
        resolved: summaryRows[0]?.resolved_count || 0,
        closed: summaryRows[0]?.closed_count || 0,
      },
      recentTickets,
    };
  }

  public static async createCompany(
    data: {
      company_name: string;
      address: string;
      gstn?: string;
      primary_email: string;
      alternate_emails?: string;
      contact_person: string;
      contact_phone: string;
      contact_address?: string;
      alternate_contact?: string;
      alternate_contact_phone?: string;
      alternate_contact_address?: string;
      alternate_contact_email?: string;
      contacts?: Array<{ name: string; email: string; phone: string; designation?: string; is_primary?: boolean }>;
    },
    actorUserId?: number
  ): Promise<string> {
    // Duplicate validation checks
    const existingName = await db.query<any>('SELECT id FROM companies WHERE LOWER(company_name) = ?', [data.company_name.trim().toLowerCase()]);
    if (existingName.length > 0) {
      throw new Error(`Company with name '${data.company_name}' already exists.`);
    }

    const existingEmail = await db.query<any>('SELECT id FROM companies WHERE LOWER(primary_email) = ?', [data.primary_email.trim().toLowerCase()]);
    if (existingEmail.length > 0) {
      throw new Error(`Company with primary email '${data.primary_email}' already exists.`);
    }

    if (data.gstn && data.gstn.trim()) {
      const existingGstn = await db.query<any>('SELECT id FROM companies WHERE UPPER(gstn) = ?', [data.gstn.trim().toUpperCase()]);
      if (existingGstn.length > 0) {
        throw new Error(`Company with GSTN '${data.gstn}' already exists.`);
      }
    }

    // Generate next company ID: CMP-XXXX monotonically from existing IDs
    const existingCompRows = await db.query<any>('SELECT id FROM companies');
    let maxNum = 0;
    for (const r of existingCompRows) {
      const match = r.id?.match(/^CMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const companyId = `CMP-${String(maxNum + 1).padStart(4, '0')}`;

    await db.execute(
      `INSERT INTO companies (
        id, company_name, address, gstn, primary_email, alternate_emails,
        contact_person, contact_phone, contact_address, contact_status,
        alternate_contact, alternate_contact_phone, alternate_contact_address, alternate_contact_email, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 1)`,
      [
        companyId,
        data.company_name.trim(),
        data.address.trim(),
        data.gstn?.trim() || null,
        data.primary_email.trim().toLowerCase(),
        data.alternate_emails?.trim() || null,
        data.contact_person.trim(),
        data.contact_phone.trim(),
        data.contact_address?.trim() || null,
        data.alternate_contact?.trim() || null,
        data.alternate_contact_phone?.trim() || null,
        data.alternate_contact_address?.trim() || null,
        data.alternate_contact_email?.trim()?.toLowerCase() || null,
      ]
    );

    // Primary contact entry
    await db.execute(
      `INSERT INTO company_contacts (company_id, name, email, phone, designation, is_primary, is_active)
       VALUES (?, ?, ?, ?, 'Primary Contact', 1, 1)`,
      [companyId, data.contact_person.trim(), data.primary_email.trim().toLowerCase(), data.contact_phone.trim()]
    );

    // Additional contacts if provided
    if (data.contacts && Array.isArray(data.contacts)) {
      for (const c of data.contacts) {
        if (c.email && c.name) {
          await db.execute(
            `INSERT INTO company_contacts (company_id, name, email, phone, designation, is_primary, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [companyId, c.name.trim(), c.email.trim().toLowerCase(), c.phone || '', c.designation || 'Contact', c.is_primary ? 1 : 0]
          );
        }
      }
    }

    await AuditService.log({
      actorUserId,
      action: 'COMPANY_CREATED',
      entityType: 'COMPANY',
      entityId: companyId,
      newValues: { companyId, name: data.company_name },
    });

    return companyId;
  }

  public static async updateCompany(
    id: string,
    data: Partial<Company>,
    actorUserId?: number
  ): Promise<void> {
    const existing = await db.query<Company>('SELECT * FROM companies WHERE id = ?', [id]);
    if (existing.length === 0) throw new Error('Company not found');

    await db.execute(
      `UPDATE companies SET
        company_name = COALESCE(?, company_name),
        address = COALESCE(?, address),
        gstn = COALESCE(?, gstn),
        primary_email = COALESCE(?, primary_email),
        alternate_emails = COALESCE(?, alternate_emails),
        contact_person = COALESCE(?, contact_person),
        contact_phone = COALESCE(?, contact_phone),
        contact_address = COALESCE(?, contact_address),
        alternate_contact = COALESCE(?, alternate_contact),
        alternate_contact_phone = COALESCE(?, alternate_contact_phone),
        alternate_contact_email = COALESCE(?, alternate_contact_email),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.company_name?.trim() || null,
        data.address?.trim() || null,
        data.gstn?.trim() || null,
        data.primary_email?.trim()?.toLowerCase() || null,
        data.alternate_emails?.trim() || null,
        data.contact_person?.trim() || null,
        data.contact_phone?.trim() || null,
        data.contact_address?.trim() || null,
        data.alternate_contact?.trim() || null,
        data.alternate_contact_phone?.trim() || null,
        data.alternate_contact_email?.trim()?.toLowerCase() || null,
        data.is_active !== undefined ? data.is_active : null,
        id,
      ]
    );

    await AuditService.log({
      actorUserId,
      action: 'COMPANY_UPDATED',
      entityType: 'COMPANY',
      entityId: id,
      oldValues: existing[0],
      newValues: data,
    });
  }

  public static async toggleCompanyStatus(id: string, isActive: boolean, actorUserId?: number): Promise<void> {
    await db.execute('UPDATE companies SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      isActive ? 1 : 0,
      id,
    ]);

    await AuditService.log({
      actorUserId,
      action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
      entityType: 'COMPANY',
      entityId: id,
    });
  }
}
