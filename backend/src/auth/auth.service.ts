import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
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
        name: user.employee?.name || (user.companyContacts?.[0]?.name ?? user.email),
      },
    };
  }

  async validateUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true, companyContacts: true },
    });
    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id || null,
      companyId: user.companyContacts?.[0]?.companyId || null,
      contactId: user.companyContacts?.[0]?.id || null,
      name: user.employee?.name || (user.companyContacts?.[0]?.name ?? user.email),
    };
  }
}
