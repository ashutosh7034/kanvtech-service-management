import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  EmployeeLevel,
  EmployeeAvailability,
  EmployeeStatus,
  AttendanceStatus,
  UserRole,
  TicketStatus,
} from '@prisma/client';
import { validateEmail, validatePhone, validateOptionalPhone } from '../common/validation.util';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface ActorContext {
  id?: number;
  role?: UserRole | string;
}

function parseActor(actor?: number | ActorContext): { id?: number; role?: UserRole } {
  if (!actor) return {};
  if (typeof actor === 'number') return { id: actor };
  return { id: actor.id, role: actor.role as UserRole };
}

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
        user: { select: { id: true, role: true, isActive: true } },
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

    return employees.map((e) => {
      const isSuperAdmin = e.user?.role === UserRole.ADMIN;
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
        role:
          e.user?.role ||
          (e.level === 'MANAGER'
            ? UserRole.MANAGER
            : e.level === 'L3'
            ? UserRole.L3_EMPLOYEE
            : e.level === 'L2'
            ? UserRole.L2_EMPLOYEE
            : UserRole.L1_EMPLOYEE),
        is_super_admin: isSuperAdmin,
        manager_id: e.managerId,
        manager_name: e.manager?.name || null,
        availability: isSuperAdmin ? EmployeeAvailability.AVAILABLE : e.availability,
        status: e.status,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
        active_ticket_count: e.assignedTickets.length,
        current_attendance_status: isSuperAdmin ? null : (e.attendance[0]?.status || null),
      };
    });
  }

  async getEmployeeById(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, role: true, isActive: true } },
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

    const isSuperAdmin = e.user?.role === UserRole.ADMIN;

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
      role:
        e.user?.role ||
        (e.level === 'MANAGER'
          ? UserRole.MANAGER
          : e.level === 'L3'
          ? UserRole.L3_EMPLOYEE
          : e.level === 'L2'
          ? UserRole.L2_EMPLOYEE
          : UserRole.L1_EMPLOYEE),
      is_super_admin: isSuperAdmin,
      manager_id: e.managerId,
      manager_name: e.manager?.name || null,
      availability: isSuperAdmin ? EmployeeAvailability.AVAILABLE : e.availability,
      status: e.status,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      active_ticket_count: activeCount,
      current_attendance_status: isSuperAdmin ? null : (e.attendance[0]?.status || null),
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
      designation?: string;
      level?: 'MANAGER' | 'L1' | 'L2' | 'L3' | string;
      role?: string;
      manager_id?: string;
      password?: string;
    },
    actor?: number | ActorContext,
  ): Promise<string> {
    const { id: actorUserId, role: actorRole } = parseActor(actor);

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

    let departmentName = data.department ? data.department.trim() : 'General Support';
    let departmentId: string | null = null;

    if (deptRecord) {
      departmentId = deptRecord.id;
      departmentName = deptRecord.name;
    } else if (requestedDeptId) {
      throw new BadRequestException(`Department '${requestedDeptId}' not found.`);
    }

    // Rule 2: Super Admin creation and Manager permissions
    const isCreatingAdmin = data.role === 'ADMIN' || data.role === UserRole.ADMIN;
    const isCreatingManager =
      !isCreatingAdmin &&
      (data.role === 'MANAGER' ||
        data.role === UserRole.MANAGER ||
        data.level === 'MANAGER' ||
        data.level === EmployeeLevel.MANAGER);

    if (isCreatingAdmin) {
      if (actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Only an authorized Super Admin can create another Super Admin account.');
      }
    }

    if (isCreatingManager) {
      if (actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Managers are not permitted to create, promote, or assign the Manager role.');
      }
    }

    let role: UserRole = UserRole.L1_EMPLOYEE;
    let level: EmployeeLevel = EmployeeLevel.L1;

    if (isCreatingAdmin) {
      role = UserRole.ADMIN;
      level = EmployeeLevel.MANAGER;
    } else if (isCreatingManager) {
      role = UserRole.MANAGER;
      level = EmployeeLevel.MANAGER;
    } else if (data.level === 'L3' || data.role === 'L3_EMPLOYEE' || data.role === UserRole.L3_EMPLOYEE) {
      role = UserRole.L3_EMPLOYEE;
      level = EmployeeLevel.L3;
    } else if (data.level === 'L2' || data.role === 'L2_EMPLOYEE' || data.role === UserRole.L2_EMPLOYEE) {
      role = UserRole.L2_EMPLOYEE;
      level = EmployeeLevel.L2;
    } else {
      role = UserRole.L1_EMPLOYEE;
      level = EmployeeLevel.L1;
    }

    const designation =
      data.designation && data.designation.trim() !== ''
        ? data.designation.trim()
        : isCreatingAdmin
        ? 'System Administrator'
        : isCreatingManager
        ? 'Department Operations Manager'
        : `${level} Support Specialist`;

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
        designation,
        level,
        managerId: isCreatingAdmin ? null : (data.manager_id || null),
        availability: EmployeeAvailability.AVAILABLE,
        status: EmployeeStatus.ACTIVE,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: isCreatingAdmin ? 'SUPER_ADMIN_CREATED' : 'EMPLOYEE_CREATED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      newValues: {
        employeeId,
        name: data.name,
        email,
        role,
        level,
        departmentId,
        department: departmentName,
        createdById: actorUserId,
        createdByRole: actorRole,
      },
    });

    if (isCreatingAdmin) {
      await this.auditService.log({
        actorUserId,
        action: 'SUPER_ADMIN_ROLE_GRANTED',
        entityType: 'USER',
        entityId: String(user.id),
        newValues: {
          targetUserId: user.id,
          targetEmail: user.email,
          role: UserRole.ADMIN,
          grantedByUserId: actorUserId,
          grantedByRole: actorRole,
        },
      });
    }

    return employeeId;
  }

  async updateEmployee(id: string, data: any, actor?: number | ActorContext): Promise<void> {
    const { id: actorUserId, role: actorRole } = parseActor(actor);

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    const isTargetAdmin = existing.user?.role === UserRole.ADMIN;
    const isTargetManager =
      existing.user?.role === UserRole.MANAGER || existing.level === EmployeeLevel.MANAGER;

    // 1. Protected System Accounts Security
    if (isTargetAdmin) {
      if (actorRole && actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Managers are not permitted to modify a Super Admin account.');
      }
      // If Super Admin is editing another Super Admin and attempting to revoke ADMIN role
      if (data.role && data.role !== UserRole.ADMIN) {
        const activeAdmins = await this.prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
        if (activeAdmins <= 1) {
          throw new BadRequestException('Cannot revoke Super Admin role from the sole active Super Admin.');
        }
      }
    }

    if (isTargetManager && !isTargetAdmin) {
      if (actorRole && actorRole === UserRole.MANAGER) {
        throw new ForbiddenException('Managers are not permitted to modify other Manager accounts.');
      }
    }

    // 2. Prevent Privilege Escalation
    const requestedElevatedRole =
      data.role === 'ADMIN' ||
      data.role === UserRole.ADMIN ||
      data.role === 'MANAGER' ||
      data.role === UserRole.MANAGER ||
      data.level === 'MANAGER' ||
      data.level === EmployeeLevel.MANAGER;

    if (actorRole && actorRole === UserRole.MANAGER && requestedElevatedRole) {
      throw new ForbiddenException('Managers are not permitted to create, promote, or assign the Manager or Super Admin role.');
    }

    let departmentName = data.department !== undefined ? data.department.trim() : undefined;
    let departmentId =
      data.department_id !== undefined
        ? data.department_id
        : data.departmentId !== undefined
        ? data.departmentId
        : undefined;

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

    let managerIdValue: string | null | undefined = undefined;
    const rawManagerId = data.manager_id !== undefined ? data.manager_id : data.managerId;
    if (rawManagerId !== undefined) {
      if (
        !rawManagerId ||
        typeof rawManagerId !== 'string' ||
        rawManagerId.trim() === '' ||
        rawManagerId.trim() === 'NONE' ||
        rawManagerId.trim() === 'null'
      ) {
        managerIdValue = null;
      } else {
        const cleanedId = rawManagerId.trim();
        if (cleanedId === id) {
          managerIdValue = null;
        } else {
          const mgr = await this.prisma.employee.findUnique({ where: { id: cleanedId } });
          managerIdValue = mgr ? mgr.id : null;
        }
      }
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        alternateEmails:
          data.alternate_emails !== undefined ? data.alternate_emails.trim() || null : undefined,
        phone: validPhone,
        alternatePhones:
          data.alternate_phones !== undefined ? data.alternate_phones.trim() || null : undefined,
        department: departmentName,
        departmentId,
        designation: data.designation !== undefined ? data.designation.trim() : undefined,
        level: data.level ? (data.level as EmployeeLevel) : undefined,
        managerId: managerIdValue,
        availability: isTargetAdmin ? EmployeeAvailability.AVAILABLE : (data.availability ? (data.availability as EmployeeAvailability) : undefined),
        status: data.status ? (data.status as EmployeeStatus) : undefined,
      },
    });

    let targetUserRole: UserRole | undefined = undefined;
    if (data.role === 'ADMIN' || data.role === UserRole.ADMIN) {
      if (actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Only a Super Admin can grant the Super Admin role.');
      }
      targetUserRole = UserRole.ADMIN;
    } else if (
      data.level === 'MANAGER' ||
      data.level === EmployeeLevel.MANAGER ||
      data.role === 'MANAGER' ||
      data.role === UserRole.MANAGER
    ) {
      if (actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Only a Super Admin can assign or promote to the Manager role.');
      }
      targetUserRole = UserRole.MANAGER;
    } else if (data.level === 'L3' || data.role === 'L3_EMPLOYEE' || data.role === UserRole.L3_EMPLOYEE) {
      targetUserRole = UserRole.L3_EMPLOYEE;
    } else if (data.level === 'L2' || data.role === 'L2_EMPLOYEE' || data.role === UserRole.L2_EMPLOYEE) {
      targetUserRole = UserRole.L2_EMPLOYEE;
    } else if (data.level === 'L1' || data.role === 'L1_EMPLOYEE' || data.role === UserRole.L1_EMPLOYEE) {
      targetUserRole = UserRole.L1_EMPLOYEE;
    }

    if (targetUserRole && existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { role: targetUserRole },
      });
      await this.auditService.log({
        actorUserId,
        action: 'ROLE_CHANGED',
        entityType: 'USER',
        entityId: String(existing.userId),
        oldValues: { role: existing.user?.role },
        newValues: { role: targetUserRole, changedByRole: actorRole },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: {
        level: existing.level,
        role: existing.user?.role,
        departmentId: existing.departmentId,
      },
      newValues: {
        ...data,
        targetRole: targetUserRole,
        actingRole: actorRole,
      },
    });
  }

  async promoteEmployee(id: string, targetLevel?: EmployeeLevel, actor?: number | ActorContext) {
    const { id: actorUserId, role: actorRole } = parseActor(actor);
    if (actorRole && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Super Admins are authorized to promote employees.');
    }

    const setting = await this.prisma.systemSetting.findUnique({
      where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' },
    });
    if (setting && setting.settingValue === 'false') {
      throw new BadRequestException('Employee level management is currently disabled by Admin.');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { departmentRel: true, user: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    if (existing.user?.role === UserRole.ADMIN) {
      throw new BadRequestException('Super Admin is the highest system authority and cannot be promoted.');
    }

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
        designation: nextLevel === 'MANAGER' ? 'Department Operations Manager' : `${nextLevel} Support Specialist`,
      },
    });

    if (existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { role: nextRole },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_PROMOTED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { level: existing.level, role: existing.user?.role, department: existing.department },
      newValues: { level: nextLevel, role: nextRole, department: existing.department, promotedByRole: actorRole },
    });

    return this.getEmployeeById(id);
  }

  async demoteEmployee(id: string, targetLevel?: EmployeeLevel, actor?: number | ActorContext) {
    const { id: actorUserId, role: actorRole } = parseActor(actor);
    if (actorRole && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Super Admins are authorized to demote employees.');
    }

    const setting = await this.prisma.systemSetting.findUnique({
      where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' },
    });
    if (setting && setting.settingValue === 'false') {
      throw new BadRequestException('Employee level management is currently disabled by Admin.');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { departmentRel: true, user: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    if (existing.user?.role === UserRole.ADMIN) {
      throw new BadRequestException('Super Admin accounts cannot be demoted.');
    }

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

    if (existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { role: prevRole },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'EMPLOYEE_DEMOTED',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: { level: existing.level, role: existing.user?.role, department: existing.department },
      newValues: { level: prevLevel, role: prevRole, department: existing.department, demotedByRole: actorRole },
    });

    return this.getEmployeeById(id);
  }

  async isLevelManagementEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' },
    });
    return setting ? setting.settingValue === 'true' : true;
  }

  async toggleLevelManagement(enabled: boolean, actorUserId?: number): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED' },
      update: { settingValue: enabled.toString() },
      create: { settingKey: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED', settingValue: enabled.toString() },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SETTINGS_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'EMPLOYEE_LEVEL_MANAGEMENT_ENABLED',
      newValues: { enabled },
    });
  }

  async checkIn(params: { employeeId: string; lat?: number; lng?: number; address?: string }) {
    const emp = await this.prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: { user: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');

    if (emp.user?.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Super Admin accounts are exempt from attendance tracking. No attendance records may be created for Super Admin accounts.',
      );
    }

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
    const emp = await this.prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: { user: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');

    if (emp.user?.role === UserRole.ADMIN) {
      throw new BadRequestException('Super Admin accounts are exempt from attendance tracking.');
    }

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

  async toggleEmployeeStatus(id: string, actor?: number | ActorContext) {
    const { id: actorUserId, role: actorRole } = parseActor(actor);

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    if (existing.user?.role === UserRole.ADMIN) {
      if (actorRole && actorRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Managers cannot alter the status of a Super Admin account.');
      }
      if (existing.status === EmployeeStatus.ACTIVE) {
        const activeAdmins = await this.prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
        if (activeAdmins <= 1) {
          throw new BadRequestException('Cannot deactivate the sole active Super Admin account.');
        }
      }
    }

    if (existing.user?.role === UserRole.MANAGER || existing.level === EmployeeLevel.MANAGER) {
      if (actorRole && actorRole === UserRole.MANAGER) {
        throw new ForbiddenException('Managers cannot alter the status of other Manager accounts.');
      }
    }

    const newStatus = existing.status === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;
    const newIsActive = newStatus === EmployeeStatus.ACTIVE;

    await this.prisma.employee.update({
      where: { id },
      data: {
        status: newStatus,
        availability: existing.user?.role === UserRole.ADMIN
          ? EmployeeAvailability.AVAILABLE
          : newIsActive
          ? EmployeeAvailability.AVAILABLE
          : EmployeeAvailability.OFFLINE,
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
      oldValues: { status: existing.status, role: existing.user?.role },
      newValues: { status: newStatus, changedByRole: actorRole },
    });

    return this.getEmployeeById(id);
  }

  async deleteEmployee(id: string, actor?: number | ActorContext) {
    const { id: actorUserId, role: actorRole } = parseActor(actor);

    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    if (existing.user?.role === UserRole.ADMIN) {
      throw new ForbiddenException('Super Admin accounts cannot be deleted.');
    }

    if (actorRole && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Super Admins can delete employee profiles.');
    }

    const activeTickets = await this.prisma.ticket.count({
      where: {
        assignedEmployeeId: id,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.MANAGER_REVIEW, TicketStatus.CUSTOMER_FEEDBACK] },
      },
    });

    if (activeTickets > 0) {
      throw new BadRequestException(
        `Cannot deactivate/remove employee '${existing.name}' because they have ${activeTickets} active tickets assigned. Reassign or close tickets first.`,
      );
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
      oldValues: { status: existing.status, role: existing.user?.role },
      newValues: { status: EmployeeStatus.INACTIVE, deactivatedByRole: actorRole },
    });

    return { success: true, message: `Employee '${existing.name}' deactivated successfully.` };
  }
}
