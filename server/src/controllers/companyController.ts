import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { CompanyService } from '../services/companyService';

export class CompanyController {
  public static async getCompanies(req: AuthenticatedRequest, res: Response) {
    try {
      const search = req.query.search as string;
      const isActive = req.query.isActive as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      // Role-based scoping: Customer can only view their own organization
      let companyIdFilter: string | undefined = undefined;
      if (req.user?.role === 'CUSTOMER') {
        companyIdFilter = req.user.companyId || 'UNKNOWN';
      }

      const result = await CompanyService.getCompanies({
        search,
        isActive,
        companyId: companyIdFilter,
        page,
        limit,
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Tenant isolation: Customer cannot inspect other organizations
      if (req.user?.role === 'CUSTOMER' && req.user.companyId !== id) {
        return res.status(403).json({ success: false, error: 'Forbidden. Access denied to this company record.' });
      }

      const company = await CompanyService.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ success: false, error: 'Company not found.' });
      }
      return res.json({ success: true, company });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        company_name,
        address,
        gstn,
        primary_email,
        alternate_emails,
        contact_person,
        contact_phone,
        contact_address,
        alternate_contact,
        alternate_contact_phone,
        alternate_contact_email,
        contacts,
      } = req.body;

      if (!company_name || !address || !primary_email || !contact_person || !contact_phone) {
        return res.status(400).json({
          success: false,
          error: 'Required fields missing: company_name, address, primary_email, contact_person, contact_phone.',
        });
      }

      const id = await CompanyService.createCompany(
        {
          company_name,
          address,
          gstn,
          primary_email,
          alternate_emails,
          contact_person,
          contact_phone,
          contact_address,
          alternate_contact,
          alternate_contact_phone,
          alternate_contact_email,
          contacts,
        },
        req.user?.userId
      );

      return res.status(201).json({ success: true, id, companyId: id });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async updateCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await CompanyService.updateCompany(id, req.body, req.user?.userId);
      return res.json({ success: true, message: 'Company updated successfully.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async toggleStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      await CompanyService.toggleCompanyStatus(id, !!isActive, req.user?.userId);
      return res.json({ success: true, message: `Company status updated to ${isActive ? 'ACTIVE' : 'INACTIVE'}.` });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
