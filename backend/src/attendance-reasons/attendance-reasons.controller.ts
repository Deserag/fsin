import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AttendanceReasonsService } from './attendance-reasons.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
@Controller('attendance-reasons')
@UseGuards(JwtAuthGuard)
export class AttendanceReasonsController {
  constructor(private readonly service: AttendanceReasonsService) {}
  @Get() findAll(@CurrentUser('organizationId') o: string) { return this.service.findAll(o); }
  @Post() create(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.create(dto, o); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
}
