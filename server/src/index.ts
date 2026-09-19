import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { apiRouter } from './routes/api';
import { db } from './db/database';

const app = express();

// Security & Parsing Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static uploaded files
app.use('/uploads', express.static(config.uploadDir));

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'UP',
    name: 'Kanvtech Service Management API',
    timestamp: new Date().toISOString(),
    isMySQL: db.isMySQL(),
  });
});

// Mount all REST endpoints
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'An unexpected operational error occurred.',
  });
});

// Startup Server
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`KANVTECH SERVICE MANAGEMENT PLATFORM - API SERVER`);
    console.log(`Listening on http://localhost:${config.port}`);
    console.log(`Environment: Production Architecture`);
    console.log(`Database engine: ${db.isMySQL() ? 'MySQL (Live Connection Pool)' : 'Relational Engine'}`);
    console.log(`=======================================================`);
  });

  const gracefulShutdown = async () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(async () => {
      await db.close();
      console.log('[Server] Connections closed. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

export { app };
