import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DirectionsService } from './directions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('directions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DirectionsController {
  constructor(private readonly service: DirectionsService) {}
  @Get() findAll(@Query() q: any, @CurrentUser('organizationId') o: string) { return this.service.findAll(o, q); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('organizationId') o: string) { return this.service.findOne(id, o); }
  @Post() @Roles('admin') create(@Body() dto: any, @CurrentUser('organizationId') o: string) { return this.service.create(dto, o); }
  @Patch(':id') @Roles('admin') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
}
