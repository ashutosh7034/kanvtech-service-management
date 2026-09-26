import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('template/:type')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Download standard Excel template for importable entity' })
  downloadTemplate(@Param('type') type: string, @Res() res: Response) {
    const buffer = this.importService.generateTemplate(type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kanvtech_${type}_template.xlsx`);
    res.send(buffer);
  }

  @Post('preview/:type')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Validate uploaded Excel sheet without committing' })
  async previewImport(@Param('type') type: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No Excel file uploaded');

    let preview;
    const normalizedType = type.toLowerCase();
    if (normalizedType === 'products') {
      preview = await this.importService.validateProductImport(file.buffer);
    } else if (normalizedType === 'departments') {
      preview = await this.importService.validateDepartmentImport(file.buffer);
    } else if (normalizedType === 'companies' || normalizedType === 'customers') {
      preview = await this.importService.validateCompanyImport(file.buffer);
    } else if (normalizedType === 'employees') {
      preview = await this.importService.validateEmployeeImport(file.buffer);
    } else if (normalizedType === 'branches') {
      preview = await this.importService.validateBranchImport(file.buffer);
    } else {
      throw new BadRequestException(`Unsupported preview type '${type}'`);
    }

    return { success: true, preview };
  }

  @Post('commit/:type')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Commit validated rows into persistent database' })
  async commitImport(@Param('type') type: string, @Body() body: { rows: any[] }, @Request() req: any) {
    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      throw new BadRequestException('No rows provided for import commit.');
    }

    let result: { importedCount: number };
    const normalizedType = type.toLowerCase();
    const actorUserId = req.user?.userId || req.user?.id;

    if (normalizedType === 'products') {
      result = await this.importService.commitProductImport(body.rows, actorUserId);
    } else if (normalizedType === 'departments') {
      result = await this.importService.commitDepartmentImport(body.rows, actorUserId);
    } else if (normalizedType === 'companies' || normalizedType === 'customers') {
      result = await this.importService.commitCompanyImport(body.rows, actorUserId);
    } else if (normalizedType === 'employees') {
      result = await this.importService.commitEmployeeImport(body.rows, actorUserId);
    } else if (normalizedType === 'branches') {
      result = await this.importService.commitBranchImport(body.rows, actorUserId);
    } else {
      throw new BadRequestException(`Unsupported commit type '${type}'`);
    }

    return { success: true, ...result, message: `Successfully committed ${result.importedCount} records.` };
  }

  @Post('dev-reset')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Safely reset demo/staging data (Development and Staging only)' })
  async devReset(@Request() req: any) {
    const result = await this.importService.devReset(req.user?.userId || req.user?.id);
    return { success: true, ...result };
  }
}

