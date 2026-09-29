import { referenceData, safeReferenceDelete } from './reference-utils.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  updateReference(model: string, id: string, organizationId: string, dto: any) {
    const fields = model === 'studentStatus' ? ['code','name','isTerminal','countsInAttendance','isActive','sortOrder'] : ['code','name','startTime','endTime','isActive','sortOrder'];
    return (this.prisma as any)[model].update({ where: { id, organizationId }, data: referenceData(dto, fields) });
  }
  removeReference(model: string, id: string, organizationId: string) { return safeReferenceDelete(this.prisma, model, id, organizationId); }
  async findAll(organizationId: string) {
    const settings = await this.prisma.systemSetting.findMany({ where: { organizationId } });
    return settings.reduce((acc: any, s) => { acc[s.key] = s.value; return acc; }, {});
  }

  async update(organizationId: string, key: string, value: string) {
    return this.prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, value },
      update: { value },
    });
  }

  async getStudentStatuses(organizationId: string) {
    return this.prisma.studentStatus.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' } });
  }

  async createStudentStatus(organizationId: string, dto: any) {
    return this.prisma.studentStatus.create({ data: { ...referenceData(dto, ['code','name','isTerminal','countsInAttendance','isActive','sortOrder','startTime','endTime'], true), organizationId } });
  }

  async getAttendancePeriods(organizationId: string) {
    return this.prisma.attendancePeriod.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' } });
  }

  async createAttendancePeriod(organizationId: string, dto: any) {
    return this.prisma.attendancePeriod.create({ data: { ...referenceData(dto, ['code','name','isTerminal','countsInAttendance','isActive','sortOrder','startTime','endTime'], true), organizationId } });
  }

  async getAttendanceFields(organizationId: string) {
    return this.prisma.attendanceField.findMany({
      where: { organizationId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createAttendanceField(organizationId: string, dto: any) {
    const { options, ...fieldData } = dto;
    return this.prisma.attendanceField.create({
      data: {
        ...fieldData,
        organizationId,
        options: options?.length ? { create: options } : undefined,
      },
      include: { options: true },
    });
  }

  async updateAttendanceField(id: string, dto: any) {
    return this.prisma.attendanceField.update({ where: { id }, data: dto });
  }
}
