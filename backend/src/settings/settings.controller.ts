import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get() findAll(@CurrentUser('organizationId') o: string) { return this.service.findAll(o); }
  @Patch(':key') @Roles('admin') update(@Param('key') key: string, @Body('value') value: string, @CurrentUser('organizationId') o: string) { return this.service.update(o, key, value); }

  @Get('student-statuses') getStatuses(@CurrentUser('organizationId') o: string) { return this.service.getStudentStatuses(o); }
  @Post('student-statuses') @Roles('admin') createStatus(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.createStudentStatus(o, dto); }

  @Get('attendance-periods') getPeriods(@CurrentUser('organizationId') o: string) { return this.service.getAttendancePeriods(o); }
  @Post('attendance-periods') @Roles('admin') createPeriod(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.createAttendancePeriod(o, dto); }

  @Get('attendance-fields') getFields(@CurrentUser('organizationId') o: string) { return this.service.getAttendanceFields(o); }
  @Post('attendance-fields') @Roles('admin') createField(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.createAttendanceField(o, dto); }
  @Patch('attendance-fields/:id') @Roles('admin') updateField(@Param('id') id: string, @Body() dto: any) { return this.service.updateAttendanceField(id, dto); }
}
