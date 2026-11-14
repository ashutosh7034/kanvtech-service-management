import { Controller, Post, Get, Body, UseGuards, Request, Ip, UnauthorizedException, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlerGuard)
  @ApiOperation({ summary: 'Authenticate user with User ID / email and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful, JWT returned' })
  @ApiResponse({ status: 401, description: 'Invalid User ID / email or password' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async login(
    @Body() body: {
      email?: string;
      userId?: string;
      identifier?: string;
      customUserId?: string;
      password?: string;
      password_hash?: string;
      rememberMe?: boolean;
      selectedTenantId?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = body.identifier || body.userId || body.customUserId || body.email || '';
    const password = body.password || body.password_hash || '';
    const result = await this.authService.login(identifier, password, !!body.rememberMe, body.selectedTenantId);

    if (result && (result as any).token) {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOptions: any = {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      };

      if (body.rememberMe) {
        // 30 days persistent cookie
        cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      res.cookie('kanvtech_token', (result as any).token, cookieOptions);
    }

    return result;
  }

  @Post('switch-tenant')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch company workspace with server-side verified membership' })
  async switchTenant(
    @Request() req: any,
    @Body() body: { tenantId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchTenant(req.user.userId, body.tenantId);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('kanvtech_token', result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return result;
  }

  @Get('my-tenants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of authorized company workspaces for the current user' })
  async getMyTenants(@Request() req: any) {
    const tenants = await this.authService.getMyTenants(req.user.userId);
    return { success: true, tenants };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user, clear authentication cookies and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    let token: string | null = null;
    if (req?.cookies && req.cookies['kanvtech_token']) {
      token = req.cookies['kanvtech_token'];
    } else if (req?.headers?.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)kanvtech_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    } else if (req?.headers?.authorization) {
      token = req.headers.authorization.replace(/^Bearer\s+/i, '');
    }

    if (token) {
      await this.authService.logoutByToken(token);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('kanvtech_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user session details' })
  async me(@Request() req: any) {
    const user = await this.authService.validateUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User session is invalid or inactive');
    }
    const token =
      req?.cookies?.['kanvtech_token'] ||
      (req?.headers?.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : undefined);
    return { success: true, user, token };
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
      adminUserId: req.user.userId || req.user.id,
      adminRole: req.user.role,
      adminTenantId: req.user.tenantId,
      targetUserId: body.userId,
      newPassword: body.newPassword,
      ipAddress: ip,
    });
  }
}
