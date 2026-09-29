import { safeReferenceDelete } from '../settings/reference-utils.js';
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class AcademicYearsService {
 constructor(private readonly prisma: PrismaService) {}
 findAll(organizationId: string) { return this.prisma.academicYear.findMany({ where: { organizationId }, orderBy: { startDate: 'desc' } }); }
 async create(dto: any, organizationId: string) { return this.save(null, dto, organizationId); }
 async update(id: string, dto: any, organizationId: string) { return this.save(id, dto, organizationId); }
 private async save(id: string | null, dto: any, organizationId: string) {
  return this.prisma.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`;
   const existing = id ? await tx.academicYear.findFirst({ where: { id, organizationId } }) : null;
   if (id && !existing) throw new NotFoundException('Учебный год не найден');
   const name = String(dto.name ?? existing?.name ?? '').trim().replace('/', '-');
   const startDate = new Date(dto.startDate ?? existing?.startDate ?? 'invalid');
   const endDate = new Date(dto.endDate ?? existing?.endDate ?? 'invalid');
   if (!name || !Number.isFinite(+startDate) || !Number.isFinite(+endDate) || startDate >= endDate) throw new BadRequestException('Укажите название и корректные даты начала и окончания');
   const duplicate = await tx.academicYear.findFirst({ where: { organizationId, name, ...(id && { id: { not: id } }) } });
   if (duplicate) throw new ConflictException(`Учебный год ${name} уже существует`);
   const overlap = await tx.academicYear.findFirst({ where: { organizationId, ...(id && { id: { not: id } }), startDate: { lte: endDate }, endDate: { gte: startDate } } });
   if (overlap) throw new ConflictException(`Даты пересекаются с учебным годом ${overlap.name}`);
   const isActive = dto.isActive ?? existing?.isActive ?? true;
   const isCurrent = isActive && (dto.isCurrent ?? existing?.isCurrent ?? false);
   if (isCurrent) await tx.academicYear.updateMany({ where: { organizationId }, data: { isCurrent: false } });
   const data = { name, startDate, endDate, isActive, isCurrent };
   return id ? tx.academicYear.update({ where: { id }, data }) : tx.academicYear.create({ data: { ...data, organizationId } });
  });
 }
 setCurrent(id: string, organizationId: string) { return this.update(id, { isCurrent: true, isActive: true }, organizationId); }
 async remove(id: string, organizationId: string) { return safeReferenceDelete(this.prisma, 'academicYear', id, organizationId); }
}
