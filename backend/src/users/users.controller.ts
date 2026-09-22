import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: any, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.findAll(orgId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.findOne(id, orgId);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.usersService.create({ ...dto, organizationId: orgId }, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.usersService.update(id, orgId, dto, userId);
  }

  @Patch(':id/block')
  block(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.usersService.block(id, orgId, reason, userId);
  }

  @Patch(':id/unblock')
  unblock(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.usersService.unblock(id, orgId, userId);
  }
}
