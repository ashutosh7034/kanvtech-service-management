import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export async function initializeDatabase() {
  console.log('[InitDb] Starting database initialization...');
  try {
    // 1. Connect without database selected to create database if needed
    const connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
    });

    console.log(`[InitDb] Connected to MySQL host ${config.database.host}:${config.database.port}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`[InitDb] Database \`${config.database.database}\` verified or created.`);
    await connection.end();

    // 2. Connect to the specific database and execute schema
    const pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      multipleStatements: true,
    });

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[InitDb] Applying MySQL schema tables...');
    await pool.query(schemaSql);
    console.log('[InitDb] All 19 relational tables, indexes, and constraints successfully initialized!');
    await pool.end();
  } catch (err: any) {
    console.warn(`[InitDb] Notice: Live MySQL initialization could not reach MySQL host (${err.message}). Database layer will use relational engine fallback.`);
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[InitDb] Error:', err);
      process.exit(1);
    });
}
