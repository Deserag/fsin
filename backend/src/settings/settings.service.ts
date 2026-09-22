import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.studentStatus.create({ data: { ...dto, organizationId } });
  }

  async getAttendancePeriods(organizationId: string) {
    return this.prisma.attendancePeriod.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async createAttendancePeriod(organizationId: string, dto: any) {
    return this.prisma.attendancePeriod.create({ data: { ...dto, organizationId } });
  }

  async getAttendanceFields(organizationId: string) {
    return this.prisma.attendanceField.findMany({
      where: { organizationId, isActive: true },
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
