import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('dashboard') dashboard(@CurrentUser() u: any) { return this.service.getDashboardStats(u.organizationId, u); }
  @Get('group/:id') group(@Param('id') id: string, @CurrentUser('organizationId') o: string, @Query() q: any) { return this.service.getGroupReport(id, o, q); }
  @Get('student/:id') student(@Param('id') id: string, @CurrentUser('organizationId') o: string, @Query() q: any) { return this.service.getStudentReport(id, o, q); }
  @Get('summary') summary(@CurrentUser('organizationId') o: string, @Query() q: any) { return this.service.getSummaryReport(o, q); }
}
