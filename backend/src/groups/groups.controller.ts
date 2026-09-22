import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.groupsService.findAll(user.organizationId, user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('organizationId') orgId: string) {
    return this.groupsService.findOne(id, orgId);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.groupsService.create(dto, orgId, userId);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.groupsService.update(id, orgId, dto, userId);
  }

  @Post(':id/foreman')
  @Roles('admin')
  assignForeman(@Param('id') groupId: string, @Body('userId') userId: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') assignedBy: string) {
    return this.groupsService.assignForeman(groupId, userId, orgId, assignedBy);
  }

  @Patch(':id/archive')
  @Roles('admin')
  archive(@Param('id') id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.groupsService.archive(id, orgId, userId);
  }
}
