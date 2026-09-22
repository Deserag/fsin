import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AttendanceReasonsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(organizationId: string) {
    return this.prisma.attendanceReason.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
  create(dto: any, organizationId: string) { return this.prisma.attendanceReason.create({ data: { ...dto, organizationId } }); }
  update(id: string, dto: any) { return this.prisma.attendanceReason.update({ where: { id }, data: dto }); }
}
