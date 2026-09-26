import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService?: AuditService,
  ) {}

  /**
   * Enterprise Password Policy Validator
   * Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
   */
  validatePasswordPolicy(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required.');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }
    if (password.length > 128) {
      throw new BadRequestException('Password cannot exceed 128 characters.');
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }
  }

  async login(email: string, pass: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: {
        employee: true,
        companyContacts: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let employeeId: string | null = null;
    let companyId: string | null = null;
    let contactId: number | null = null;

    if (user.employee) {
      employeeId = user.employee.id;
    }

    if (user.companyContacts && user.companyContacts.length > 0) {
      companyId = user.companyContacts[0].companyId;
      contactId = user.companyContacts[0].id;
    } else if (user.role === 'CUSTOMER') {
      const contact = await this.prisma.companyContact.findFirst({
        where: { email: user.email },
      });
      if (contact) {
        companyId = contact.companyId;
        contactId = contact.id;
      } else {
        const company = await this.prisma.company.findFirst({
          where: { primaryEmail: user.email },
        });
        if (company) {
          companyId = company.id;
        }
      }
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      companyId,
      contactId,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        employeeId,
        companyId,
        contactId,
        name: user.employee?.name || (user.companyContacts?.[0]?.name ?? (user.role === 'ADMIN' ? 'System Administrator' : user.email)),
      },
    };
  }

  async validateUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true, companyContacts: true },
    });
    if (!user || !user.isActive) return null;

    let companyId = user.companyContacts?.[0]?.companyId || null;
    let contactId = user.companyContacts?.[0]?.id || null;

    if (!companyId && user.role === 'CUSTOMER') {
      const contact = await this.prisma.companyContact.findFirst({
        where: { email: user.email },
      });
      if (contact) {
        companyId = contact.companyId;
        contactId = contact.id;
      } else {
        const company = await this.prisma.company.findFirst({
          where: { primaryEmail: user.email },
        });
        if (company) {
          companyId = company.id;
        }
      }
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id || null,
      companyId,
      contactId,
      name: user.employee?.name || (user.companyContacts?.[0]?.name ?? (user.role === 'ADMIN' ? 'System Administrator' : user.email)),
    };
  }

  /**
   * Self-service password change for all authenticated users.
   */
  async changePassword(params: {
    userId: number;
    currentPassword: string;
    newPassword: string;
    confirmPassword?: string;
    ipAddress?: string;
  }) {
    const { userId, currentPassword, newPassword, confirmPassword, ipAddress } = params;

    if (!currentPassword || currentPassword.trim() === '') {
      throw new BadRequestException('Current password is required.');
    }

    if (!newPassword || newPassword.trim() === '') {
      throw new BadRequestException('New password is required.');
    }

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      throw new BadRequestException('New password and confirm password do not match.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password cannot be the same as your current password.');
    }

    this.validatePasswordPolicy(newPassword);

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: String(userId),
      ipAddress,
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }

  /**
   * Admin-managed password reset for authorized employees/customers.
   */
  async adminResetPassword(params: {
    adminUserId: number;
    targetUserId: number;
    newPassword?: string;
    ipAddress?: string;
  }) {
    const { adminUserId, targetUserId, newPassword, ipAddress } = params;

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employee: true, companyContacts: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`Target user with ID ${targetUserId} not found.`);
    }

    let rawPassword = newPassword;
    let isAutoGenerated = false;

    if (!rawPassword || rawPassword.trim() === '') {
      // Generate a cryptographically secure 12-char temporary password: e.g. "Kp8#vN9$mQ2!"
      const randHex = crypto.randomBytes(4).toString('hex');
      rawPassword = `Kanv@${randHex}!9A`;
      isAutoGenerated = true;
    } else {
      this.validatePasswordPolicy(rawPassword);
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: adminUserId,
      action: 'PASSWORD_RESET_BY_ADMIN',
      entityType: 'USER',
      entityId: String(targetUserId),
      newValues: { targetUserEmail: targetUser.email },
      ipAddress,
    });

    return {
      success: true,
      message: `Password for ${targetUser.email} has been reset successfully.`,
      ...(isAutoGenerated ? { temporaryPassword: rawPassword } : {}),
    };
  }
}
