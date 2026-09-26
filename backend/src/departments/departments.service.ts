import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeLevel, EmployeeStatus, TicketStatus } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getDepartments(params?: { search?: string; isActive?: string | boolean }) {
    const where: any = {};

    if (params?.isActive !== undefined && params?.isActive !== '') {
      where.isActive = params.isActive === '1' || params.isActive === true || params.isActive === 'true';
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const departments = await this.prisma.department.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        product: { select: { id: true, code: true, name: true, category: true } },
        manager: { select: { id: true, name: true, email: true, phone: true } },
        employees: {
          select: {
            id: true,
            level: true,
            status: true,
            assignedTickets: {
              where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED, TicketStatus.CUSTOMER_FEEDBACK, TicketStatus.MANAGER_REVIEW] } },
              select: { id: true },
            },
          },
        },
        tickets: {
          where: { status: { not: TicketStatus.CLOSED } },
          select: { id: true },
        },
      },
    });

    return departments.map((d) => {
      const activeEmployees = d.employees.filter((e) => e.status === EmployeeStatus.ACTIVE);
      const l1Count = activeEmployees.filter((e) => e.level === EmployeeLevel.L1).length;
      const l2Count = activeEmployees.filter((e) => e.level === EmployeeLevel.L2).length;
      const l3Count = activeEmployees.filter((e) => e.level === EmployeeLevel.L3).length;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        product_id: d.productId,
        product_code: d.product?.code || null,
        product_name: d.product?.name || null,
        manager_id: d.managerId,
        manager_name: d.manager?.name || null,
        manager_email: d.manager?.email || null,
        is_active: d.isActive ? 1 : 0,
        isActive: d.isActive,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
        total_employees: d.employees.length,
        active_employees: activeEmployees.length,
        l1_count: l1Count,
        l2_count: l2Count,
        l3_count: l3Count,
        active_tickets_count: d.tickets.length,
      };
    });
  }

  async getDepartmentById(id: string) {
    const d = await this.prisma.department.findUnique({
      where: { id },
      include: {
        product: true,
        manager: true,
        employees: {
          orderBy: [{ level: 'asc' }, { name: 'asc' }],
          include: {
            assignedTickets: {
              where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED, TicketStatus.CUSTOMER_FEEDBACK, TicketStatus.MANAGER_REVIEW] } },
              select: { id: true },
            },
          },
        },
        tickets: {
          where: { status: { not: TicketStatus.CLOSED } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            company: { select: { companyName: true } },
            assignedEmployee: { select: { name: true, level: true } },
          },
        },
      },
    });

    if (!d) return null;

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      product_id: d.productId,
      product: d.product,
      manager_id: d.managerId,
      manager: d.manager,
      is_active: d.isActive ? 1 : 0,
      isActive: d.isActive,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
      employees: d.employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        level: e.level,
        status: e.status,
        availability: e.availability,
        active_workload: e.assignedTickets.length,
      })),
      recentTickets: d.tickets.map((t) => ({
        id: t.id,
        company_name: t.company?.companyName,
        problem_type: t.problemType,
        priority: t.priority,
        status: t.status,
        assigned_employee: t.assignedEmployee?.name,
        assigned_level: t.assignedLevel,
        created_at: t.createdAt,
      })),
    };
  }

  async createDepartment(
    data: {
      name: string;
      code: string;
      description?: string;
      productId?: string;
      managerId?: string;
      isActive?: boolean;
    },
    actorUserId?: number,
  ) {
    const name = (data.name || '').trim();
    const code = (data.code || '').trim().toUpperCase();

    if (!name) {
      throw new BadRequestException('Department name is required.');
    }
    if (!code) {
      throw new BadRequestException('Department code is required.');
    }

    const existingName = await this.prisma.department.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existingName) {
      throw new BadRequestException(`Department '${name}' already exists.`);
    }

    const existingCode = await this.prisma.department.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    if (existingCode) {
      throw new BadRequestException(`Department code '${code}' already exists.`);
    }

    if (data.productId) {
      const prod = await this.prisma.product.findUnique({ where: { id: data.productId } });
      if (!prod) throw new BadRequestException(`Product '${data.productId}' not found.`);

      const existingProdDept = await this.prisma.department.findFirst({
        where: { productId: data.productId },
      });
      if (existingProdDept) {
        throw new BadRequestException(`Product '${prod.name}' is already assigned to department '${existingProdDept.name}'.`);
      }
    }

    if (data.managerId) {
      const mgr = await this.prisma.employee.findUnique({ where: { id: data.managerId } });
      if (!mgr) throw new BadRequestException(`Manager '${data.managerId}' not found.`);
    }

    // Monotonic collision-safe department ID
    const allDepts = await this.prisma.department.findMany({ select: { id: true } });
    let maxNum = 0;
    for (const dep of allDepts) {
      const match = dep.id.match(/^DEP-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('DEPARTMENT_SEQ');
    const safeSeq = Math.max(nextSeq, maxNum + 1);
    const departmentId = `DEP-${String(safeSeq).padStart(4, '0')}`;

    const department = await this.prisma.department.create({
      data: {
        id: departmentId,
        name,
        code,
        description: data.description?.trim() || null,
        productId: data.productId || null,
        managerId: data.managerId || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'DEPARTMENT_CREATED',
      entityType: 'DEPARTMENT',
      entityId: departmentId,
      newValues: { id: departmentId, name, code, productId: data.productId, managerId: data.managerId },
    });

    return department;
  }

  async updateDepartment(id: string, data: any, actorUserId?: number) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');

    const name = data.name !== undefined ? data.name.trim() : undefined;
    const code = data.code !== undefined ? data.code.trim().toUpperCase() : undefined;
    const description = data.description !== undefined ? data.description.trim() : undefined;
    const productId = data.productId !== undefined ? (data.productId || null) : undefined;
    const managerId = data.managerId !== undefined ? (data.managerId || null) : undefined;
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : undefined;

    if (productId) {
      const existingProdDept = await this.prisma.department.findFirst({
        where: { productId, id: { not: id } },
      });
      if (existingProdDept) {
        throw new BadRequestException(`Product is already assigned to department '${existingProdDept.name}'.`);
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        name,
        code,
        description,
        productId,
        managerId,
        isActive,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'DEPARTMENT',
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    return updated;
  }

  async toggleDepartmentStatus(id: string, isActive: boolean, actorUserId?: number) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');

    const updated = await this.prisma.department.update({
      where: { id },
      data: { isActive },
    });

    await this.auditService.log({
      actorUserId,
      action: isActive ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
      entityType: 'DEPARTMENT',
      entityId: id,
    });

    return updated;
  }

  async getDepartmentEmployees(departmentId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');

    const employees = await this.prisma.employee.findMany({
      where: { departmentId, status: EmployeeStatus.ACTIVE },
      include: {
        assignedTickets: {
          where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED, TicketStatus.CUSTOMER_FEEDBACK, TicketStatus.MANAGER_REVIEW] } },
          select: { id: true },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      designation: e.designation,
      level: e.level,
      status: e.status,
      availability: e.availability,
      active_workload: e.assignedTickets.length,
    }));
  }
}
