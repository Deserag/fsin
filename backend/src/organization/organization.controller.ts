import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}
  @Get() findOne(@CurrentUser('organizationId') id: string) { return this.service.findOne(id); }
  @Patch() update(@CurrentUser('organizationId') id: string, @Body() dto: any) { return this.service.update(id, dto); }
}
