import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateProductId(): Promise<string> {
    const nextSeq = await this.prisma.getNextSequence('PRODUCT_SEQ');
    return `PROD-${String(nextSeq).padStart(4, '0')}`;
  }

  async getProducts(params: {
    search?: string;
    category?: string;
    isActive?: boolean | string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.isActive !== undefined && params.isActive !== '') {
      where.isActive = String(params.isActive) === 'true';
    }

    if (params.category && params.category !== 'ALL') {
      where.category = params.category;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              subscriptions: true,
              implementations: true,
            },
          },
        },
      }),
    ]);

    const formatted = items.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      description: p.description,
      is_active: p.isActive,
      isActive: p.isActive,
      subscriptions_count: p._count.subscriptions,
      implementations_count: p._count.implementations,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }));

    return {
      data: formatted,
      total,
      page,
      limit,
    };
  }

  async getProductById(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            company: { select: { id: true, companyName: true } },
          },
          take: 10,
        },
        implementations: {
          include: {
            company: { select: { id: true, companyName: true } },
          },
          take: 10,
        },
        _count: {
          select: {
            subscriptions: true,
            implementations: true,
          },
        },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      description: p.description,
      is_active: p.isActive,
      isActive: p.isActive,
      subscriptions_count: p._count.subscriptions,
      implementations_count: p._count.implementations,
      subscriptions: p.subscriptions,
      implementations: p.implementations,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }

  async createProduct(
    data: {
      code?: string;
      productCode?: string;
      product_code?: string;
      name?: string;
      productName?: string;
      product_name?: string;
      category: string;
      description?: string;
      isActive?: boolean;
      is_active?: boolean;
    },
    actorUserId: number,
  ) {
    const name = (data.name || data.productName || data.product_name)?.trim();
    if (!name || !data.category) {
      throw new BadRequestException('Product name and category are required');
    }

    let code = (data.code || data.productCode || data.product_code)?.trim().toUpperCase();
    if (!code) {
      code = `KT-${name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    }

    const existing = await this.prisma.product.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException(`Product with code '${code}' already exists`);
    }

    const id = await this.generateProductId();
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : (data.is_active !== undefined ? Boolean(data.is_active) : true);

    const product = await this.prisma.product.create({
      data: {
        id,
        code,
        name,
        category: data.category.trim(),
        description: data.description?.trim() || null,
        isActive,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'PRODUCT_CREATED',
      entityType: 'PRODUCT',
      entityId: product.id,
      newValues: { id: product.id, code: product.code, name: product.name, category: product.category },
    });

    return {
      id: product.id,
      code: product.code,
      product_code: product.code,
      productCode: product.code,
      name: product.name,
      product_name: product.name,
      productName: product.name,
      category: product.category,
      description: product.description,
      is_active: product.isActive,
      isActive: product.isActive,
    };
  }

  async updateProduct(
    id: string,
    data: {
      code?: string;
      name?: string;
      category?: string;
      description?: string;
      isActive?: boolean;
      is_active?: boolean;
    },
    actorUserId: number,
  ) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.category !== undefined) updateData.category = data.category.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    else if (data.is_active !== undefined) updateData.isActive = Boolean(data.is_active);

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      actorUserId,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: { name: existing.name, category: existing.category, isActive: existing.isActive },
      newValues: updateData,
    });

    return {
      id: updated.id,
      code: updated.code,
      product_code: updated.code,
      productCode: updated.code,
      name: updated.name,
      product_name: updated.name,
      productName: updated.name,
      category: updated.category,
      description: updated.description,
      is_active: updated.isActive,
      isActive: updated.isActive,
    };
  }

  async toggleProductStatus(id: string, isActive: boolean, actorUserId: number) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive },
    });

    await this.auditService.log({
      actorUserId,
      action: 'PRODUCT_STATUS_CHANGED',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive },
    });

    return {
      id: updated.id,
      code: updated.code,
      product_code: updated.code,
      productCode: updated.code,
      name: updated.name,
      product_name: updated.name,
      productName: updated.name,
      category: updated.category,
      description: updated.description,
      is_active: updated.isActive,
      isActive: updated.isActive,
    };
  }

  async getStats() {
    const [total, active, categories] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      categories: categories.map((c) => ({ category: c.category, count: c._count._all })),
    };
  }
}
