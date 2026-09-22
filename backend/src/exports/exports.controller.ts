import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ExportsService } from './exports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get('students')
  async exportStudents(@Query() q: any, @CurrentUser('organizationId') o: string, @Res() res: any) {
    const buffer = await this.service.exportStudents(o, q);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="students.xlsx"' });
    res.send(buffer);
  }

  @Get('attendance')
  async exportAttendance(@Query() q: any, @CurrentUser('organizationId') o: string, @Res() res: any) {
    const buffer = await this.service.exportAttendance(o, q);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="attendance.xlsx"' });
    res.send(buffer);
  }
}
