import { db } from '../db/database';

export class AuditService {
  public static async log(params: {
    actorUserId?: number | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await db.execute(
        `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, old_values_json, new_values_json, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          params.actorUserId || null,
          params.action,
          params.entityType,
          params.entityId,
          params.oldValues ? JSON.stringify(params.oldValues) : null,
          params.newValues ? JSON.stringify(params.newValues) : null,
          params.ipAddress || null,
        ]
      );
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err);
    }
  }

  public static async getLogs(limit = 100): Promise<any[]> {
    return db.query(
      `SELECT a.*, u.email as actor_email, u.role as actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}
