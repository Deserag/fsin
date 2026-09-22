import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(organizationId: string, query: any = {}) {
    const { directionId, isActive } = query;
    return this.prisma.educationalProgram.findMany({
      where: { organizationId, ...(directionId && { directionId }), ...(isActive !== undefined && { isActive }) },
      include: { direction: true, _count: { select: { groups: true, students: true } } },
      orderBy: { name: 'asc' },
    });
  }
  create(dto: any, organizationId: string) { return this.prisma.educationalProgram.create({ data: { ...dto, organizationId } }); }
  update(id: string, dto: any) { return this.prisma.educationalProgram.update({ where: { id }, data: dto }); }
}
