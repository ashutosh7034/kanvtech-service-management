import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { Employee, EmployeeAttendance } from '../types';
import { AuditService } from './auditService';

export class EmployeeService {
  public static async getEmployees(params: {
    level?: string;
    status?: string;
    availability?: string;
    department?: string;
    search?: string;
  }): Promise<Employee[]> {
    let whereSql = '1=1';
    const queryParams: any[] = [];

    if (params.level) {
      whereSql += ' AND e.level = ?';
      queryParams.push(params.level);
    }
    if (params.status) {
      whereSql += ' AND e.status = ?';
      queryParams.push(params.status);
    }
    if (params.availability) {
      whereSql += ' AND e.availability = ?';
      queryParams.push(params.availability);
    }
    if (params.department) {
      whereSql += ' AND e.department = ?';
      queryParams.push(params.department);
    }
    if (params.search && params.search.trim()) {
      whereSql += ' AND (LOWER(e.name) LIKE ? OR LOWER(e.email) LIKE ? OR LOWER(e.id) LIKE ? OR LOWER(e.department) LIKE ?)';
      const s = `%${params.search.trim().toLowerCase()}%`;
      queryParams.push(s, s, s, s);
    }

    const rows = await db.query<any>(
      `SELECT e.*,
              m.name as manager_name,
              (SELECT COUNT(*) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.status IN ('OPEN', 'IN_PROGRESS')) as active_ticket_count,
              (SELECT status FROM employee_attendance ea WHERE ea.employee_id = e.id ORDER BY ea.created_at DESC LIMIT 1) as current_attendance_status
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.id
       WHERE ${whereSql}
       ORDER BY e.level ASC, e.name ASC`,
      queryParams
    );

    return rows;
  }

  public static async getEmployeeById(id: string): Promise<any | null> {
    const rows = await db.query<any>(
      `SELECT e.*, m.name as manager_name,
              (SELECT COUNT(*) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.status IN ('OPEN', 'IN_PROGRESS')) as active_ticket_count
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.id
       WHERE e.id = ?`,
      [id]
    );
    if (rows.length === 0) return null;

    // Recent tickets handled
    const recentTickets = await db.query<any>(
      `SELECT id, problem_type, priority, status, created_at, assigned_level, total_resolution_seconds
       FROM tickets
       WHERE assigned_employee_id = ?
       ORDER BY updated_at DESC
       LIMIT 10`,
      [id]
    );

    return {
      ...rows[0],
      recentTickets,
    };
  }

  public static async createEmployee(
    data: {
      name: string;
      email: string;
      phone: string;
      department: string;
      designation: string;
      level: 'L1' | 'L2' | 'L3';
      manager_id?: string;
      password?: string;
    },
    actorUserId?: number
  ): Promise<string> {
    const email = data.email.trim().toLowerCase();

    // Check duplicate
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
    if (existing.length > 0) {
      throw new Error(`A user with email ${email} already exists.`);
    }

    // Role mapping
    let role = 'L1_EMPLOYEE';
    if (data.level === 'L2') role = 'L2_EMPLOYEE';
    if (data.level === 'L3') role = 'L3_EMPLOYEE';

    // Hash password
    const passwordHash = await bcrypt.hash(data.password || 'Password@123', 10);
    const userRes = await db.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      [email, passwordHash, role]
    );
    const userId = userRes.insertId;

    // Generate EMP-ID
    const countRows = await db.query<{ total: number }>('SELECT COUNT(*) as total FROM employees');
    const nextNum = (countRows[0]?.total || 0) + 1;
    const employeeId = `EMP-${String(nextNum).padStart(3, '0')}`;

    await db.execute(
      `INSERT INTO employees (id, user_id, name, email, phone, department, designation, level, manager_id, availability, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'ACTIVE')`,
      [
        employeeId,
        userId,
        data.name.trim(),
        email,
        data.phone.trim(),
        data.department.trim(),
        data.designation.trim(),
        data.level,
        data.manager_id || null,
      ]
    );

    await AuditService.log({
      actorUserId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      newValues: { employeeId, name: data.name, level: data.level },
    });

    return employeeId;
  }

  public static async updateEmployee(
    id: string,
    data: Partial<Employee>,
    actorUserId?: number
  ): Promise<void> {
    const existing = await db.query<Employee>('SELECT * FROM employees WHERE id = ?', [id]);
    if (existing.length === 0) throw new Error('Employee not found');

    await db.execute(
      `UPDATE employees SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        department = COALESCE(?, department),
        designation = COALESCE(?, designation),
        level = COALESCE(?, level),
        manager_id = COALESCE(?, manager_id),
        availability = COALESCE(?, availability),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name || null,
        data.phone || null,
        data.department || null,
        data.designation || null,
        data.level || null,
        data.manager_id !== undefined ? data.manager_id : null,
        data.availability || null,
        data.status || null,
        id,
      ]
    );

    // Update user role if level changed
    if (data.level) {
      let role = 'L1_EMPLOYEE';
      if (data.level === 'L2') role = 'L2_EMPLOYEE';
      if (data.level === 'L3') role = 'L3_EMPLOYEE';
      await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, existing[0].user_id]);
    }

    await AuditService.log({
      actorUserId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'EMPLOYEE',
      entityId: id,
      newValues: data,
    });
  }

  public static async checkIn(params: {
    employeeId: string;
    lat?: number;
    lng?: number;
    address?: string;
  }): Promise<EmployeeAttendance> {
    const emp = await db.query<Employee>('SELECT id FROM employees WHERE id = ?', [params.employeeId]);
    if (emp.length === 0) throw new Error('Employee not found');

    const res = await db.execute(
      `INSERT INTO employee_attendance (employee_id, check_in_time, location_lat, location_lng, location_address, status)
       VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, 'CHECKED_IN')`,
      [params.employeeId, params.lat || null, params.lng || null, params.address || 'Office / Remote']
    );

    // Set employee available
    await db.execute('UPDATE employees SET availability = \'AVAILABLE\' WHERE id = ?', [params.employeeId]);

    const record = await db.query<EmployeeAttendance>('SELECT * FROM employee_attendance WHERE id = ?', [res.insertId]);
    return record[0];
  }

  public static async checkOut(params: {
    employeeId: string;
    lat?: number;
    lng?: number;
    address?: string;
  }): Promise<void> {
    // Find last active check-in
    const rows = await db.query<EmployeeAttendance>(
      'SELECT id FROM employee_attendance WHERE employee_id = ? AND status = \'CHECKED_IN\' ORDER BY check_in_time DESC LIMIT 1',
      [params.employeeId]
    );

    if (rows.length > 0) {
      await db.execute(
        `UPDATE employee_attendance SET
          check_out_time = CURRENT_TIMESTAMP,
          status = 'CHECKED_OUT'
         WHERE id = ?`,
        [rows[0].id]
      );
    }

    // Set employee offline
    await db.execute('UPDATE employees SET availability = \'OFFLINE\' WHERE id = ?', [params.employeeId]);
  }
}
