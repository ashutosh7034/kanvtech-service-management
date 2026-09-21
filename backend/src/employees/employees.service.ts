import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeLevel, EmployeeAvailability, EmployeeStatus, AttendanceStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getEmployees(params: {
    level?: string;
    status?: string;
    availability?: string;
    department?: string;
    search?: string;
  }) {
    const where: any = {};

    if (params.level) {
      where.level = params.level as EmployeeLevel;
    }
    if (params.status) {
      where.status = params.status as EmployeeStatus;
    }
    if (params.availability) {
      where.availability = params.availability as EmployeeAvailability;
    }
    if (params.department) {
      where.department = params.department;
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        manager: { select: { id: true, name: true } },
        assignedTickets: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true },
        },
        attendance: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        },
      },
    });

    return employees.map((e) => ({
      id: e.id,
      user_id: e.userId,
      name: e.name,
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      level: e.level,
      manager_id: e.managerId,
      manager_name: e.manager?.name || null,
      availability: e.availability,
      status: e.status,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      active_ticket_count: e.assignedTickets.length,
      current_attendance_status: e.attendance[0]?.status || null,
    }));
  }

  async getEmployeeById(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true } },
        assignedTickets: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            problemType: true,
            priority: true,
            status: true,
            createdAt: true,
            assignedLevel: true,
            totalResolutionSeconds: true,
          },
        },
      },
    });

    if (!e) return null;

    const activeCount = await this.prisma.ticket.count({
      where: {
        assignedEmployeeId: id,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    return {
      id: e.id,
      user_id: e.userId,
      name: e.name,
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      level: e.level,
      manager_id: e.managerId,
      manager_name: e.manager?.name || null,
      availability: e.availability,
      status: e.status,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      active_ticket_count: activeCount,
      recentTickets: e.assignedTickets.map((t) => ({
        id: t.id,
        problem_type: t.problemType,
        priority: t.priority,
        status: t.status,
        created_at: t.createdAt,
        assigned_level: t.assignedLevel,
        total_resolution_seconds: t.totalResolutionSeconds,
      })),
    };
  }

  async createEmployee(
    data: {
      name: string;
      email: string;
      phone: string;
      department: string;
      designation: string;
      level: 'L1' | 'L2' | 'L3';
      manager_id?: string;
      password?: string;
    },
    actorUserId?: number,
  ): Promise<string> {
    const email = data.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException(`A user with email ${email} already exists.`);
    }

    let role: UserRole = UserRole.L1_EMPLOYEE;
    if (data.level === 'L2') role = UserRole.L2_EMPLOYEE;
    if (data.level === 'L3') role = UserRole.L3_EMPLOYEE;

    const rawPassword =
      data.password && data.password.trim() !== ''
        ? data.password
        : process.env.NODE_ENV === 'production'
          ? crypto.randomBytes(16).toString('hex')
          : 'Password@123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        isActive: true,
      },
    });

    // Monotonic collision-safe employee ID generation (strictly avoid COUNT(*) + 1)
    const allEmps = await this.prisma.employee.findMany({ select: { id: true } });
    let maxNum = 0;
    for (const emp of allEmps) {
      const m = emp.id.match(/^EMP-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('EMPLOYEE_SEQ');
    const safeNum = Math.max(nextSeq, maxNum + 1);
    const employeeId = `EMP-${String(safeNum).padStart(3, '0')}`;

    await this.prisma.employee.create({
      data: {
        id: employeeId,
        userId: user.id,
        name: data.name.trim(),
        email,
        phone: data.phone.trim(),
        department: data.department.trim(),
        designation: data.designation.trim(),
        level: data.level as EmployeeLevel,
        managerId: data.manager_id || null,
        availability: EmployeeAvailability.AVAILABLE,
        status: EmployeeStatus.ACTIVE,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      newValues: { employeeId, name: data.name, level: data.level },
    });

    return employeeId;
  }

  async updateEmployee(id: string, data: any, actorUserId?: number): Promise<void> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    await this.prisma.employee.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        phone: data.phone !== undefined ? data.phone.trim() : undefined,
        department: data.department !== undefined ? data.department.trim() : undefined,
        designation: data.designation !== undefined ? data.designation.trim() : undefined,
        level: data.level ? (data.level as EmployeeLevel) : undefined,
        managerId: data.manager_id !== undefined ? data.manager_id : undefined,
        availability: data.availability ? (data.availability as EmployeeAvailability) : undefined,
        status: data.status ? (data.status as EmployeeStatus) : undefined,
      },
    });

    if (data.level) {
      let role: UserRole = UserRole.L1_EMPLOYEE;
      if (data.level === 'L2') role = UserRole.L2_EMPLOYEE;
      if (data.level === 'L3') role = UserRole.L3_EMPLOYEE;
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { role },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'EMPLOYEE',
      entityId: id,
      newValues: data,
    });
  }

  async checkIn(params: { employeeId: string; lat?: number; lng?: number; address?: string }) {
    const emp = await this.prisma.employee.findUnique({ where: { id: params.employeeId } });
    if (!emp) throw new NotFoundException('Employee not found');

    const att = await this.prisma.employeeAttendance.create({
      data: {
        employeeId: params.employeeId,
        checkInTime: new Date(),
        locationLat: params.lat || null,
        locationLng: params.lng || null,
        locationAddress: params.address || 'Office / Remote',
        status: AttendanceStatus.CHECKED_IN,
      },
    });

    await this.prisma.employee.update({
      where: { id: params.employeeId },
      data: { availability: EmployeeAvailability.AVAILABLE },
    });

    return att;
  }

  async checkOut(params: { employeeId: string; lat?: number; lng?: number; address?: string }) {
    const active = await this.prisma.employeeAttendance.findFirst({
      where: {
        employeeId: params.employeeId,
        status: AttendanceStatus.CHECKED_IN,
      },
      orderBy: { checkInTime: 'desc' },
    });

    if (active) {
      await this.prisma.employeeAttendance.update({
        where: { id: active.id },
        data: {
          checkOutTime: new Date(),
          status: AttendanceStatus.CHECKED_OUT,
        },
      });
    }

    await this.prisma.employee.update({
      where: { id: params.employeeId },
      data: { availability: EmployeeAvailability.OFFLINE },
    });
  }
}
