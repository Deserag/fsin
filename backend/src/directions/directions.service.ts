import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DirectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string, query: any = {}) {
    const { isActive } = query;
    return this.prisma.direction.findMany({
      where: { organizationId, ...(isActive !== undefined && { isActive }) },
      include: { _count: { select: { programs: true, groups: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string, organizationId: string) {
    return this.prisma.direction.findFirst({
      where: { id, organizationId },
      include: { programs: { where: { isActive: true } }, groups: { where: { isActive: true } } },
    });
  }

  create(dto: any, organizationId: string) {
    return this.prisma.direction.create({ data: { ...dto, organizationId } });
  }

  update(id: string, dto: any) {
    return this.prisma.direction.update({ where: { id }, data: dto });
  }
}
