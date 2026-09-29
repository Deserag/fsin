import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { referenceData, safeReferenceDelete } from '../settings/reference-utils.js';
@Injectable()
export class ProgramsService {
 constructor(private readonly prisma: PrismaService) {}
 findAll(organizationId: string, query: any = {}) { return this.prisma.educationalProgram.findMany({ where: { organizationId, ...(query.isActive !== undefined && { isActive: String(query.isActive) === 'true' }) }, include: { direction: true, _count: { select: { groups: true, students: true } } }, orderBy: { name: 'asc' } }); }
 private data(dto: any, creating = false) {
  const data = referenceData(dto, ['code','name','shortName','durationYears','maxCourse','isActive','educationForm','specialization','sourceUrl'], creating);
  if (data.durationYears !== undefined) {
   if (!Number.isInteger(data.durationYears) || data.durationYears < 1 || data.durationYears > 10) throw new BadRequestException('Срок обучения: от 1 до 10 лет');
   data.maxCourse = data.durationYears;
  }
  return data;
 }
 create(dto: any, organizationId: string) { return this.prisma.educationalProgram.create({ data: { ...this.data(dto, true), organizationId } }); }
 update(id: string, dto: any, organizationId: string) { return this.prisma.educationalProgram.update({ where: { id, organizationId }, data: this.data(dto) }); }
 remove(id: string, organizationId: string) { return safeReferenceDelete(this.prisma, 'educationalProgram', id, organizationId); }
}
