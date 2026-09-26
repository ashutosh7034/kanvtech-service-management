import { Controller, Post, Get, Body, UseGuards, Request, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(LoginThrottlerGuard)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful, JWT returned' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async login(@Body() body: { email: string; password?: string; password_hash?: string }) {
    const password = body.password || body.password_hash || '';
    return this.authService.login(body.email, password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user session details' })
  async me(@Request() req: any) {
    const user = await this.authService.validateUserById(req.user.userId);
    return { success: true, user };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Self-service password change for authenticated users' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Validation or current password error' })
  async changePassword(
    @Request() req: any,
    @Ip() ip: string,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
      confirmPassword?: string;
    },
  ) {
    return this.authService.changePassword({
      userId: req.user.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      ipAddress: ip,
    });
  }

  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Administrator forced password reset for employee or customer account' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin access required' })
  async adminResetPassword(
    @Request() req: any,
    @Ip() ip: string,
    @Body()
    body: {
      userId: number;
      newPassword?: string;
    },
  ) {
    return this.authService.adminResetPassword({
      adminUserId: req.user.userId,
      targetUserId: body.userId,
      newPassword: body.newPassword,
      ipAddress: ip,
    });
  }
}
