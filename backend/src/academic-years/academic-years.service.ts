import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(organizationId: string) {
    return this.prisma.academicYear.findMany({ where: { organizationId }, orderBy: { startDate: 'desc' } });
  }
  create(dto: any, organizationId: string) { return this.prisma.academicYear.create({ data: { ...dto, organizationId } }); }
  update(id: string, dto: any) { return this.prisma.academicYear.update({ where: { id }, data: dto }); }
  async setCurrent(id: string, organizationId: string) {
    await this.prisma.academicYear.updateMany({ where: { organizationId }, data: { isCurrent: false } });
    return this.prisma.academicYear.update({ where: { id }, data: { isCurrent: true } });
  }
}
