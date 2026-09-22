import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';
@Module({ controllers: [OrganizationController], providers: [OrganizationService] })
export class OrganizationModule {}
