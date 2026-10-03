import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProspectsService } from './prospects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Prospects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prospects')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'List all prospects with optional search and status filter' })
  async getProspects(@Query() query: any) {
    const result = await this.prospectsService.getProspects({
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get prospect by ID' })
  async getProspect(@Param('id') id: string) {
    const prospect = await this.prospectsService.getProspectById(id);
    return { success: true, prospect };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Create a new prospect/enquiry' })
  async createProspect(@Body() body: any, @Request() req: any) {
    const prospect = await this.prospectsService.createProspect({
      companyName: body.companyName || body.company_name,
      contactPerson: body.contactPerson || body.contact_person,
      phone: body.phone,
      email: body.email,
      address: body.address,
      enquiry: body.enquiry,
      source: body.source,
      assignedEmployeeId: body.assignedEmployeeId || body.assigned_employee_id,
      notes: body.notes,
    }, req.user?.id || req.user?.userId);
    return { success: true, prospect, message: 'Prospect created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Update prospect details or status' })
  async updateProspect(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const prospect = await this.prospectsService.updateProspect(id, {
      companyName: body.companyName || body.company_name,
      contactPerson: body.contactPerson || body.contact_person,
      phone: body.phone,
      email: body.email,
      address: body.address,
      enquiry: body.enquiry,
      source: body.source,
      status: body.status,
      assignedEmployeeId: body.assignedEmployeeId || body.assigned_employee_id,
      notes: body.notes,
    }, req.user?.id || req.user?.userId);
    return { success: true, prospect, message: 'Prospect updated successfully' };
  }

  @Post(':id/convert')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Convert prospect to full customer (generates CMP-XXXX)' })
  async convertProspect(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const result = await this.prospectsService.convertProspect(id, {
      address: body.address,
      gstn: body.gstn,
      productIds: body.productIds || body.product_ids || [],
    }, req.user?.id || req.user?.userId);
    return {
      success: true,
      prospect: result.prospect,
      companyId: result.companyId,
      message: `Prospect converted to customer ${result.companyId} successfully`,
    };
  }
}
