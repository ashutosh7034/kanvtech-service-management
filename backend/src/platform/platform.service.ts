import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService?: AuditService,
  ) {}

  /**
   * Platform-wide overview statistics for Platform Super Admins
   */
  async getOverview() {
    const totalTenants = await this.prisma.tenant.count();
    const activeTenants = await this.prisma.tenant.count({ where: { status: 'ACTIVE' } });
    const suspendedTenants = await this.prisma.tenant.count({ where: { status: 'SUSPENDED' } });
    const totalUsers = await this.prisma.user.count();
    const totalTickets = await this.prisma.ticket.count();
    const totalCompanies = await this.prisma.company.count();

    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            memberships: true,
            tickets: true,
            companies: true,
            employees: true,
          },
        },
      },
    });

    const formattedTenants = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      domain: t.domain,
      status: t.status,
      isDefault: t.isDefault,
      createdAt: t.createdAt.toISOString(),
      userCount: t._count.memberships,
      ticketCount: t._count.tickets,
      companyCount: t._count.companies,
      employeeCount: t._count.employees,
      _count: t._count,
    }));

    const overviewData = {
      platform: 'Kanvtech Service Management',
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalCrossTenantTickets: totalTickets,
      totalTickets,
      totalUsers,
      totalCompanies,
      systemHealth: 'HEALTHY',
      platformVersion: '2.5.0-multitenant',
      serverTimestamp: new Date().toISOString(),
      tenants: formattedTenants,
    };

    return {
      success: true,
      data: overviewData,
      overview: overviewData,
      tenants: formattedTenants,
    };
  }

  /**
   * List all tenants on the platform
   */
  async getAllTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            memberships: true,
            tickets: true,
            companies: true,
            employees: true,
          },
        },
      },
    });

    const formatted = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      domain: t.domain,
      status: t.status,
      isDefault: t.isDefault,
      createdAt: t.createdAt.toISOString(),
      userCount: t._count.memberships,
      ticketCount: t._count.tickets,
      companyCount: t._count.companies,
      employeeCount: t._count.employees,
      _count: t._count,
    }));

    return { success: true, data: formatted, tenants: formatted };
  }

  /**
   * Get single tenant details
   */
  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: true,
            tickets: true,
            companies: true,
            employees: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found.`);
    }

    return { success: true, tenant };
  }

  /**
   * Provision a new tenant company workspace
   */
  async createTenant(
    dto: {
      name: string;
      code: string;
      domain?: string;
      adminEmail: string;
      adminName?: string;
      password?: string;
      adminPassword?: string;
    },
    actorUserId?: number,
  ) {
    const code = (dto.code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!code) {
      throw new BadRequestException('A valid unique tenant code is required.');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Tenant company name is required.');
    }
    if (!dto.adminEmail || !dto.adminEmail.includes('@')) {
      throw new BadRequestException('A valid administrator email is required.');
    }

    const existingCode = await this.prisma.tenant.findUnique({ where: { code } });
    if (existingCode) {
      throw new BadRequestException(`Tenant code "${code}" is already in use.`);
    }

    const tenantId = `TENANT-${code.toUpperCase()}`;
    const normalizedEmail = dto.adminEmail.trim().toLowerCase();
    const rawProvided = (dto.password || (dto as any).adminPassword || '').trim();
    const initialPassword = rawProvided || 'Password@123';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: dto.name.trim(),
          code,
          domain: dto.domain ? dto.domain.trim() : null,
          status: 'ACTIVE',
          isDefault: false,
        },
      });

      // 2. Find or Create Administrator User
      let user = await tx.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            defaultTenantId: tenantId,
          },
        });
      } else {
        // If administrator user already exists, update password to the provisioned password and activate
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            defaultTenantId: user.defaultTenantId || tenantId,
          },
        });
      }

      // 3. Create or Update Tenant Membership for Administrator
      const existingMembership = await tx.tenantMembership.findUnique({
        where: {
          uq_user_tenant: {
            userId: user.id,
            tenantId,
          },
        },
      });

      if (!existingMembership) {
        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId,
            role: 'ADMIN',
            isDefault: true,
            isActive: true,
          },
        });
      } else {
        await tx.tenantMembership.update({
          where: { id: existingMembership.id },
          data: {
            role: 'ADMIN',
            isActive: true,
            isDefault: true,
          },
        });
      }

      // 4. Create Employee record for Admin if not exists
      const existingEmployee = await tx.employee.findFirst({
        where: {
          OR: [
            { userId: user.id },
            { email: { equals: normalizedEmail, mode: 'insensitive' } },
          ],
        },
      });

      if (!existingEmployee) {
        const allEmps = await tx.employee.findMany({ select: { id: true } });
        let maxNum = 0;
        for (const emp of allEmps) {
          const m = emp.id.match(/^EMP-(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
        const empId = `EMP-${String(maxNum + 1).padStart(3, '0')}`;
        await tx.employee.create({
          data: {
            id: empId,
            userId: user.id,
            name: (dto.adminName || '').trim() || 'Tenant Administrator',
            email: normalizedEmail,
            phone: '9999999999',
            department: 'Administration',
            designation: 'Tenant Administrator',
            level: 'MANAGER',
            tenantId,
          },
        });
      }

      return tenant;
    });

    // Audit log tenant creation (Phase 5 requirement)
    if (this.auditService) {
      await this.auditService.log({
        actorUserId: actorUserId || 1,
        action: 'TENANT_PROVISIONED',
        entityType: 'TENANT',
        entityId: tenantId,
        newValues: {
          id: tenantId,
          name: dto.name.trim(),
          code,
          adminEmail: normalizedEmail,
        },
      });
    }

    return {
      success: true,
      message: `Tenant "${dto.name}" provisioned successfully.`,
      tenant: result,
      adminEmail: normalizedEmail,
      initialPassword,
    };
  }

  /**
   * Reset Tenant Administrator password (Super Admin action)
   */
  async resetTenantAdminPassword(tenantId: string, newPassword?: string, actorUserId?: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        memberships: {
          where: { role: 'ADMIN', isActive: true },
          include: { user: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }

    // Find the tenant administrator user
    let adminUser = tenant.memberships[0]?.user;
    if (!adminUser) {
      // Look up any admin membership or employee associated with this tenant
      const fallbackMem = await this.prisma.tenantMembership.findFirst({
        where: { tenantId },
        include: { user: true },
      });
      adminUser = fallbackMem?.user;
    }

    if (!adminUser) {
      throw new NotFoundException(`No administrator user found for tenant "${tenant.name}".`);
    }

    const rawPass = (newPassword || '').trim() || 'Password@123';
    const passwordHash = await bcrypt.hash(rawPass, 10);

    await this.prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash,
        isActive: true,
      },
    });

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: actorUserId || 1,
        action: 'TENANT_ADMIN_PASSWORD_RESET',
        entityType: 'TENANT',
        entityId: tenantId,
        newValues: {
          tenantId,
          adminEmail: adminUser.email,
        },
      });
    }

    return {
      success: true,
      message: `Administrator password for workspace "${tenant.name}" has been reset.`,
      email: adminUser.email,
      temporaryPassword: rawPass,
    };
  }

  /**
   * Update Tenant status (ACTIVE / SUSPENDED)
   */
  async updateTenantStatus(tenantId: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE', actorUserId?: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }

    if (tenant.isDefault && status !== 'ACTIVE') {
      throw new BadRequestException('Cannot suspend or deactivate the default primary platform tenant.');
    }

    const previousStatus = tenant.status;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });

    // Audit log tenant status change (Phase 5 requirement)
    if (this.auditService) {
      await this.auditService.log({
        actorUserId: actorUserId || 1,
        action: 'TENANT_STATUS_CHANGED',
        entityType: 'TENANT',
        entityId: tenantId,
        oldValues: { status: previousStatus },
        newValues: { status },
      });
    }

    return {
      success: true,
      message: `Tenant status updated to ${status}.`,
      tenant: updated,
    };
  }
}
