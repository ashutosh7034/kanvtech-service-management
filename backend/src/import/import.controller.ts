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
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { MassUpdateService } from './mass-update.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateMode, MassUpdateCommitPayload } from './mass-update.types';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('import')
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly massUpdateService: MassUpdateService,
  ) {}

  // ===========================================================================
  // MASS UPDATE ENDPOINTS (MODE 2 - Supplementary Updates & Missing Completion)
  // ===========================================================================

  @Get('mass-update/modules')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List supported modules for mass update' })
  getMassUpdateModules() {
    return {
      success: true,
      modules: this.massUpdateService.getSupportedModules(),
    };
  }

  @Get('mass-update/template/:type')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Download supplementary template for mass update' })
  downloadMassUpdateTemplate(@Param('type') type: string, @Res() res: Response) {
    const buffer = this.massUpdateService.generateUpdateTemplate(type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kanvtech_${type}_update_template.xlsx`);
    res.send(buffer);
  }

  @Post('mass-update/parse')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Parse uploaded Excel or CSV document for column detection' })
  parseMassUpdateFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const parsed = this.massUpdateService.parseUploadedFile(file.buffer, file.originalname);
    return { success: true, ...parsed };
  }

  @Post('mass-update/preview/:type')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Preview record matching and proposed field updates' })
  async previewMassUpdate(
    @Param('type') type: string,
    @Body()
    body: {
      rows: any[];
      identifierColumn: string;
      fieldMappings: Record<string, string>;
      updateMode: UpdateMode;
      selectedFields?: string[];
      allowClearValues?: boolean;
    },
    @Request() req: any,
  ) {
    const userTenantId = req.user?.isSuperAdmin ? undefined : (req.user?.tenantId || 'KANVTECH');
    const result = await this.massUpdateService.previewMassUpdate(
      type,
      body,
      userTenantId || 'KANVTECH',
    );
    return { success: true, preview: result };
  }

  @Post('mass-update/commit/:type')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Commit mass update changes to database' })
  async commitMassUpdate(
    @Param('type') type: string,
    @Body() body: MassUpdateCommitPayload,
    @Request() req: any,
  ) {
    const userTenantId = req.user?.isSuperAdmin ? undefined : (req.user?.tenantId || 'KANVTECH');
    const actorUserId = req.user?.userId || req.user?.id;
    const result = await this.massUpdateService.commitMassUpdate(
      type,
      body,
      actorUserId,
      userTenantId || 'KANVTECH',
    );
    return { success: true, ...result };
  }

  @Get('mass-update/history')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Retrieve mass update execution history' })
  async getMassUpdateHistory(@Request() req: any) {
    const userTenantId = req.user?.isSuperAdmin ? undefined : (req.user?.tenantId || 'KANVTECH');
    const history = await this.massUpdateService.getMassUpdateHistory(userTenantId || 'KANVTECH');
    return { success: true, history };
  }

  @Get('mass-update/report/:operationId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Download execution result report for a mass update operation' })
  downloadMassUpdateReport(@Param('operationId') operationId: string, @Res() res: Response) {
    const { buffer, fileName } = this.massUpdateService.generateResultReport(operationId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  }

  // ===========================================================================
  // EXISTING MASS UPLOAD ENDPOINTS (MODE 1 - Create New Records, PRESERVED)
  // ===========================================================================

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
    } else if (normalizedType === 'prospects') {
      preview = await this.importService.validateProspectImport(file.buffer);
    } else if (normalizedType === 'subscriptions') {
      preview = await this.importService.validateSubscriptionImport(file.buffer);
    } else if (normalizedType === 'implementations') {
      preview = await this.importService.validateImplementationImport(file.buffer);
    } else if (normalizedType === 'tickets') {
      preview = await this.importService.validateTicketImport(file.buffer);
    } else if (normalizedType === 'tasks') {
      preview = await this.importService.validateTaskImport(file.buffer);
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

    const userTenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
    if (!userTenantId && !req.user?.isSuperAdmin) {
      throw new ForbiddenException('Authenticated tenant workspace context is required for data import.');
    }
    const rows = body.rows.map((r: any) => ({
      ...r,
      tenantId: userTenantId,
    }));

    let result: { importedCount: number };
    const normalizedType = type.toLowerCase();
    const actorUserId = req.user?.userId || req.user?.id;

    if (normalizedType === 'products') {
      result = await this.importService.commitProductImport(rows, actorUserId);
    } else if (normalizedType === 'departments') {
      result = await this.importService.commitDepartmentImport(rows, actorUserId);
    } else if (normalizedType === 'companies' || normalizedType === 'customers') {
      result = await this.importService.commitCompanyImport(rows, actorUserId);
    } else if (normalizedType === 'employees') {
      result = await this.importService.commitEmployeeImport(rows, actorUserId);
    } else if (normalizedType === 'branches') {
      result = await this.importService.commitBranchImport(rows, actorUserId);
    } else if (normalizedType === 'prospects') {
      result = await this.importService.commitProspectImport(rows, actorUserId);
    } else if (normalizedType === 'subscriptions') {
      result = await this.importService.commitSubscriptionImport(rows, actorUserId);
    } else if (normalizedType === 'implementations') {
      result = await this.importService.commitImplementationImport(rows, actorUserId);
    } else if (normalizedType === 'tickets') {
      result = await this.importService.commitTicketImport(rows, actorUserId);
    } else if (normalizedType === 'tasks') {
      result = await this.importService.commitTaskImport(rows, actorUserId);
    } else {
      throw new BadRequestException(`Unsupported commit type '${type}'`);
    }

    return { success: true, ...result, message: `Successfully committed ${result.importedCount} records.` };
  }

  @Post('dev-reset')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Safely reset demo/staging data (Platform Super Admin only)' })
  async devReset(@Request() req: any) {
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Only Platform Super Administrators are authorized to execute dev data reset.');
    }
    const result = await this.importService.devReset(req.user?.userId || req.user?.id);
    return { success: true, ...result };
  }
}
