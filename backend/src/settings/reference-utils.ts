import { BadRequestException, ConflictException } from '@nestjs/common';
export function referenceData(dto: any, fields: string[], creating = false): any {
 const data: any = {};
 for (const key of fields) if (dto[key] !== undefined) data[key] = typeof dto[key] === 'string' ? dto[key].trim() : dto[key];
 if (creating || data.name !== undefined) if (!data.name) throw new BadRequestException('Название обязательно');
 if (creating || data.code !== undefined) if (!data.code) throw new BadRequestException('Код обязателен');
 for (const key of ['isActive','isTerminal','countsInAttendance','requiresNote']) if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new BadRequestException('Неверный формат переключателя');
 return data;
}
export async function safeReferenceDelete(prisma: any, model: string, id: string, organizationId: string) {
 if (model === 'educationalProgram' && await prisma.attendanceRecord.count({ where: { programSnapshotId: id } })) throw new ConflictException('Программа используется в истории табелей; архивируйте её');
 if (model === 'studentStatus' && await prisma.attendanceRecord.count({ where: { statusSnapshotId: id } })) throw new ConflictException('Статус используется в истории табелей; архивируйте его');
 if (model === 'academicYear' && await prisma.attendanceSheet.count({ where: { academicYearSnapshotId: id } })) throw new ConflictException('Учебный год используется в истории табелей');
 return prisma[model].delete({ where: { id, organizationId } });
}
