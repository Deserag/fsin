import { Controller, Get, Post, Body, Param, UseGuards, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('template')
  async getTemplate(@Res() res: any) {
    const buffer = await this.service.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="students-template.xlsx"',
    });
    res.send(Buffer.from(buffer as ArrayBuffer));
  }

  @Post('students/parse')
  @UseInterceptors(FileInterceptor('file'))
  parseExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser('organizationId') o: string, @CurrentUser('id') u: string) {
    if (!file) throw new Error('Файл не загружен');
    return this.service.parseExcel(file.buffer, o, u);
  }

  @Post('students/mapping')
  setMapping(@Body('jobId') jobId: string, @Body('mapping') mapping: Record<string, string>) {
    return this.service.setColumnMapping(jobId, mapping);
  }

  @Post('students/validate')
  validate(@Body('jobId') jobId: string, @CurrentUser('organizationId') o: string) {
    return this.service.validate(jobId, o);
  }

  @Post('students/confirm')
  confirm(@Body('jobId') jobId: string, @CurrentUser('organizationId') o: string, @CurrentUser('id') u: string) {
    return this.service.confirm(jobId, o, u);
  }

  @Get(':id')
  getJob(@Param('id') id: string) { return this.service.getJob(id); }
}
