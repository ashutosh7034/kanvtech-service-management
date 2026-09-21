import {
  Controller,
  Get,
  Post,
  Put,
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
  @ApiOperation({ summary: 'List companies with filters and pagination' })
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
  @ApiOperation({ summary: 'Create a new company record' })
  async createCompany(@Body() body: any, @Request() req: any) {
    const id = await this.companiesService.createCompany(body, req.user.userId);
    return { success: true, companyId: id, id, message: 'Company created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update existing company record' })
  async updateCompany(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.companiesService.updateCompany(id, body, req.user.userId);
    return { success: true, message: 'Company updated successfully' };
  }

  @Post(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Toggle company active/inactive status' })
  async toggleStatus(@Param('id') id: string, @Body() body: { is_active?: boolean; isActive?: boolean }, @Request() req: any) {
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(body.is_active);
    await this.companiesService.toggleCompanyStatus(id, isActive, req.user.userId);
    return { success: true, message: 'Company status updated successfully' };
  }
}
