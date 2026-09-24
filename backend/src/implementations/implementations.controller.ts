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
import { ImplementationsService } from './implementations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Implementations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('implementations')
export class ImplementationsController {
  constructor(private readonly implementationsService: ImplementationsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics of new customer implementations' })
  async getStats() {
    const stats = await this.implementationsService.getStats();
    return { success: true, stats };
  }

  @Get()
  @ApiOperation({ summary: 'List implementations with filters and pagination' })
  async getImplementations(@Query() query: any, @Request() req: any) {
    let companyId = query.companyId;
    if (req.user.role === 'CUSTOMER') {
      companyId = req.user.companyId;
    }
    const result = await this.implementationsService.getImplementations({
      companyId,
      productId: query.productId,
      status: query.status,
      ownerEmployeeId: query.ownerEmployeeId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single implementation details by ID' })
  async getImplementation(@Param('id') id: string, @Request() req: any) {
    const imp = await this.implementationsService.getImplementationById(id);
    if (!imp) {
      return { success: false, error: 'Implementation not found' };
    }
    if (req.user.role === 'CUSTOMER' && imp.company_id !== req.user.companyId) {
      return { success: false, error: 'Unauthorized access to implementation record' };
    }
    return { success: true, implementation: imp };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new customer implementation project' })
  async createImplementation(@Body() body: any, @Request() req: any) {
    const imp = await this.implementationsService.createImplementation(body, req.user.userId);
    return { success: true, implementation: imp, message: 'Implementation project created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Update implementation status, milestones, or team progress' })
  async updateImplementation(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const imp = await this.implementationsService.updateImplementation(id, body, req.user.userId);
    return { success: true, implementation: imp, message: 'Implementation project updated successfully' };
  }
}
