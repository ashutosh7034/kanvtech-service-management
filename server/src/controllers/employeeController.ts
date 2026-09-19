import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { EmployeeService } from '../services/employeeService';

export class EmployeeController {
  public static async getEmployees(req: AuthenticatedRequest, res: Response) {
    try {
      const { level, status, availability, department, search } = req.query;
      const employees = await EmployeeService.getEmployees({
        level: level as string,
        status: status as string,
        availability: availability as string,
        department: department as string,
        search: search as string,
      });
      return res.json({ success: true, data: employees });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getEmployee(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getEmployeeById(id);
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }
      return res.json({ success: true, employee });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createEmployee(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, email, phone, department, designation, level, manager_id, password } = req.body;
      if (!name || !email || !phone || !department || !designation || !level) {
        return res.status(400).json({
          success: false,
          error: 'Required fields missing: name, email, phone, department, designation, level.',
        });
      }

      const id = await EmployeeService.createEmployee(
        { name, email, phone, department, designation, level, manager_id, password },
        req.user?.userId
      );

      return res.status(201).json({ success: true, employeeId: id });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async updateEmployee(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await EmployeeService.updateEmployee(id, req.body, req.user?.userId);
      return res.json({ success: true, message: 'Employee updated successfully.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async checkIn(req: AuthenticatedRequest, res: Response) {
    try {
      const employeeId = req.user?.employeeId || (req.body.employeeId as string);
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      const { lat, lng, address } = req.body;
      const attendance = await EmployeeService.checkIn({ employeeId, lat, lng, address });
      return res.json({ success: true, attendance, message: 'Checked in successfully.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async checkOut(req: AuthenticatedRequest, res: Response) {
    try {
      const employeeId = req.user?.employeeId || (req.body.employeeId as string);
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      const { lat, lng, address } = req.body;
      await EmployeeService.checkOut({ employeeId, lat, lng, address });
      return res.json({ success: true, message: 'Checked out successfully.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
