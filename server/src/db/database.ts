import mysql from 'mysql2/promise';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

export interface IDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId: number }>;
  close(): Promise<void>;
  isMySQL(): boolean;
}

class MySQLDatabase implements IDatabase {
  private pool: mysql.Pool | null = null;
  private isConnected = false;
  private fallbackDb: any = null;

  constructor() {
    this.initPool();
  }

  private initPool() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        waitForConnections: true,
        connectionLimit: config.database.connectionLimit,
        queueLimit: config.database.queueLimit,
        decimalNumbers: true,
      });
    } catch (err) {
      console.warn('[DB] MySQL pool initialization deferred:', err);
    }
  }

  private resolvedClient: IDatabase | null = null;

  public async getClient(): Promise<IDatabase> {
    if (this.resolvedClient) return this.resolvedClient;

    if (this.pool) {
      try {
        const conn = await this.pool.getConnection();
        await conn.ping();
        conn.release();
        this.isConnected = true;
        this.resolvedClient = this;
        console.log(`[DB] Connected successfully to MySQL (${config.database.host}:${config.database.port}/${config.database.database})`);
        return this;
      } catch (err: any) {
        console.warn(`[DB] MySQL server not reached (${err.code || err.message}). Using database fallback engine.`);
        this.resolvedClient = this.getFallbackDb();
        return this.resolvedClient;
      }
    }
    this.resolvedClient = this.getFallbackDb();
    return this.resolvedClient;
  }

  private getFallbackDb(): IDatabase {
    if (!this.fallbackDb) {
      // Use Node 22's built-in sqlite engine as an ACID relational fallback
      const { DatabaseSync } = require('node:sqlite');
      const dbPath = path.resolve(__dirname, '../../data.sqlite');
      const sqlite = new DatabaseSync(dbPath);
      sqlite.exec('PRAGMA foreign_keys = ON;');
      sqlite.exec('PRAGMA journal_mode = WAL;');

      this.fallbackDb = {
        query: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
          const convertedSql = this.convertMySQLtoSQLite(sql);
          try {
            const stmt = sqlite.prepare(convertedSql);
            return stmt.all(...params) as T[];
          } catch (e: any) {
            console.error('[FallbackDB Error in Query]:', e.message, 'SQL:', convertedSql, 'Params:', params);
            throw e;
          }
        },
        execute: async (sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId: number }> => {
          const convertedSql = this.convertMySQLtoSQLite(sql);
          try {
            const stmt = sqlite.prepare(convertedSql);
            const info = stmt.run(...params);
            return {
              affectedRows: Number(info.changes),
              insertId: Number(info.lastInsertRowid),
            };
          } catch (e: any) {
            console.error('[FallbackDB Error in Execute]:', e.message, 'SQL:', convertedSql, 'Params:', params);
            throw e;
          }
        },
        close: async () => {
          sqlite.close();
        },
        isMySQL: () => false,
      };

      // Initialize schema in fallback
      this.initFallbackSchema(sqlite);
    }
    return this.fallbackDb;
  }

  private initFallbackSchema(sqlite: any) {
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS roles (
        name TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        permissions_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        address TEXT NOT NULL,
        gstn TEXT NULL,
        primary_email TEXT NOT NULL,
        alternate_emails TEXT NULL,
        contact_person TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        contact_address TEXT NULL,
        contact_status TEXT NOT NULL DEFAULT 'ACTIVE',
        alternate_contact TEXT NULL,
        alternate_contact_phone TEXT NULL,
        alternate_contact_address TEXT NULL,
        alternate_contact_email TEXT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS company_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT NOT NULL,
        user_id INTEGER NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        designation TEXT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        department TEXT NOT NULL,
        designation TEXT NOT NULL,
        level TEXT NOT NULL,
        manager_id TEXT NULL,
        availability TEXT NOT NULL DEFAULT 'AVAILABLE',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS employee_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        check_in_time DATETIME NOT NULL,
        check_out_time DATETIME NULL,
        location_lat REAL NULL,
        location_lng REAL NULL,
        location_address TEXT NULL,
        status TEXT NOT NULL DEFAULT 'CHECKED_IN',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        customer_contact_id INTEGER NOT NULL,
        problem_type TEXT NOT NULL,
        priority TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        assigned_employee_id TEXT NULL,
        assigned_level TEXT NOT NULL DEFAULT 'L1',
        status TEXT NOT NULL DEFAULT 'OPEN',
        sla_priority TEXT NOT NULL DEFAULT 'MEDIUM',
        sla_deadline DATETIME NULL,
        sla_status TEXT NOT NULL DEFAULT 'ON_TRACK',
        resolution_started_at DATETIME NULL,
        resolution_ended_at DATETIME NULL,
        total_resolution_seconds INTEGER NOT NULL DEFAULT 0,
        closed_at DATETIME NULL,
        closed_by INTEGER NULL,
        closure_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
        FOREIGN KEY (customer_contact_id) REFERENCES company_contacts(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
        FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        level TEXT NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        unassigned_at DATETIME NULL,
        assignment_type TEXT NOT NULL DEFAULT 'MANUAL',
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS ticket_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        actor_user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NULL,
        metadata_json TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS ticket_escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        from_level TEXT NOT NULL,
        to_level TEXT NOT NULL,
        escalated_by_employee_id TEXT NOT NULL,
        assigned_to_employee_id TEXT NULL,
        reason TEXT NOT NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (escalated_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_resolution_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        level TEXT NOT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        author_user_id INTEGER NOT NULL,
        comment_type TEXT NOT NULL DEFAULT 'INTERNAL_NOTE',
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS ticket_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL UNIQUE,
        customer_user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        remarks TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS sla_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        priority TEXT NOT NULL UNIQUE,
        response_time_hours REAL NOT NULL,
        resolution_time_hours REAL NOT NULL,
        warning_threshold_percent INTEGER NOT NULL DEFAULT 75,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        link_url TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NULL,
        status TEXT NOT NULL DEFAULT 'SENT',
        error_message TEXT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_values_json TEXT NULL,
        new_values_json TEXT NULL,
        ip_address TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        description TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    sqlite.exec(schemaSql);
  }

  private convertMySQLtoSQLite(sql: string): string {
    // Converts common MySQL syntax idiosyncrasies (e.g. NOW() -> datetime('now'), ON DUPLICATE KEY, etc.)
    return sql
      .replace(/NOW\(\)/gi, "datetime('now')")
      .replace(/CURRENT_TIMESTAMP\(\)/gi, "datetime('now')")
      .replace(/UNIX_TIMESTAMP\((.*?)\)/gi, "strftime('%s', $1)")
      .replace(/TIMESTAMPDIFF\(SECOND,\s*(.*?),\s*NOW\(\)\)/gi, "(strftime('%s', 'now') - strftime('%s', $1))")
      .replace(/TIMESTAMPDIFF\(SECOND,\s*(.*?),\s*(.*?)\)/gi, "(strftime('%s', $2) - strftime('%s', $1))")
      .replace(/DATE_ADD\((.*?),\s*INTERVAL\s+(\d+|\?)\s+HOUR\)/gi, "datetime($1, '+' || $2 || ' hours')");
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.getClient();
    if (client !== this) {
      return client.query<T>(sql, params);
    }
    const [rows] = await this.pool!.query(sql, params);
    return rows as T[];
  }

  public async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId: number }> {
    const client = await this.getClient();
    if (client !== this) {
      return client.execute(sql, params);
    }
    const [result] = await this.pool!.execute(sql, params);
    const r = result as mysql.ResultSetHeader;
    return {
      affectedRows: r.affectedRows,
      insertId: r.insertId,
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.fallbackDb) {
      await this.fallbackDb.close();
    }
  }

  public isMySQL(): boolean {
    return this.isConnected;
  }
}

export const db = new MySQLDatabase();
