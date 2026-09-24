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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary statistics of products' })
  async getStats() {
    const stats = await this.productsService.getStats();
    return { success: true, stats };
  }

  @Get()
  @ApiOperation({ summary: 'List all products with filters and pagination' })
  async getProducts(@Query() query: any) {
    const result = await this.productsService.getProducts({
      search: query.search,
      category: query.category,
      isActive: query.isActive !== undefined ? query.isActive : query.is_active,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single product details by ID' })
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.getProductById(id);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }
    return { success: true, product };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new product' })
  async createProduct(@Body() body: any, @Request() req: any) {
    const product = await this.productsService.createProduct(body, req.user.userId);
    return { success: true, product, productId: product.id, message: 'Product created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update existing product details' })
  async updateProduct(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const product = await this.productsService.updateProduct(id, body, req.user.userId);
    return { success: true, product, message: 'Product updated successfully' };
  }

  @Post(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Toggle product active/inactive status' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() body: { is_active?: boolean; isActive?: boolean },
    @Request() req: any,
  ) {
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(body.is_active);
    const product = await this.productsService.toggleProductStatus(id, isActive, req.user.userId);
    return { success: true, product, message: 'Product status updated successfully' };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a product (Only permitted if not referenced by subscriptions/implementations)' })
  async deleteProduct(@Param('id') id: string, @Request() req: any) {
    const result = await this.productsService.deleteProduct(id, req.user.userId);
    return result;
  }
}
