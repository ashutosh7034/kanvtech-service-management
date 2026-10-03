import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true';

    if (!host || !user || !pass) {
      // Use Ethereal/test account stub if SMTP not configured
      this.logger.warn('SMTP_HOST, SMTP_USER or SMTP_PASSWORD not configured. Using test transport (emails will NOT be delivered).');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  /**
   * Send verification email.
   * Generates a secure random token, stores hashed version with expiry.
   */
  async sendVerificationEmail(userId: number, email: string, baseUrl?: string): Promise<{ token: string; previewUrl?: string }> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format.');
    }

    // Invalidate any existing unexpired tokens for this user+email
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, email, usedAt: null },
      data: { usedAt: new Date() }, // Mark old tokens as used
    });

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        tokenHash,
        expiresAt,
      },
    });

    const verificationUrl = `${baseUrl || process.env.APP_BASE_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}&userId=${userId}`;

    const transporter = this.createTransporter();
    let previewUrl: string | undefined;
    let deliveryStatus = 'SENT';
    let errorMessage: string | null = null;

    if (!transporter) {
      if (process.env.NODE_ENV === 'production') {
        deliveryStatus = 'FAILED';
        errorMessage = 'SMTP configuration is missing in production environment.';
      } else {
        // Log for local dev/test — no real delivery
        this.logger.log(`[TEST MODE] Verification link for user ${userId} / ${email}: ${verificationUrl}`);
        previewUrl = verificationUrl; // Return the URL so tests can use it
      }
    } else {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Verify your email address — KANVTECH',
          html: `
            <h2>Email Verification</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="${verificationUrl}">Verify Email Address</a></p>
            <p>This link expires in 24 hours.</p>
            <p>If you did not request this, please ignore this email.</p>
          `,
          text: `Verify your email: ${verificationUrl}\nThis link expires in 24 hours.`,
        });
      } catch (err) {
        this.logger.error(`Failed to send verification email to ${email}: ${err.message}`);
        deliveryStatus = 'FAILED';
        errorMessage = err.message;
      }
    }

    await this.prisma.notificationLog.create({
      data: {
        channel: 'EMAIL',
        recipient: email,
        eventType: 'EMAIL_VERIFICATION',
        payloadJson: JSON.stringify({ userId, email }),
        status: deliveryStatus as any,
        errorMessage,
      },
    });

    if (deliveryStatus === 'FAILED') {
      throw new BadRequestException('Failed to send verification email. Please try again later.');
    }

    await this.auditService.log({
      actorUserId: userId,
      action: 'EMAIL_VERIFICATION_SENT',
      entityType: 'USER',
      entityId: String(userId),
      newValues: { email, expiresAt },
    });

    return { token: rawToken, previewUrl };
  }

  /**
   * Verify the token provided by the user.
   */
  async verifyEmail(userId: number, rawToken: string): Promise<void> {
    const records = await this.prisma.emailVerificationToken.findMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let matched: any = null;
    for (const rec of records) {
      const ok = await bcrypt.compare(rawToken, rec.tokenHash);
      if (ok) { matched = rec; break; }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired verification token. Please request a new verification email.');
    }

    // Mark token as used
    await this.prisma.emailVerificationToken.update({
      where: { id: matched.id },
      data: { usedAt: new Date() },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: 'EMAIL_VERIFIED',
      entityType: 'USER',
      entityId: String(userId),
      newValues: { email: matched.email, verifiedAt: new Date() },
    });
  }

  /**
   * Check verification status for a user+email combo.
   */
  async getVerificationStatus(userId: number, email: string): Promise<{ verified: boolean; pendingToken: boolean }> {
    const pending = await this.prisma.emailVerificationToken.findFirst({
      where: { userId, email, usedAt: null, expiresAt: { gt: new Date() } },
    });
    const used = await this.prisma.emailVerificationToken.findFirst({
      where: { userId, email, usedAt: { not: null } },
    });
    return {
      verified: !!used,
      pendingToken: !!pending,
    };
  }
}
