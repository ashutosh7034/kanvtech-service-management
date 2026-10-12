import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
  Ip,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Data Export & Recovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('modules')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get list of exportable business modules and live record counts' })
  async getExportModules(@Request() req: any) {
    const userRole = req.user?.role || 'MANAGER';
    const summary = await this.exportService.getModulesSummary(userRole);
    return { success: true, ...summary };
  }

  @Get('download')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Export business data in Excel (.xlsx), CSV, or structured JSON backup' })
  @ApiQuery({ name: 'module', required: true, description: 'Module key or "all"' })
  @ApiQuery({ name: 'format', required: true, enum: ['xlsx', 'csv', 'json'] })
  async downloadExport(
    @Query('module') moduleKey: string,
    @Query('format') format: 'xlsx' | 'csv' | 'json',
    @Request() req: any,
    @Res() res: Response,
    @Ip() ip: string,
  ) {
    if (!moduleKey) {
      throw new BadRequestException('Query parameter "module" is required.');
    }
    const cleanFormat = (format || 'xlsx').toLowerCase() as 'xlsx' | 'csv' | 'json';
    if (!['xlsx', 'csv', 'json'].includes(cleanFormat)) {
      throw new BadRequestException('Unsupported format. Allowed formats: "xlsx", "csv", "json".');
    }

    const user = {
      userId: req.user?.userId || req.user?.id || 1,
      role: req.user?.role || 'MANAGER',
      email: req.user?.email || 'admin@kanvtech.com',
    };

    const result = await this.exportService.generateExportFile(moduleKey, cleanFormat, user, ip);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-Total-Records', String(result.totalRecords));
    res.send(result.buffer);
  }

  @Post('backup/preview')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Validate JSON backup and generate dry-run preview before restore' })
  async previewBackupRestore(@UploadedFile() file?: Express.Multer.File, @Body() body?: any) {
    let backupPayload: any = null;

    if (file && file.buffer) {
      try {
        const text = file.buffer.toString('utf-8');
        backupPayload = JSON.parse(text);
      } catch (e: any) {
        throw new BadRequestException('Uploaded file is not a valid JSON document.');
      }
    } else if (body && (body.tables || body.data || body.backupType)) {
      backupPayload = body;
    } else if (body && body.backupPayload) {
      backupPayload = body.backupPayload;
    } else {
      throw new BadRequestException('Please provide a JSON backup file or raw backup payload.');
    }

    const preview = await this.exportService.validateAndPreviewRestore(backupPayload);
    return { success: true, preview };
  }

  @Post('backup/restore')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Commit transactional recovery/restore from validated JSON backup' })
  async restoreBackup(@Body() body: { backupPayload: any; confirmed: boolean }, @Request() req: any, @Ip() ip: string) {
    if (!body || !body.confirmed) {
      throw new BadRequestException('System restore requires explicit confirmation (confirmed: true).');
    }
    if (!body.backupPayload) {
      throw new BadRequestException('Missing backupPayload for restore.');
    }

    const user = {
      userId: req.user?.userId || req.user?.id || 1,
      role: req.user?.role || 'ADMIN',
      email: req.user?.email || 'admin@kanvtech.com',
    };

    const result = await this.exportService.commitRestore(body.backupPayload, user, ip);
    return { success: true, ...result };
  }
}
