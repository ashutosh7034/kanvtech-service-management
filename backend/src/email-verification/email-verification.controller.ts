import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Email Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send email verification link to the authenticated user email' })
  async sendVerification(@Body() body: any, @Request() req: any) {
    const userId = req.user.id || req.user.userId;
    const email = body.email || req.user.email;
    const baseUrl = body.baseUrl || req.headers['x-app-base-url'];

    const result = await this.emailVerificationService.sendVerificationEmail(userId, email, baseUrl);
    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      // Only expose previewUrl in non-production (for test capture)
      ...(process.env.NODE_ENV !== 'production' && result.previewUrl
        ? { testVerificationUrl: result.previewUrl }
        : {}),
    };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify email using token received in the verification email' })
  async verifyEmail(@Body() body: any, @Request() req: any) {
    const userId = Number(body.userId || req.user.id || req.user.userId);
    const token = body.token;

    if (!token) {
      return { success: false, error: 'Verification token is required.' };
    }

    await this.emailVerificationService.verifyEmail(userId, token);
    return { success: true, message: 'Email verified successfully.' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Check email verification status for the authenticated user' })
  async getStatus(@Query('email') email: string, @Request() req: any) {
    const userId = req.user.id || req.user.userId;
    const targetEmail = email || req.user.email;
    const status = await this.emailVerificationService.getVerificationStatus(userId, targetEmail);
    return { success: true, ...status };
  }
}
