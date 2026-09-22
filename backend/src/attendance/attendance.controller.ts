import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sheets')
  findSheets(@Query() query: any, @CurrentUser() user: any) {
    return this.attendanceService.findSheets(user.organizationId, user, query);
  }

  @Get('sheets/:id')
  findOneSheet(@Param('id') id: string) {
    return this.attendanceService.findOneSheet(id);
  }

  @Get('sheets/:id/validation')
  getSheetValidation(@Param('id') id: string) {
    return this.attendanceService.getSheetValidation(id);
  }

  @Post('sheets')
  createSheet(@Body() dto: any, @CurrentUser() user: any) {
    return this.attendanceService.createSheet(dto, user);
  }

  @Patch('sheets/:id/submit')
  @HttpCode(HttpStatus.OK)
  submitSheet(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.submitSheet(id, user);
  }

  @Patch('sheets/:id/review')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  reviewSheet(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.reviewSheet(id, user);
  }

  @Patch('sheets/:id/close')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  closeSheet(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.closeSheet(id, user);
  }

  @Patch('records/:sheetId/:studentId')
  updateRecord(
    @Param('sheetId') sheetId: string,
    @Param('studentId') studentId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.updateRecord(sheetId, studentId, dto, user);
  }

  @Post('records/bulk')
  bulkUpdateRecords(
    @Body('sheetId') sheetId: string,
    @Body('updates') updates: any[],
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.bulkUpdateRecords(sheetId, updates, user);
  }
}
