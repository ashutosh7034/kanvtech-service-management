import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'kanvtech-production-jwt-secret-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kanvtech_sm',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
  slaDefaults: {
    HIGH: { responseHours: 0.5, resolutionHours: 4, warningPercent: 75 },
    MEDIUM: { responseHours: 2.0, resolutionHours: 12, warningPercent: 75 },
    LOW: { responseHours: 4.0, resolutionHours: 24, warningPercent: 75 },
  },
  uploadDir: path.resolve(__dirname, '../../uploads'),
  twoOpenTicketLimit: 2,
};
