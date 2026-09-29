import { Controller, Delete, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}
  @Get() findAll(@CurrentUser('organizationId') o: string) { return this.service.findAll(o); }
  @Post() @Roles('admin') create(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.create(dto, o); }
  @Patch(':id') @Roles('admin') update(@Param('id') id: string, @Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.update(id, dto, o); }
  @Delete(':id') @Roles('admin') remove(@Param('id') id: string, @CurrentUser('organizationId') o: string) { return this.service.remove(id, o); }
  @Patch(':id/set-current') @Roles('admin') setCurrent(@Param('id') id: string, @CurrentUser('organizationId') o: string) { return this.service.setCurrent(id, o); }
}
