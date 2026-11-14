import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../permissions/permissions.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary statistics of products' })
  async getStats(@Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const stats = await this.productsService.getStats(tenantId);
    return { success: true, stats };
  }

  @Get()
  @ApiOperation({ summary: 'List all products with filters and pagination' })
  async getProducts(@Query() query: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin && query.tenantId ? query.tenantId : req.user.tenantId || 'KANVTECH';
    const result = await this.productsService.getProducts({
      search: query.search,
      category: query.category,
      isActive: query.isActive !== undefined ? query.isActive : query.is_active,
      page: query.page,
      limit: query.limit,
      tenantId,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single product details by ID' })
  async getProduct(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const product = await this.productsService.getProductById(id, tenantId);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }
    return { success: true, product };
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @RequirePermissions('product.create')
  @ApiOperation({ summary: 'Create a new product' })
  async createProduct(@Body() body: any, @Request() req: any) {
    const tenantId = req.user.tenantId || req.user.defaultTenantId || 'KANVTECH';
    if (!tenantId) {
      throw new ForbiddenException('Authenticated tenant workspace context is required to create products.');
    }
    const product = await this.productsService.createProduct({ ...body, tenantId }, req.user.userId || req.user.id || 1);
    return { success: true, id: product.id, productId: product.id, product, message: 'Product created successfully' };
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @RequirePermissions('product.update')
  @ApiOperation({ summary: 'Update existing product details' })
  async updateProduct(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const product = await this.productsService.updateProduct(id, body, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, product, message: 'Product updated successfully' };
  }

  @Post(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @RequirePermissions('product.update')
  @ApiOperation({ summary: 'Toggle product active/inactive status' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() body: { is_active?: boolean; isActive?: boolean },
    @Request() req: any,
  ) {
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(body.is_active);
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const product = await this.productsService.toggleProductStatus(id, isActive, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, product, message: 'Product status updated successfully' };
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'PLATFORM_INCHARGE')
  @RequirePermissions('product.delete')
  @ApiOperation({ summary: 'Delete a product' })
  async deleteProduct(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const result = await this.productsService.deleteProduct(id, req.user.userId || req.user.id || 1, tenantId);
    return result;
  }

  // --- Module Endpoints ---

  @Get(':id/modules')
  @ApiOperation({ summary: 'Get all modules for a product' })
  async getModules(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const result = await this.productsService.getModules(id, tenantId);
    return { success: true, ...result };
  }

  @Post(':id/modules')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Create a module for a product' })
  async createModule(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const module = await this.productsService.createModule(id, body, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, module, message: 'Module created successfully' };
  }

  @Put('modules/:moduleId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Update a module' })
  async updateModule(@Param('moduleId') moduleId: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const module = await this.productsService.updateModule(moduleId, body, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, module, message: 'Module updated successfully' };
  }

  @Delete('modules/:moduleId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Delete a module and its submodules' })
  async deleteModule(@Param('moduleId') moduleId: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const result = await this.productsService.deleteModule(moduleId, req.user.userId || req.user.id || 1, tenantId);
    return result;
  }

  // --- Submodule Endpoints ---

  @Post('modules/:moduleId/submodules')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Create a submodule' })
  async createSubmodule(@Param('moduleId') moduleId: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const submodule = await this.productsService.createSubmodule(moduleId, body, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, submodule, message: 'Submodule created successfully' };
  }

  @Put('submodules/:submoduleId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Update a submodule' })
  async updateSubmodule(@Param('submoduleId') submoduleId: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const submodule = await this.productsService.updateSubmodule(submoduleId, body, req.user.userId || req.user.id || 1, tenantId);
    return { success: true, submodule, message: 'Submodule updated successfully' };
  }

  @Delete('submodules/:submoduleId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PLATFORM_INCHARGE')
  @ApiOperation({ summary: 'Delete a submodule' })
  async deleteSubmodule(@Param('submoduleId') submoduleId: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const result = await this.productsService.deleteSubmodule(submoduleId, req.user.userId || req.user.id || 1, tenantId);
    return result;
  }
}
