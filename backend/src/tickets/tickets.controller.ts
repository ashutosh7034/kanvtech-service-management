import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { FeedbackService } from '../feedback/feedback.service';
import { EscalationsService } from '../escalations/escalations.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CustomerSanitizerInterceptor } from '../common/interceptors/customer-sanitizer.interceptor';
import { TicketLevel } from '@prisma/client';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CustomerSanitizerInterceptor)
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly approvalsService: ApprovalsService,
    private readonly feedbackService: FeedbackService,
    private readonly escalationsService: EscalationsService,
    private readonly assignmentsService: AssignmentsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  async getTickets(@Query() query: any, @Request() req: any) {
    let companyId = query.companyId;
    let contactId = query.contactId;

    if (req.user.role === 'CUSTOMER') {
      let custCompanyId = req.user.companyId;
      if (!custCompanyId) {
        const contact = await this.ticketsService.findContactForCustomer(req.user.email, req.user.userId || req.user.id);
        custCompanyId = contact?.companyId;
      }
      companyId = custCompanyId || 'NO_COMPANY_ACCESS';
    }

    const result = await this.ticketsService.getTickets({
      status: query.status,
      priority: query.priority,
      level: query.level,
      employeeId: query.employeeId,
      companyId,
      contactId,
      search: query.search,
      slaStatus: query.slaStatus,
      page: query.page,
      limit: query.limit,
    });

    return { success: true, tickets: result.data, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complete ticket details, timeline, timer, and notes' })
  async getTicket(@Param('id') id: string, @Request() req: any) {
    const ticket = await this.ticketsService.getTicketById(id);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (req.user.role === 'CUSTOMER') {
      let custCompanyId = req.user.companyId;
      if (!custCompanyId) {
        const contact = await this.ticketsService.findContactForCustomer(req.user.email, req.user.userId || req.user.id);
        custCompanyId = contact?.companyId;
      }
      if (ticket.company_id !== custCompanyId) {
        throw new ForbiddenException('Unauthorized ticket access');
      }
    }

    return { success: true, ticket };
  }

  @Post()
  @ApiOperation({ summary: 'Open a new support ticket' })
  async createTicket(@Body() body: any, @Request() req: any) {
    const companyId = req.user.role === 'CUSTOMER' ? req.user.companyId : (body.companyId || body.company_id);
    const customerContactId = req.user.role === 'CUSTOMER' ? req.user.contactId : (body.customerContactId || body.customer_contact_id);

    const ticket = await this.ticketsService.createTicket({
      companyId,
      customerContactId: Number(customerContactId),
      productId: body.productId || body.product_id,
      branchId: body.branchId || body.branch_id,
      problemType: body.problemType || body.problem_type,
      priority: body.priority,
      category: body.category,
      description: body.description,
      createdByUserId: req.user?.id || req.user?.userId || 1,
      assignedEmployeeId: body.assignedEmployeeId || body.assigned_employee_id || null,
    });

    return { success: true, ticketId: ticket?.id, id: ticket?.id, ticket, message: 'Ticket created successfully' };
  }

  @Post(':id/assign')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Assign ticket to employee' })
  async assignTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.assignmentsService.assignTicket({
      ticketId: id,
      employeeId: body.employeeId || body.employee_id,
      level: (body.level as TicketLevel) || TicketLevel.L1,
      assignedByUserId: req.user?.id || req.user?.userId || 1,
      assignmentType: body.assignmentType || 'MANUAL',
      notes: body.notes,
    });
    return { success: true, message: 'Ticket assigned successfully' };
  }

  @Post(':id/start')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Start technical work and activate resolution session timer' })
  async startWork(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const employeeId = req.user?.employeeId || body?.employeeId || body?.employee_id;
    await this.ticketsService.startWork(id, employeeId, req.user?.id || req.user?.userId || 1);
    return { success: true, message: 'Resolution work and session timer started' };
  }

  @Post(':id/start-work')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  async startWorkAlias(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.startWork(id, body, req);
  }

  @Post(':id/escalate')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Escalate ticket to higher operational tier' })
  async escalateTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.escalationsService.escalateTicket({
      ticketId: id,
      fromLevel: body.fromLevel || body.from_level,
      toLevel: body.toLevel || body.to_level || body.targetLevel || body.target_level || body.level,
      escalatedByEmployeeId: req.user?.employeeId || body.escalatedByEmployeeId || body.escalated_by_employee_id,
      assignedToEmployeeId: body.assignedToEmployeeId || body.assigned_to_employee_id || body.employeeId || body.employee_id || null,
      reason: body.reason,
      notes: body.notes,
      actorUserId: req.user?.id || req.user?.userId || 1,
    });
    return { success: true, message: 'Ticket successfully escalated' };
  }

  @Post(':id/resolve')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Complete technical work and move ticket to Customer Verification' })
  async resolveTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.approvalsService.submitForReview({
      ticketId: id,
      employeeId: req.user.employeeId || 'EMP-001',
      resolutionNotes: body.resolutionNotes || body.resolution_notes || body.notes || 'Technical resolution completed',
      actorUserId: req.user.userId,
    });
    const resolvedTicket = await this.ticketsService.getTicketById(id);
    return { success: true, ticket: resolvedTicket, message: 'Technical resolution completed. Ticket moved to Customer Verification.' };
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Manager approves technical resolution' })
  async approveTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.approvalsService.approveResolution({
      ticketId: id,
      managerUserId: req.user.userId,
      notes: body.notes,
    });
    return { success: true, message: 'Resolution approved' };
  }

  @Post(':id/reopen')
  @Roles('ADMIN', 'MANAGER', 'CUSTOMER')
  @ApiOperation({ summary: 'Customer or Manager reopens ticket sending back to active support workflow' })
  async reopenTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role === 'CUSTOMER') {
      const ticket = await this.ticketsService.getTicketById(id);
      if (!ticket || ticket.company_id !== req.user.companyId) {
        throw new ForbiddenException('Unauthorized: You can only reopen tickets for your own company');
      }
    }
    await this.approvalsService.reopenResolution({
      ticketId: id,
      userId: req.user.userId,
      reason: body.reason || body.reopenReason || body.reopen_reason || 'Problem is still occurring',
      isCustomer: req.user.role === 'CUSTOMER',
    });
    const reopenedTicket = await this.ticketsService.getTicketById(id);
    return { success: true, ticket: reopenedTicket, message: 'Ticket reopened successfully and returned to support queue' };
  }

  @Post(':id/feedback')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer submits CSAT rating and remarks (auto-closes ticket)' })
  async submitFeedback(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role !== 'CUSTOMER') {
      throw new ForbiddenException('Only the customer associated with this ticket can submit CSAT feedback');
    }
    const ticket = await this.ticketsService.getTicketById(id);
    if (!ticket || ticket.company_id !== req.user.companyId) {
      throw new ForbiddenException('Unauthorized: You can only submit feedback for your own company tickets');
    }
    await this.feedbackService.submitFeedback({
      ticketId: id,
      customerUserId: req.user.userId,
      rating: Number(body.rating),
      remarks: body.remarks,
    });
    const feedbackTicket = await this.ticketsService.getTicketById(id);
    return { success: true, ticket: feedbackTicket, message: 'Feedback submitted and ticket closed' };
  }

  @Post(':id/close')
  @Roles('ADMIN', 'MANAGER', 'CUSTOMER')
  @ApiOperation({ summary: 'Explicit ticket closure by customer, manager or admin' })
  async closeTicket(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role === 'CUSTOMER') {
      const ticket = await this.ticketsService.getTicketById(id);
      if (!ticket || ticket.company_id !== req.user.companyId) {
        throw new ForbiddenException('Unauthorized: You can only close tickets for your own company');
      }
    }
    await this.feedbackService.closeTicket({
      ticketId: id,
      closedByUserId: req.user.userId,
      closureReason:
        body.closureReason ||
        body.closure_reason ||
        (req.user.role === 'CUSTOMER' ? 'Customer confirmed resolution and closed ticket' : 'Manual closure by authorized manager'),
      source: req.user.role === 'CUSTOMER' ? 'FEEDBACK' : 'MANUAL',
    });
    const closedTicket = await this.ticketsService.getTicketById(id);
    return { success: true, ticket: closedTicket, message: 'Ticket successfully closed' };
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add note or communication comment to ticket' })
  async addComment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    let commentType = body.commentType || body.comment_type || 'INTERNAL_NOTE';
    if (req.user.role === 'CUSTOMER') {
      commentType = 'CUSTOMER_COMMUNICATION';
    }

    await this.ticketsService.addComment({
      ticketId: id,
      authorUserId: req.user.userId,
      commentType,
      message: body.message,
    });
    return { success: true, message: 'Comment added' };
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment to ticket' })
  async uploadAttachment(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const uploaded = await this.storageService.upload(file);
    await this.ticketsService.addAttachment({
      ticketId: id,
      fileName: uploaded.fileName,
      filePath: uploaded.filePath,
      fileSize: uploaded.fileSize,
      mimeType: uploaded.mimeType,
      uploadedByUserId: req.user.userId,
    });
    return { success: true, attachment: uploaded };
  }
}
