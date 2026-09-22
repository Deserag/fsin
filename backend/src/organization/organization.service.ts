import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}
  findOne(id: string) { return this.prisma.organization.findUnique({ where: { id } }); }
  update(id: string, dto: any) { return this.prisma.organization.update({ where: { id }, data: dto }); }
}
