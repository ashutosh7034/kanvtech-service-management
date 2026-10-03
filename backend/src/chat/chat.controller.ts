import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Internal Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private assertNotCustomer(req: any) {
    if (req.user.role === 'CUSTOMER') {
      throw new ForbiddenException('Customers cannot access internal employee chat.');
    }
  }

  @Get('conversations')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get all conversations for the authenticated user' })
  async getConversations(@Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const conversations = await this.chatService.getConversationsForUser(userId);
    return { success: true, conversations };
  }

  @Post('conversations/direct')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Start or retrieve a direct conversation with another employee' })
  async getOrCreateDirect(@Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const myUserId = req.user.id || req.user.userId;
    const targetUserId = Number(body.targetUserId || body.target_user_id);
    if (!targetUserId) throw new ForbiddenException('targetUserId is required.');
    const conversation = await this.chatService.getOrCreateDirectConversation(myUserId, targetUserId);
    return { success: true, conversation };
  }

  @Post('conversations/group')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a group conversation (Admin/Manager only)' })
  async createGroup(@Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const myUserId = req.user.id || req.user.userId;
    const participantIds = (body.participantUserIds || body.participant_user_ids || []).map(Number);
    const conversation = await this.chatService.createGroupConversation(myUserId, participantIds, body.title);
    return { success: true, conversation };
  }

  @Get('conversations/:id/messages')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  async getMessages(@Param('id') id: string, @Query() query: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const messages = await this.chatService.getMessages(Number(id), userId, Number(query.page) || 1, Number(query.limit) || 50);
    return { success: true, messages };
  }

  @Post('conversations/:id/messages')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const message = await this.chatService.sendMessage(Number(id), userId, body.message);
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

  @Get('search/employees')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Search employees to start a conversation with' })
  async searchEmployees(@Query('q') q: string, @Request() req: any) {
    this.assertNotCustomer(req);
    const userId = req.user.id || req.user.userId;
    const results = await this.chatService.searchEmployeesForChat(q || '', userId);
    return { success: true, employees: results };
  }
}
