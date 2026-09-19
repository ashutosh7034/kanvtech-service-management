import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ImportService } from '../services/importService';

export class ImportController {
  public static async downloadTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const type = (req.params.type as 'companies' | 'employees') || 'companies';
      const buffer = ImportService.generateTemplate(type);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="kanvtech_${type}_template.xlsx"`);
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async previewImport(req: AuthenticatedRequest, res: Response) {
    try {
      const type = req.params.type as 'companies' | 'employees';
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'Excel file (.xlsx, .xls, .csv) is required.' });
      }

      let preview;
      if (type === 'companies') {
        preview = await ImportService.validateCompanyImport(file.buffer);
      } else {
        preview = await ImportService.validateEmployeeImport(file.buffer);
      }

      return res.json({ success: true, preview });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async commitImport(req: AuthenticatedRequest, res: Response) {
    try {
      const type = req.params.type as 'companies' | 'employees';
      const { rows } = req.body;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No valid rows provided to commit.' });
      }

      let result;
      if (type === 'companies') {
        result = await ImportService.commitCompanyImport(rows, req.user?.userId);
      } else {
        result = await ImportService.commitEmployeeImport(rows, req.user?.userId);
      }

      return res.json({ success: true, ...result, message: `Successfully imported ${result.importedCount} records.` });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
