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
  @ApiOperation({ summary: 'Download standard Excel template for companies or employees' })
  downloadTemplate(@Param('type') type: string, @Res() res: Response) {
    if (type !== 'companies' && type !== 'employees') {
      throw new BadRequestException("Invalid import type. Expected 'companies' or 'employees'.");
    }
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
    if (type === 'companies') {
      preview = await this.importService.validateCompanyImport(file.buffer);
    } else if (type === 'employees') {
      preview = await this.importService.validateEmployeeImport(file.buffer);
    } else {
      throw new BadRequestException("Invalid import type. Expected 'companies' or 'employees'.");
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

    let result;
    if (type === 'companies') {
      result = await this.importService.commitCompanyImport(body.rows, req.user.userId);
    } else if (type === 'employees') {
      result = await this.importService.commitEmployeeImport(body.rows, req.user.userId);
    } else {
      throw new BadRequestException("Invalid import type. Expected 'companies' or 'employees'.");
    }

    return { success: true, ...result, message: `Successfully committed ${result.importedCount} records.` };
  }
}
