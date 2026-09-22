import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() { return this.rolesService.findAll(); }

  @Get('permissions')
  findAllPermissions() { return this.rolesService.findAllPermissions(); }

  @Patch(':roleId/permissions/:permissionId')
  setPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Body('granted') granted: boolean,
  ) {
    return this.rolesService.setPermission(roleId, permissionId, granted);
  }
}
