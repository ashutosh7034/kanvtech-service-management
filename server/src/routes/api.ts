import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { requireAuth, requireRoles } from '../middleware/authMiddleware';
import { AuthController } from '../controllers/authController';
import { CompanyController } from '../controllers/companyController';
import { EmployeeController } from '../controllers/employeeController';
import { TicketController } from '../controllers/ticketController';
import { ImportController } from '../controllers/importController';
import { ReportController } from '../controllers/reportController';
import { NotificationService } from '../services/notificationService';
import { AuditService } from '../services/auditService';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Multer storage for disk uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const diskUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.docx', '.csv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not allowed.`));
    }
  },
});

// Multer memory storage for Excel parsing
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const apiRouter = Router();

// -------------------------------------------------------------
// Authentication Routes
// -------------------------------------------------------------
apiRouter.post('/auth/login', AuthController.login);
apiRouter.get('/auth/me', requireAuth, AuthController.me);

// -------------------------------------------------------------
// Notifications Routes
// -------------------------------------------------------------
apiRouter.get('/notifications', requireAuth, async (req: any, res) => {
  try {
    const list = await NotificationService.getUserNotifications(req.user.userId);
    res.json({ success: true, notifications: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/notifications/:id/read', requireAuth, async (req: any, res) => {
  try {
    await NotificationService.markAsRead(parseInt(req.params.id, 10), req.user.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/notifications/read-all', requireAuth, async (req: any, res) => {
  try {
    await NotificationService.markAllAsRead(req.user.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Companies Master Routes
// -------------------------------------------------------------
apiRouter.get('/companies', requireAuth, CompanyController.getCompanies);
apiRouter.get('/companies/:id', requireAuth, CompanyController.getCompany);
apiRouter.post('/companies', requireAuth, requireRoles('ADMIN', 'MANAGER'), CompanyController.createCompany);
apiRouter.put('/companies/:id', requireAuth, requireRoles('ADMIN', 'MANAGER'), CompanyController.updateCompany);
apiRouter.post('/companies/:id/status', requireAuth, requireRoles('ADMIN'), CompanyController.toggleStatus);

// -------------------------------------------------------------
// Employee Management Routes
// -------------------------------------------------------------
apiRouter.get('/employees', requireAuth, requireRoles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'), EmployeeController.getEmployees);
apiRouter.get('/employees/:id', requireAuth, requireRoles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'), EmployeeController.getEmployee);
apiRouter.post('/employees', requireAuth, requireRoles('ADMIN', 'MANAGER'), EmployeeController.createEmployee);
apiRouter.put('/employees/:id', requireAuth, requireRoles('ADMIN', 'MANAGER'), EmployeeController.updateEmployee);
apiRouter.post('/employees/attendance/check-in', requireAuth, EmployeeController.checkIn);
apiRouter.post('/employees/attendance/check-out', requireAuth, EmployeeController.checkOut);

// -------------------------------------------------------------
// Support Tickets Core Routes
// -------------------------------------------------------------
apiRouter.get('/tickets', requireAuth, TicketController.getTickets);
apiRouter.get('/tickets/:id', requireAuth, TicketController.getTicket);
apiRouter.post('/tickets', requireAuth, TicketController.createTicket);
apiRouter.post('/tickets/:id/assign', requireAuth, requireRoles('ADMIN', 'MANAGER'), TicketController.assignTicket);
apiRouter.post('/tickets/:id/start', requireAuth, requireRoles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'), TicketController.startWork);
apiRouter.post('/tickets/:id/escalate', requireAuth, requireRoles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'), TicketController.escalateTicket);
apiRouter.post('/tickets/:id/resolve', requireAuth, requireRoles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'), TicketController.resolveTicket);
apiRouter.post('/tickets/:id/approve', requireAuth, requireRoles('ADMIN', 'MANAGER'), TicketController.approveTicket);
apiRouter.post('/tickets/:id/reopen', requireAuth, requireRoles('ADMIN', 'MANAGER'), TicketController.reopenTicket);
apiRouter.post('/tickets/:id/feedback', requireAuth, requireRoles('ADMIN', 'CUSTOMER'), TicketController.submitFeedback);
apiRouter.post('/tickets/:id/close', requireAuth, requireRoles('ADMIN', 'MANAGER'), TicketController.closeTicket);
apiRouter.post('/tickets/:id/comments', requireAuth, TicketController.addComment);
apiRouter.post('/tickets/:id/attachments', requireAuth, diskUpload.single('file'), TicketController.uploadAttachment);

// -------------------------------------------------------------
// Excel Import Routes
// -------------------------------------------------------------
apiRouter.get('/import/template/:type', requireAuth, requireRoles('ADMIN', 'MANAGER'), ImportController.downloadTemplate);
apiRouter.post('/import/preview/:type', requireAuth, requireRoles('ADMIN', 'MANAGER'), memoryUpload.single('file'), ImportController.previewImport);
apiRouter.post('/import/commit/:type', requireAuth, requireRoles('ADMIN', 'MANAGER'), ImportController.commitImport);

// -------------------------------------------------------------
// Reports, Analytics & SLA Routes
// -------------------------------------------------------------
apiRouter.get('/reports/dashboard', requireAuth, ReportController.getDashboard);
apiRouter.get('/reports/resolution-by-level', requireAuth, requireRoles('ADMIN', 'MANAGER'), ReportController.getResolutionByLevel);
apiRouter.get('/reports/workload', requireAuth, requireRoles('ADMIN', 'MANAGER'), ReportController.getEmployeeWorkload);
apiRouter.get('/reports/escalations', requireAuth, requireRoles('ADMIN', 'MANAGER'), ReportController.getEscalationReport);
apiRouter.get('/reports/sla', requireAuth, ReportController.getSLASettings);
apiRouter.put('/reports/sla', requireAuth, requireRoles('ADMIN'), ReportController.updateSLASettings);

// -------------------------------------------------------------
// Audit Logs
// -------------------------------------------------------------
apiRouter.get('/audit-logs', requireAuth, requireRoles('ADMIN'), async (_req, res) => {
  try {
    const logs = await AuditService.getLogs(100);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
