import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { config } from '../config';
import { AuthTokenPayload, User, UserRole } from '../types';
import { AuditService } from './auditService';

export class AuthService {
  public static async login(email: string, passwordPlain: string, ipAddress?: string): Promise<{ token: string; user: any }> {
    const trimmedEmail = email.trim().toLowerCase();
    const rows = await db.query<User>('SELECT * FROM users WHERE LOWER(email) = ?', [trimmedEmail]);

    if (rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = rows[0];

    if (!user.is_active) {
      throw new Error('This account has been deactivated. Please contact your system administrator.');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Lookup associated employee or company details
    let employeeId: string | null = null;
    let companyId: string | null = null;
    let contactId: number | null = null;
    let displayName = user.email.split('@')[0];

    if (user.role === 'CUSTOMER') {
      const contactRows = await db.query<any>(
        'SELECT id, company_id, name FROM company_contacts WHERE user_id = ? OR LOWER(email) = ? LIMIT 1',
        [user.id, trimmedEmail]
      );
      if (contactRows.length > 0) {
        contactId = contactRows[0].id;
        companyId = contactRows[0].company_id;
        displayName = contactRows[0].name;
      }
    } else {
      const empRows = await db.query<any>('SELECT id, name FROM employees WHERE user_id = ? OR LOWER(email) = ? LIMIT 1', [
        user.id,
        trimmedEmail,
      ]);
      if (empRows.length > 0) {
        employeeId = empRows[0].id;
        displayName = empRows[0].name;
      }
    }

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      companyId,
      contactId,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });

    await AuditService.log({
      actorUserId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: String(user.id),
      ipAddress,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName,
        employeeId,
        companyId,
        contactId,
      },
    };
  }

  public static verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch (err) {
      throw new Error('Invalid or expired authentication session');
    }
  }

  public static async getUserById(id: number): Promise<any | null> {
    const rows = await db.query<any>(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
              e.id as employee_id, e.name as employee_name, e.level as employee_level, e.availability,
              cc.id as contact_id, cc.company_id, c.company_name
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       LEFT JOIN company_contacts cc ON cc.user_id = u.id
       LEFT JOIN companies c ON cc.company_id = c.id
       WHERE u.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}
