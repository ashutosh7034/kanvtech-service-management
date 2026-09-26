import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List companies/customers with filters and pagination' })
  async getCompanies(@Query() query: any, @Request() req: any) {
    let companyId = query.companyId;
    if (req.user.role === 'CUSTOMER') {
      companyId = req.user.companyId;
    }
    const result = await this.companiesService.getCompanies({
      search: query.search,
      isActive: query.isActive,
      companyId,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single company details by ID' })
  async getCompany(@Param('id') id: string, @Request() req: any) {
    if (req.user.role === 'CUSTOMER' && req.user.companyId !== id) {
      return { success: false, error: 'Unauthorized access to company record' };
    }
    const company = await this.companiesService.getCompanyById(id);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    return { success: true, company };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new customer record' })
  async createCompany(@Body() body: any, @Request() req: any) {
    const id = await this.companiesService.createCompany(body, req.user?.id || req.user?.userId);
    return { success: true, companyId: id, id, message: 'Customer created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update existing customer record' })
  async updateCompany(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.companiesService.updateCompany(id, body, req.user?.id || req.user?.userId);
    return { success: true, message: 'Customer updated successfully' };
  }

  @Post(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Toggle customer active/inactive status' })
  async toggleStatus(@Param('id') id: string, @Body() body: { is_active?: boolean; isActive?: boolean }, @Request() req: any) {
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(body.is_active);
    await this.companiesService.toggleCompanyStatus(id, isActive, req.user?.id || req.user?.userId);
    return { success: true, message: 'Customer status updated successfully' };
  }

  // --- Customer Products Endpoints ---

  @Post(':id/products')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add a purchased product to customer' })
  async addProduct(@Param('id') id: string, @Body() body: { productId: string; notes?: string }, @Request() req: any) {
    const result = await this.companiesService.addCompanyProduct(id, body.productId, body.notes, req.user?.id || req.user?.userId);
    return { success: true, product: result, message: 'Product added to customer successfully' };
  }

  @Delete(':id/products/:productId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Remove a purchased product from customer' })
  async removeProduct(@Param('id') id: string, @Param('productId') productId: string, @Request() req: any) {
    await this.companiesService.removeCompanyProduct(id, productId, req.user?.id || req.user?.userId);
    return { success: true, message: 'Product removed from customer successfully' };
  }

  // --- Customer Branches Endpoints ---

  @Get(':id/branches')
  @ApiOperation({ summary: 'Get branches for customer' })
  async getBranches(@Param('id') id: string, @Request() req: any) {
    if (req.user.role === 'CUSTOMER' && req.user.companyId !== id) {
      return { success: false, error: 'Unauthorized access' };
    }
    const branches = await this.companiesService.getCompanyBranches(id);
    return { success: true, branches };
  }

  @Post(':id/branches')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add a new branch to customer' })
  async createBranch(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const branchId = await this.companiesService.createCompanyBranch(id, body, req.user?.id || req.user?.userId);
    return { success: true, branchId, id: branchId, message: 'Branch created successfully' };
  }

  @Get(':id/branches/:branchId')
  @ApiOperation({ summary: 'Get branch details' })
  async getBranch(@Param('id') id: string, @Param('branchId') branchId: string, @Request() req: any) {
    if (req.user.role === 'CUSTOMER' && req.user.companyId !== id) {
      return { success: false, error: 'Unauthorized access' };
    }
    const branch = await this.companiesService.getBranchById(branchId);
    return { success: true, branch };
  }

  @Put(':id/branches/:branchId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update branch details' })
  async updateBranch(@Param('id') id: string, @Param('branchId') branchId: string, @Body() body: any, @Request() req: any) {
    await this.companiesService.updateCompanyBranch(branchId, body, req.user?.id || req.user?.userId);
    return { success: true, message: 'Branch updated successfully' };
  }

  @Patch(':id/branches/:branchId/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Toggle branch status' })
  async toggleBranchStatus(@Param('id') id: string, @Param('branchId') branchId: string, @Body() body: { status: string }, @Request() req: any) {
    await this.companiesService.toggleBranchStatus(branchId, body.status, req.user?.id || req.user?.userId);
    return { success: true, message: 'Branch status updated successfully' };
  }

  @Post(':id/branches/:branchId/products')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Assign products to branch' })
  async assignBranchProducts(@Param('id') id: string, @Param('branchId') branchId: string, @Body() body: { productIds: string[] }, @Request() req: any) {
    await this.companiesService.assignBranchProducts(branchId, body.productIds || [], req.user?.id || req.user?.userId);
    return { success: true, message: 'Branch products assigned successfully' };
  }

  @Delete(':id/branches/:branchId/products/:productId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Remove a product from branch' })
  async removeBranchProduct(@Param('id') id: string, @Param('branchId') branchId: string, @Param('productId') productId: string, @Request() req: any) {
    await this.companiesService.removeBranchProduct(branchId, productId, req.user?.id || req.user?.userId);
    return { success: true, message: 'Product removed from branch' };
  }
}
