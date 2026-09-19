import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ReportService } from '../services/reportService';
import { SLAService } from '../services/slaService';

export class ReportController {
  public static async getDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const userRole = req.user!.role;
      const metrics = await ReportService.getDashboardMetrics(
        userRole,
        req.user?.userId,
        req.user?.employeeId || undefined,
        req.user?.companyId || undefined
      );
      return res.json({ success: true, metrics });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getResolutionByLevel(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ReportService.getResolutionTimeByLevel();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getEmployeeWorkload(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ReportService.getEmployeeWorkloadReport();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getEscalationReport(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ReportService.getEscalationReport();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getSLASettings(req: AuthenticatedRequest, res: Response) {
    try {
      const configs = await SLAService.getConfigurations();
      return res.json({ success: true, configs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async updateSLASettings(req: AuthenticatedRequest, res: Response) {
    try {
      const { priority, response_time_hours, resolution_time_hours, warning_threshold_percent } = req.body;
      if (!priority || response_time_hours === undefined || resolution_time_hours === undefined) {
        return res.status(400).json({ success: false, error: 'priority, response_time_hours, and resolution_time_hours are required.' });
      }

      await SLAService.updateConfiguration(priority, {
        response_time_hours: Number(response_time_hours),
        resolution_time_hours: Number(resolution_time_hours),
        warning_threshold_percent: warning_threshold_percent ? Number(warning_threshold_percent) : undefined,
      });

      return res.json({ success: true, message: `SLA configuration for ${priority} updated.` });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
