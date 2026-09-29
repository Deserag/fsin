import { referenceData, safeReferenceDelete } from '../settings/reference-utils.js';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AttendanceReasonsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(organizationId: string) {
    return this.prisma.attendanceReason.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });
  }
  create(dto: any, organizationId: string) { this.checkCategory(dto); return this.prisma.attendanceReason.create({ data: { ...referenceData(dto, ['code','name','category','requiresNote','isActive','sortOrder'], true), organizationId } }); }
  update(id: string, dto: any, organizationId: string) { this.checkCategory(dto); return this.prisma.attendanceReason.update({ where: { id, organizationId }, data: referenceData(dto, ['code','name','category','requiresNote','isActive','sortOrder']) }); }
  private checkCategory(dto:any){if(dto.category!==undefined && !['IN_INSTITUTE','OUTSIDE'].includes(dto.category))throw new BadRequestException('Неверная категория табеля');}
 remove(id: string, organizationId: string) { return safeReferenceDelete(this.prisma, 'attendanceReason', id, organizationId); }
}
