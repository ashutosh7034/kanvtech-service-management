import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeLevel, EmployeeAvailability, EmployeeStatus, AttendanceStatus, UserRole, TicketStatus } from '@prisma/client';
import { validateEmail, validatePhone, validateOptionalPhone } from '../common/validation.util';
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
    departmentId?: string;
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
    if (params.departmentId) {
      where.departmentId = params.departmentId;
    }
    if (params.department) {
      where.OR = [
        { department: params.department },
        { departmentRel: { name: params.department } },
        { departmentRel: { code: params.department } },
      ];
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
        { departmentRel: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        manager: { select: { id: true, name: true } },
        departmentRel: { select: { id: true, name: true, code: true } },
        assignedTickets: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED', 'CUSTOMER_FEEDBACK', 'MANAGER_REVIEW'] } },
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
      alternate_emails: e.alternateEmails,
      phone: e.phone,
      alternate_phones: e.alternatePhones,
      department: e.departmentRel?.name || e.department,
      department_id: e.departmentId || e.departmentRel?.id || null,
      department_code: e.departmentRel?.code || null,
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
        departmentRel: { select: { id: true, name: true, code: true } },
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
        attendance: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        },
      },
    });

    if (!e) return null;

    const activeCount = await this.prisma.ticket.count({
      where: {
        assignedEmployeeId: id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED', 'CUSTOMER_FEEDBACK', 'MANAGER_REVIEW'] },
      },
    });

    return {
      id: e.id,
      user_id: e.userId,
      name: e.name,
      email: e.email,
      alternate_emails: e.alternateEmails,
      phone: e.phone,
      alternate_phones: e.alternatePhones,
      department: e.departmentRel?.name || e.department,
      department_id: e.departmentId || e.departmentRel?.id || null,
      department_code: e.departmentRel?.code || null,
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
      alternate_emails?: string;
      phone: string;
      alternate_phones?: string;
      department?: string;
      department_id?: string;
      departmentId?: string;
      designation: string;
      level: 'MANAGER' | 'L1' | 'L2' | 'L3';
      manager_id?: string;
      password?: string;
    },
    actorUserId?: number,
  ): Promise<string> {
    const email = validateEmail(data.email, 'Employee email');
    const phone = validatePhone(data.phone, 'Contact phone');
    const name = (data.name || '').trim();
    if (!name) {
      throw new BadRequestException('Employee name is required.');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException(`A user with email ${email} already exists.`);
    }

    // RESOLVE EXACT DEPARTMENT (1 Employee = Exactly 1 Department)
    let deptRecord = null;
    const requestedDeptId = data.department_id || data.departmentId;
    if (requestedDeptId) {
      deptRecord = await this.prisma.department.findUnique({ where: { id: requestedDeptId } });
    } else if (data.department) {
      deptRecord = await this.prisma.department.findFirst({
        where: {
          OR: [
            { name: { equals: data.department.trim(), mode: 'insensitive' } },
            { code: { equals: data.department.trim(), mode: 'insensitive' } },
          ],
        },
      });
    }

    // If no department found and text is provided, fallback or create department for backward compatibility
    let departmentName = data.department ? data.department.trim() : 'General Support';
    let departmentId: string | null = null;

    if (deptRecord) {
      departmentId = deptRecord.id;
      departmentName = deptRecord.name;
    } else if (requestedDeptId) {
      throw new BadRequestException(`Department '${requestedDeptId}' not found.`);
    }

    let role: UserRole = UserRole.L1_EMPLOYEE;
    if (data.level === 'MANAGER') role = UserRole.MANAGER;
    else if (data.level === 'L2') role = UserRole.L2_EMPLOYEE;
    else if (data.level === 'L3') role = UserRole.L3_EMPLOYEE;

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

    // Monotonic collision-safe employee ID generation
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
        name,
        email,
        alternateEmails: data.alternate_emails?.trim() || null,
        phone,
        alternatePhones: data.alternate_phones?.trim() || null,
        department: departmentName,
        departmentId,
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
      newValues: { employeeId, name: data.name, level: data.level, departmentId, department: departmentName },
    });

    return employeeId;
  }

  async updateEmployee(id: string, data: any, actorUserId?: number): Promise<void> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    let departmentName = data.department !== undefined ? data.department.trim() : undefined;
    let departmentId = data.department_id !== undefined ? data.department_id : (data.departmentId !== undefined ? data.departmentId : undefined);

    if (departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
      if (dept) {
        departmentName = dept.name;
      }
    } else if (departmentName) {
      const dept = await this.prisma.department.findFirst({
        where: {
          OR: [
            { name: { equals: departmentName, mode: 'insensitive' } },
            { code: { equals: departmentName, mode: 'insensitive' } },
          ],
        },
      });
      if (dept) {
        departmentId = dept.id;
        departmentName = dept.name;
      }
    }

    const validPhone = data.phone !== undefined ? validatePhone(data.phone, 'Contact phone') : undefined;

    await this.prisma.employee.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        alternateEmails: data.alternate_emails !== undefined ? data.alternate_emails.trim() : undefined,
        phone: validPhone,
        alternatePhones: data.alternate_phones !== undefined ? data.alternate_phones.trim() : undefined,
        department: departmentName,
        departmentId,
        designation: data.designation !== undefined ? data.designation.trim() : undefined,
        level: data.level ? (data.level as EmployeeLevel) : undefined,
        managerId: data.manager_id !== undefined ? data.manager_id : undefined,
        availability: data.availability ? (data.availability as EmployeeAvailability) : undefined,
        status: data.status ? (data.status as EmployeeStatus) : undefined,
      },
    });

    if (data.level) {
      let role: UserRole = UserRole.L1_EMPLOYEE;
      if (data.level === 'MANAGER') role = UserRole.MANAGER;
      else if (data.level === 'L2') role = UserRole.L2_EMPLOYEE;
      else if (data.level === 'L3') role = UserRole.L3_EMPLOYEE;
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

  async promoteEmployee(id: string, targetLevel?: EmployeeLevel, actorUserId?: number) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' } });
    if (setting && setting.settingValue === 'false') {
      throw new BadRequestException('Employee level management is currently disabled by Admin.');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { departmentRel: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    let nextLevel: EmployeeLevel;
    let nextRole: UserRole;
    if (targetLevel) {
      if (['L1', 'L2', 'L3', 'MANAGER'].includes(targetLevel)) {
        nextLevel = targetLevel as EmployeeLevel;
        if (nextLevel === 'MANAGER') nextRole = UserRole.MANAGER;
        else if (nextLevel === 'L3') nextRole = UserRole.L3_EMPLOYEE;
        else if (nextLevel === 'L2') nextRole = UserRole.L2_EMPLOYEE;
        else nextRole = UserRole.L1_EMPLOYEE;
      } else {
        throw new BadRequestException(`Invalid target level '${targetLevel}'.`);
      }
    } else {
      if (existing.level === 'L1') {
        nextLevel = EmployeeLevel.L2;
        nextRole = UserRole.L2_EMPLOYEE;
      } else if (existing.level === 'L2') {
        nextLevel = EmployeeLevel.L3;
        nextRole = UserRole.L3_EMPLOYEE;
      } else if (existing.level === 'L3') {
        nextLevel = EmployeeLevel.MANAGER;
        nextRole = UserRole.MANAGER;
      } else {
        throw new BadRequestException(`Cannot promote employee with current level '${existing.level}'.`);
      }
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        level: nextLevel,
        designation: `${nextLevel} Support Specialist`,
      },
    });

    await this.prisma.user.update({
      where: { id: existing.userId },
      data: { role: nextRole },
    });

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_PROMOTED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { level: existing.level, department: existing.department },
      newValues: { level: nextLevel, department: existing.department, role: nextRole },
    });

    return this.getEmployeeById(id);
  }

  async demoteEmployee(id: string, targetLevel?: EmployeeLevel, actorUserId?: number) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' } });
    if (setting && setting.settingValue === 'false') {
      throw new BadRequestException('Employee level management is currently disabled by Admin.');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { departmentRel: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    let prevLevel: EmployeeLevel;
    let prevRole: UserRole;
    if (targetLevel) {
      if (['L1', 'L2', 'L3', 'MANAGER'].includes(targetLevel)) {
        prevLevel = targetLevel as EmployeeLevel;
        if (prevLevel === 'MANAGER') prevRole = UserRole.MANAGER;
        else if (prevLevel === 'L3') prevRole = UserRole.L3_EMPLOYEE;
        else if (prevLevel === 'L2') prevRole = UserRole.L2_EMPLOYEE;
        else prevRole = UserRole.L1_EMPLOYEE;
      } else {
        throw new BadRequestException(`Invalid target level '${targetLevel}'.`);
      }
    } else {
      if (existing.level === 'MANAGER') {
        prevLevel = EmployeeLevel.L3;
        prevRole = UserRole.L3_EMPLOYEE;
      } else if (existing.level === 'L3') {
        prevLevel = EmployeeLevel.L2;
        prevRole = UserRole.L2_EMPLOYEE;
      } else if (existing.level === 'L2') {
        prevLevel = EmployeeLevel.L1;
        prevRole = UserRole.L1_EMPLOYEE;
      } else {
        throw new BadRequestException(`Cannot demote employee with current level '${existing.level}'.`);
      }
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        level: prevLevel,
        designation: `${prevLevel} Support Specialist`,
      },
    });

    await this.prisma.user.update({
      where: { id: existing.userId },
      data: { role: prevRole },
    });

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_DEMOTED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { level: existing.level, department: existing.department },
      newValues: { level: prevLevel, department: existing.department, role: prevRole },
    });

    return this.getEmployeeById(id);
  }

  async isLevelManagementEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' } });
    return setting ? setting.settingValue === 'true' : true; // Default true
  }

  async toggleLevelManagement(enabled: boolean, actorUserId?: number): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' },
      update: { settingValue: enabled.toString() },
      create: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED', settingValue: enabled.toString() }
    });

    await this.auditService.log({
      actorUserId,
      action: 'SETTINGS_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED',
      newValues: { enabled }
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

  async toggleEmployeeStatus(id: string, actorUserId?: number) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    const newStatus = existing.status === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;
    const newIsActive = newStatus === EmployeeStatus.ACTIVE;

    await this.prisma.employee.update({
      where: { id },
      data: {
        status: newStatus,
        availability: newIsActive ? EmployeeAvailability.AVAILABLE : EmployeeAvailability.OFFLINE,
      },
    });

    if (existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: newIsActive },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_STATUS_TOGGLED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: newStatus },
    });

    return this.getEmployeeById(id);
  }

  async deleteEmployee(id: string, actorUserId?: number) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    const activeTickets = await this.prisma.ticket.count({
      where: {
        assignedEmployeeId: id,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.MANAGER_REVIEW, TicketStatus.CUSTOMER_FEEDBACK] },
      },
    });

    if (activeTickets > 0) {
      throw new BadRequestException(`Cannot deactivate/remove employee '${existing.name}' because they have ${activeTickets} active tickets assigned. Reassign or close tickets first.`);
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        status: EmployeeStatus.INACTIVE,
        availability: EmployeeAvailability.OFFLINE,
      },
    });

    if (existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: false },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_DEACTIVATED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: EmployeeStatus.INACTIVE },
    });

    return { success: true, message: `Employee '${existing.name}' deactivated successfully.` };
  }
}
