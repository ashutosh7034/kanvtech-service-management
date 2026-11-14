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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../permissions/permissions.decorator';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics of maintenance plans and subscriptions' })
  async getStats(@Request() req: any) {
    const stats = await this.subscriptionsService.getStats(req.user?.tenantId);
    return { success: true, stats };
  }

  // --- AMC Plan Management Endpoints ---

  @Get('plans')
  @ApiOperation({ summary: 'List AMC policy plans for active tenant' })
  async getPlans(@Request() req: any) {
    const plans = await this.subscriptionsService.getAmcPlans(req.user?.tenantId);
    return { success: true, data: plans };
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get AMC plan details by ID' })
  async getPlan(@Param('id') id: string, @Request() req: any) {
    const plan = await this.subscriptionsService.getAmcPlanById(id, req.user?.tenantId);
    if (!plan) throw new NotFoundException('AMC plan not found');
    return { success: true, plan };
  }

  @Post('plans')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.manage_plans')
  @ApiOperation({ summary: 'Create a new AMC plan template' })
  async createPlan(@Body() body: any, @Request() req: any) {
    const plan = await this.subscriptionsService.createAmcPlan(body, req.user.userId, req.user?.tenantId);
    return { success: true, plan, message: 'AMC plan created successfully' };
  }

  @Put('plans/:id')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.manage_plans')
  @ApiOperation({ summary: 'Update an existing AMC plan template' })
  async updatePlan(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const plan = await this.subscriptionsService.updateAmcPlan(id, body, req.user.userId, req.user?.tenantId);
    return { success: true, plan, message: 'AMC plan updated successfully' };
  }

  @Post('plans/:id/duplicate')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.manage_plans')
  @ApiOperation({ summary: 'Duplicate an existing AMC plan' })
  async duplicatePlan(@Param('id') id: string, @Request() req: any) {
    const plan = await this.subscriptionsService.duplicateAmcPlan(id, req.user.userId, req.user?.tenantId);
    return { success: true, plan, message: 'AMC plan duplicated successfully' };
  }

  @Patch('plans/:id/toggle')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.manage_plans')
  @ApiOperation({ summary: 'Toggle active status of an AMC plan' })
  async togglePlan(@Param('id') id: string, @Request() req: any) {
    const plan = await this.subscriptionsService.toggleAmcPlanStatus(id, req.user.userId, req.user?.tenantId);
    return { success: true, plan, message: 'AMC plan status updated successfully' };
  }

  @Delete('plans/:id')
  @Roles('ADMIN')
  @RequirePermissions('amc.manage_plans')
  @ApiOperation({ summary: 'Delete an AMC plan' })
  async deletePlan(@Param('id') id: string, @Request() req: any) {
    return this.subscriptionsService.deleteAmcPlan(id, req.user.userId, req.user?.tenantId);
  }

  // --- Subscriptions / Contracts Endpoints ---

  @Get()
  @ApiOperation({ summary: 'List subscriptions with filters and pagination' })
  async getSubscriptions(@Query() query: any, @Request() req: any) {
    let companyId = query.companyId;
    if (req.user.role === 'CUSTOMER') {
      companyId = req.user.companyId;
    }
    const result = await this.subscriptionsService.getSubscriptions({
      companyId,
      productId: query.productId,
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
      tenantId: req.user?.tenantId,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single subscription record by ID' })
  async getSubscription(@Param('id') id: string, @Request() req: any) {
    const sub = await this.subscriptionsService.getSubscriptionById(id, req.user?.tenantId);
    if (!sub) {
      return { success: false, error: 'Subscription not found' };
    }
    if (req.user.role === 'CUSTOMER' && sub.company_id !== req.user.companyId) {
      return { success: false, error: 'Unauthorized access to subscription' };
    }
    return { success: true, subscription: sub };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.create')
  @ApiOperation({ summary: 'Create a new customer subscription or AMC contract' })
  async createSubscription(@Body() body: any, @Request() req: any) {
    const sub = await this.subscriptionsService.createSubscription(body, req.user.userId, req.user?.tenantId);
    return { success: true, subscription: sub, message: 'AMC Contract created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.update')
  @ApiOperation({ summary: 'Update subscription details' })
  async updateSubscription(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const sub = await this.subscriptionsService.updateSubscription(id, body, req.user.userId, req.user?.tenantId);
    return { success: true, subscription: sub, message: 'Subscription updated successfully' };
  }

  @Post(':id/warning')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Send renewal warning notification to customer company contacts' })
  async sendWarning(@Param('id') id: string, @Body() body: { message?: string; notes?: string }, @Request() req: any) {
    const result = await this.subscriptionsService.sendWarning(id, req.user.userId, body?.message || body?.notes, req.user?.tenantId);
    return result;
  }

  @Post(':id/renew')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('amc.renew')
  @ApiOperation({ summary: 'Renew customer subscription with extended expiry date' })
  async renewSubscription(
    @Param('id') id: string,
    @Body() body: {
      newExpiryDate?: string;
      new_expiry_date?: string;
      planName?: string;
      notes?: string;
      amount?: number;
      poNumber?: string;
    },
    @Request() req: any,
  ) {
    const newExpiryDate = body.newExpiryDate || body.new_expiry_date;
    const sub = await this.subscriptionsService.renewSubscription(
      id,
      {
        newExpiryDate: newExpiryDate!,
        planName: body.planName,
        notes: body.notes,
        amount: body.amount,
        poNumber: body.poNumber,
      },
      req.user.userId,
      req.user?.tenantId,
    );
    return { success: true, subscription: sub, message: 'Subscription renewed successfully' };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('amc.delete')
  @ApiOperation({ summary: 'Delete customer subscription' })
  async deleteSubscription(@Param('id') id: string, @Request() req: any) {
    return this.subscriptionsService.deleteSubscription(id, req.user.userId, req.user?.tenantId);
  }
}
