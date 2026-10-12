import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InboundEmailService } from './inbound-email.service';
import { ResolveInboundEmailDto } from './dto/inbound-email.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Inbound Email Engine')
@Controller('inbound-email')
export class InboundEmailController {
  constructor(private readonly inboundEmailService: InboundEmailService) {}

  // -------------------------------------------------------------
  // PUBLIC WEBHOOK INGESTION ENDPOINTS (Secured via header secrets/tokens)
  // -------------------------------------------------------------

  @Post('webhook/generic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generic Inbound Email Webhook' })
  async handleGenericWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.inboundEmailService.processInboundEmail(payload, 'GENERIC', headers);
  }

  @Post('webhook/sendgrid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SendGrid Inbound Parse Webhook' })
  async handleSendGridWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.inboundEmailService.processInboundEmail(payload, 'SENDGRID', headers);
  }

  @Post('webhook/postmark')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Postmark Inbound Webhook' })
  async handlePostmarkWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.inboundEmailService.processInboundEmail(payload, 'POSTMARK', headers);
  }

  @Post('webhook/mailgun')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mailgun Inbound Webhook' })
  async handleMailgunWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.inboundEmailService.processInboundEmail(payload, 'MAILGUN', headers);
  }

  // -------------------------------------------------------------
  // AUTHENTICATED MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------

  @Get('settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get Inbound Email Engine Settings & Metrics' })
  async getSettings() {
    return this.inboundEmailService.getSettings();
  }

  @Put('settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update Inbound Email Engine Settings' })
  async updateSettings(@Body() dto: any) {
    return this.inboundEmailService.updateSettings(dto);
  }

  @Get('logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List Inbound Email Processing Logs' })
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inboundEmailService.getLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      status,
      search,
    });
  }

  @Get('logs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get Single Inbound Email Log' })
  async getLogById(@Param('id') id: string) {
    return this.inboundEmailService.getLogById(parseInt(id, 10));
  }

  @Post('logs/:id/retry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Retry Processing for a Log' })
  async retryLog(@Param('id') id: string, @Req() req: any) {
    return this.inboundEmailService.retryLog(parseInt(id, 10), req.user?.id);
  }

  @Post('logs/:id/resolve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Manually Resolve / Create Ticket from Pending Inbound Email' })
  async resolveLog(
    @Param('id') id: string,
    @Body() dto: ResolveInboundEmailDto,
    @Req() req: any,
  ) {
    return this.inboundEmailService.resolveLogManually(parseInt(id, 10), dto, req.user?.id);
  }

  @Post('test-simulate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Simulate Inbound Email Processing' })
  async simulateEmail(@Body() payload: any) {
    return this.inboundEmailService.processInboundEmail(payload, 'GENERIC', {
      'x-simulation': 'true',
    });
  }
}
