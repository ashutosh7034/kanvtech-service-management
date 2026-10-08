import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Internal Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly storageService: StorageService,
  ) {}

  private assertNotCustomer(req: any) {
    if (req.user?.role === 'CUSTOMER') {
      throw new ForbiddenException('Customers cannot access internal employee messaging.');
    }
  }

  @Post('upload')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment for internal message' })
  async uploadAttachment(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    this.assertNotCustomer(req);
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const uploaded = await this.storageService.upload(file);
    return { success: true, file: uploaded, attachment: uploaded, data: uploaded };
  }

  @Get('conversations')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get internal message conversations / mailbox folders for the authenticated user' })
  async getConversations(
    @Query('folder') folder: 'inbox' | 'sent' | 'unread',
    @Query('search') search: string,
    @Request() req: any
  ) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const conversations = await this.chatService.getConversationsForUser(userId, { folder, search });
    return { success: true, conversations };
  }

  @Get('conversations/:id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get single message thread with details and full message history' })
  async getConversationDetails(@Param('id') id: string, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const conversation = await this.chatService.getConversationDetails(Number(id), userId);
    return { success: true, conversation };
  }

  @Post('compose')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Compose and send a new internal message (Mailbox style)' })
  async composeMessage(@Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const result = await this.chatService.composeMessage({
      senderUserId: userId,
      toUserIds: body.toUserIds || body.to_user_ids || [],
      ccUserIds: body.ccUserIds || body.cc_user_ids || [],
      subject: body.subject,
      message: body.message,
      attachments: body.attachments || [],
    });
    return result;
  }

  @Post('conversations/:id/reply')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Reply or Reply All to an internal conversation thread' })
  async replyMessage(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const message = await this.chatService.replyMessage({
      conversationId: Number(id),
      senderUserId: userId,
      message: body.message,
      isReplyAll: Boolean(body.isReplyAll ?? body.is_reply_all),
      attachments: body.attachments || [],
    });
    return { success: true, message };
  }

  @Post('conversations/:id/read')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Mark all messages in a conversation as read' })
  async markRead(@Param('id') id: string, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    await this.chatService.markMessagesRead(Number(id), userId);
    return { success: true, message: 'Messages marked as read' };
  }

  @Get('employees')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get active internal employees for recipient selection' })
  async getEmployees(@Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const employees = await this.chatService.getActiveEmployeesForMessaging(userId);
    return { success: true, employees };
  }

  @Get('search/employees')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Search employees for internal messages' })
  async searchEmployees(@Query('q') q: string, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const results = await this.chatService.searchEmployeesForChat(q || '', userId);
    return { success: true, employees: results };
  }

  @Get('conversations/:id/messages')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get messages in a conversation (compat)' })
  async getMessages(@Param('id') id: string, @Query() query: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const messages = await this.chatService.getMessages(Number(id), userId, Number(query.page) || 1, Number(query.limit) || 50);
    return { success: true, messages };
  }

  @Post('conversations/:id/messages')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Send a message in a conversation (compat)' })
  async sendMessage(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const message = await this.chatService.sendMessage(Number(id), userId, body.message);
    return { success: true, message };
  }

  @Post('conversations/direct')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Start or retrieve direct conversation (compat)' })
  async getOrCreateDirect(@Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const myUserId = req.user.id || req.user.userId;
    const targetUserId = Number(body.targetUserId || body.target_user_id);
    if (!targetUserId) throw new ForbiddenException('targetUserId is required.');
    const conversation = await this.chatService.getOrCreateDirectConversation(myUserId, targetUserId);
    return { success: true, conversation };
  }
}

