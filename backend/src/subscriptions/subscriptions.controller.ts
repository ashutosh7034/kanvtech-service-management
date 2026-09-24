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
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics of maintenance plans and subscriptions' })
  async getStats() {
    const stats = await this.subscriptionsService.getStats();
    return { success: true, stats };
  }

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
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single subscription record by ID' })
  async getSubscription(@Param('id') id: string, @Request() req: any) {
    const sub = await this.subscriptionsService.getSubscriptionById(id);
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
  @ApiOperation({ summary: 'Create a new customer subscription or AMC plan' })
  async createSubscription(@Body() body: any, @Request() req: any) {
    const sub = await this.subscriptionsService.createSubscription(body, req.user.userId);
    return { success: true, subscription: sub, message: 'Subscription plan created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update subscription details' })
  async updateSubscription(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const sub = await this.subscriptionsService.updateSubscription(id, body, req.user.userId);
    return { success: true, subscription: sub, message: 'Subscription updated successfully' };
  }

  @Post(':id/warning')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Send renewal warning notification to customer company contacts' })
  async sendWarning(@Param('id') id: string, @Body() body: { message?: string }, @Request() req: any) {
    const result = await this.subscriptionsService.sendWarning(id, req.user.userId, body?.message);
    return result;
  }

  @Post(':id/renew')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Renew customer subscription with extended expiry date' })
  async renewSubscription(
    @Param('id') id: string,
    @Body() body: { newExpiryDate?: string; new_expiry_date?: string; planName?: string; notes?: string },
    @Request() req: any,
  ) {
    const newExpiryDate = body.newExpiryDate || body.new_expiry_date;
    const sub = await this.subscriptionsService.renewSubscription(
      id,
      { newExpiryDate: newExpiryDate!, planName: body.planName, notes: body.notes },
      req.user.userId,
    );
    return { success: true, subscription: sub, message: 'Subscription renewed successfully' };
  }
}
