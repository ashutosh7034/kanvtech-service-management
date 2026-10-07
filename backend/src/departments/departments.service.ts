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
        products: { include: { product: { select: { id: true, code: true, name: true, category: true } } } },
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

      let specializations: any[] = [];
      if (d.specializationJson) {
        try {
          specializations = JSON.parse(d.specializationJson);
        } catch {
          specializations = [];
        }
      }
      if (!specializations.length) {
        specializations = d.products.map((dp) => ({
          productId: dp.product?.id || (dp as any).productId,
          productName: dp.product?.name,
          productCode: dp.product?.code,
          isComplete: true,
          moduleIds: [],
          submoduleIds: [],
        }));
      }

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        products: d.products.map(dp => dp.product),
        specializations,
        specialization_json: d.specializationJson,
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
        products: { include: { product: true } },
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

    let specializations: any[] = [];
    if (d.specializationJson) {
      try {
        specializations = JSON.parse(d.specializationJson);
      } catch {
        specializations = [];
      }
    }
    if (!specializations.length) {
      specializations = d.products.map((dp) => ({
        productId: dp.product?.id || (dp as any).productId,
        productName: dp.product?.name,
        productCode: dp.product?.code,
        isComplete: true,
        moduleIds: [],
        submoduleIds: [],
      }));
    }

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      products: d.products.map(dp => dp.product),
      specializations,
      specialization_json: d.specializationJson,
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

  async validateAndBuildSpecializations(
    productIds?: string[],
    specializationsInput?: any,
  ): Promise<{ productIds: string[]; specializationJson: string; specializations: any[] }> {
    let rawItems = specializationsInput;
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch {
        rawItems = [];
      }
    }

    const validated: any[] = [];

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (const item of rawItems) {
        if (!item || !item.productId) {
          throw new BadRequestException('Specialization item missing productId.');
        }
        const prod = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            modules: {
              include: {
                submodules: true,
              },
            },
          },
        });
        if (!prod) {
          throw new BadRequestException(`Product '${item.productId}' not found.`);
        }

        const validModuleIds = prod.modules.map((m) => m.id);
        const allValidSubmoduleMap = new Map<string, string>(); // submodId -> modId
        for (const m of prod.modules) {
          for (const s of m.submodules) {
            allValidSubmoduleMap.set(s.id, m.id);
          }
        }

        const itemModuleIds = Array.isArray(item.moduleIds) ? item.moduleIds : [];
        const itemSubmoduleIds = Array.isArray(item.submoduleIds) ? item.submoduleIds : [];

        // Validate moduleIds belong to this product
        for (const mId of itemModuleIds) {
          if (!validModuleIds.includes(mId)) {
            const existsElsewhere = await this.prisma.productModule.findUnique({ where: { id: mId } });
            if (existsElsewhere) {
              throw new BadRequestException(`Module '${mId}' does not belong to product '${prod.name}' (${prod.id}).`);
            } else {
              throw new BadRequestException(`Module '${mId}' not found.`);
            }
          }
        }

        // Validate submoduleIds belong to this product
        for (const sId of itemSubmoduleIds) {
          if (!allValidSubmoduleMap.has(sId)) {
            const existsElsewhere = await this.prisma.productSubmodule.findUnique({ where: { id: sId } });
            if (existsElsewhere) {
              throw new BadRequestException(`Submodule '${sId}' does not belong to product '${prod.name}' (${prod.id}).`);
            } else {
              throw new BadRequestException(`Submodule '${sId}' not found.`);
            }
          }
        }

        const isComplete = Boolean(item.isComplete) || (itemModuleIds.length === 0 && itemSubmoduleIds.length === 0);

        validated.push({
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          isComplete,
          moduleIds: itemModuleIds,
          submoduleIds: itemSubmoduleIds,
        });
      }
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      for (const pid of productIds) {
        const prod = await this.prisma.product.findUnique({ where: { id: pid } });
        if (!prod) {
          throw new BadRequestException(`Product '${pid}' not found.`);
        }
        validated.push({
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          isComplete: true,
          moduleIds: [],
          submoduleIds: [],
        });
      }
    }

    if (validated.length === 0) {
      throw new BadRequestException('At least one valid product specialization must be selected.');
    }

    const uniqueProductIds = Array.from(new Set(validated.map((v) => v.productId)));

    return {
      productIds: uniqueProductIds,
      specializationJson: JSON.stringify(validated),
      specializations: validated,
    };
  }

  async createDepartment(
    data: {
      name: string;
      code: string;
      description?: string;
      productIds?: string[];
      specializations?: any[];
      specializationJson?: string;
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

    const specResult = await this.validateAndBuildSpecializations(
      data.productIds,
      data.specializations || data.specializationJson,
    );

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
        managerId: data.managerId || null,
        specializationJson: specResult.specializationJson,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        products: {
          create: specResult.productIds.map((pid) => ({ productId: pid })),
        },
      },
      include: {
        products: { include: { product: true } },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'DEPARTMENT_CREATED',
      entityType: 'DEPARTMENT',
      entityId: departmentId,
      newValues: {
        id: departmentId,
        name,
        code,
        productIds: specResult.productIds,
        specializations: specResult.specializations,
        managerId: data.managerId,
      },
    });

    return {
      ...department,
      specializations: specResult.specializations,
      specialization_json: specResult.specializationJson,
    };
  }

  async updateDepartment(id: string, data: any, actorUserId?: number) {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!existing) throw new NotFoundException('Department not found');

    const name = data.name !== undefined ? data.name.trim() : undefined;
    const code = data.code !== undefined ? data.code.trim().toUpperCase() : undefined;
    const description = data.description !== undefined ? data.description.trim() : undefined;
    const managerId = data.managerId !== undefined ? (data.managerId || null) : undefined;
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : undefined;

    if (name !== undefined) {
      if (!name) throw new BadRequestException('Department name is required.');
      const duplicateName = await this.prisma.department.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicateName) throw new BadRequestException(`Department '${name}' already exists.`);
    }

    if (code !== undefined) {
      if (!code) throw new BadRequestException('Department code is required.');
      const duplicateCode = await this.prisma.department.findFirst({
        where: { code: { equals: code, mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicateCode) throw new BadRequestException(`Department code '${code}' already exists.`);
    }

    if (managerId) {
      const mgr = await this.prisma.employee.findUnique({ where: { id: managerId } });
      if (!mgr) throw new BadRequestException(`Manager '${managerId}' not found.`);
    }

    let updateData: any = {
      name,
      code,
      description,
      managerId,
      isActive,
    };

    let specResult: { productIds: string[]; specializationJson: string; specializations: any[] } | null = null;
    if (data.specializations !== undefined || data.specializationJson !== undefined || data.productIds !== undefined) {
      specResult = await this.validateAndBuildSpecializations(
        data.productIds,
        data.specializations || data.specializationJson,
      );
      updateData.specializationJson = specResult.specializationJson;
      updateData.products = {
        deleteMany: {},
        create: specResult.productIds.map((pid: string) => ({ productId: pid })),
      };
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        products: { include: { product: true } },
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

    let specializations: any[] = [];
    if (updated.specializationJson) {
      try {
        specializations = JSON.parse(updated.specializationJson);
      } catch {
        specializations = [];
      }
    }

    return {
      ...updated,
      specializations,
      specialization_json: updated.specializationJson,
    };
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
