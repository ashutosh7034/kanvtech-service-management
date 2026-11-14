import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermissions } from '../permissions/permissions.decorator';
import { EntitlementsService } from './entitlements.service';

@ApiTags('Commercial Entitlements & Licences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('tenant')
  @ApiOperation({ summary: 'Get active tenant commercial entitlement summary' })
  async getTenantEntitlement(@Request() req: any) {
    const summary = await this.entitlementsService.getTenantEntitlement(req.user?.tenantId);
    return { success: true, entitlement: summary };
  }

  @Get('customer/:customerId')
  @RequirePermissions('entitlement.view')
  @ApiOperation({ summary: 'Get commercial entitlement summary for specific customer' })
  async getCustomerEntitlement(@Param('customerId') customerId: string, @Request() req: any) {
    const summary = await this.entitlementsService.getCustomerEntitlement(customerId, req.user?.tenantId);
    return { success: true, entitlement: summary };
  }

  @Get('history')
  @RequirePermissions('entitlement.view_history')
  @ApiOperation({ summary: 'Get append-only entitlement and licence history log' })
  async getHistory(@Query() query: any, @Request() req: any) {
    const history = await this.entitlementsService.getEntitlementHistory({
      customerId: query.customer_id || query.customerId,
      tenantId: req.user?.tenantId,
      licenceCategory: query.category || query.licenceCategory,
      actionType: query.action || query.actionType,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    });
    return { success: true, ...history };
  }

  @Get('customer/:customerId/history')
  @RequirePermissions('entitlement.view_history')
  @ApiOperation({ summary: 'Get append-only entitlement and licence history log for specific customer' })
  async getCustomerHistory(@Param('customerId') customerId: string, @Query() query: any, @Request() req: any) {
    const history = await this.entitlementsService.getEntitlementHistory({
      customerId,
      tenantId: req.user?.tenantId,
      licenceCategory: query.category || query.licenceCategory,
      actionType: query.action || query.actionType,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    });
    return { success: true, ...history };
  }

  @Post(['customer/:customerId/user-licences', 'customer/:customerId/user-licences/increase'])
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('entitlement.add_licences')
  @ApiOperation({ summary: 'Increase User Licences before expiry' })
  async increaseUserLicences(
    @Param('customerId') customerId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const quantity = body.quantity !== undefined ? body.quantity : (body.new_quantity !== undefined ? body.new_quantity : body.newQuantity);
    if (quantity === undefined || isNaN(Number(quantity))) {
      throw new BadRequestException('A valid numerical quantity is required.');
    }
    const actor = {
      id: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.displayName,
      role: req.user?.role,
    };
    const summary = await this.entitlementsService.increaseUserLicences(
      customerId,
      Number(quantity),
      actor,
      req.user?.tenantId,
      body.reason,
    );
    return {
      success: true,
      message: `User Licences updated to ${quantity}.`,
      entitlement: summary,
    };
  }

  @Post(['customer/:customerId/company-licences', 'customer/:customerId/company-licences/increase'])
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('entitlement.add_licences')
  @ApiOperation({ summary: 'Increase Company Licences before expiry' })
  async increaseCompanyLicences(
    @Param('customerId') customerId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const quantity = body.quantity !== undefined ? body.quantity : (body.new_quantity !== undefined ? body.new_quantity : body.newQuantity);
    if (quantity === undefined || isNaN(Number(quantity))) {
      throw new BadRequestException('A valid numerical quantity is required.');
    }
    const actor = {
      id: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.displayName,
      role: req.user?.role,
    };
    const summary = await this.entitlementsService.increaseCompanyLicences(
      customerId,
      Number(quantity),
      actor,
      req.user?.tenantId,
      body.reason,
    );
    return {
      success: true,
      message: `Company Licences updated to ${quantity}.`,
      entitlement: summary,
    };
  }

  @Post('customer/:customerId/renew')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.renew')
  @ApiOperation({ summary: 'Direct subscription renewal and licence extension' })
  async directRenew(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      renewalMonths?: number;
      userLicences?: number;
      companyLicences?: number;
      paymentReference?: string;
      invoiceReference?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    const actor = {
      id: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.displayName,
      role: req.user?.role,
    };
    const summary = await this.entitlementsService.directRenewSubscription(
      customerId,
      body,
      actor,
      req.user?.tenantId,
    );
    return {
      success: true,
      message: 'Subscription successfully renewed. Employee access restored.',
      entitlement: summary,
    };
  }

  @Post('renewal-requests')
  @RequirePermissions('entitlement.request_renewal')
  @ApiOperation({ summary: 'Initiate a subscription renewal request' })
  async createRenewalRequest(@Body() body: any, @Request() req: any) {
    const actor = {
      id: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.displayName,
      role: req.user?.role,
    };
    const result = await this.entitlementsService.requestRenewal(
      {
        customerId: body.customerId || body.customer_id,
        userLicences: body.userLicences !== undefined ? Number(body.userLicences) : undefined,
        companyLicences: body.companyLicences !== undefined ? Number(body.companyLicences) : undefined,
        renewalMonths: body.renewalMonths ? Number(body.renewalMonths) : undefined,
        pricing: body.pricing ? Number(body.pricing) : undefined,
        notes: body.notes,
        paymentReference: body.paymentReference,
        invoiceReference: body.invoiceReference,
      },
      actor,
      req.user?.tenantId,
    );
    return result;
  }

  @Post('renewal-requests/:id/approve')
  @RequirePermissions('subscription.renew')
  @ApiOperation({ summary: 'Approve and execute renewal request' })
  async approveRenewalRequest(@Param('id') id: string, @Request() req: any) {
    const actor = {
      id: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.displayName,
      role: req.user?.role,
    };
    const summary = await this.entitlementsService.approveAndExecuteRenewal(
      id,
      actor,
      req.user?.tenantId,
    );
    return {
      success: true,
      message: 'Renewal request approved and applied. Subscription extended.',
      entitlement: summary,
    };
  }

  @Get('validate/employee')
  @ApiOperation({ summary: 'Pre-validate available User Licence capacity for employee creation' })
  async validateEmployee(@Request() req: any) {
    await this.entitlementsService.validateEmployeeCreationCapacity(req.user?.tenantId);
    return { success: true, message: 'User Licence capacity available.' };
  }

  @Get('validate/company')
  @ApiOperation({ summary: 'Pre-validate available Company Licence capacity for company registration' })
  async validateCompany(@Request() req: any) {
    await this.entitlementsService.validateCompanyCreationCapacity(req.user?.tenantId);
    return { success: true, message: 'Company Licence capacity available.' };
  }
}
