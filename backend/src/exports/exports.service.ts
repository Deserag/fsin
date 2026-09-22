import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportStudents(organizationId: string, query: any): Promise<Buffer> {
    const { groupId, statusId } = query;

    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(groupId && { currentGroupId: groupId }),
        ...(statusId && { statusId }),
      },
      include: {
        status: true,
        program: { include: { direction: true } },
        currentGroup: { select: { name: true } },
        academicYear: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Студенты');

    ws.columns = [
      { header: '№', key: 'num', width: 5 },
      { header: 'Фамилия', key: 'lastName', width: 20 },
      { header: 'Имя', key: 'firstName', width: 15 },
      { header: 'Отчество', key: 'middleName', width: 20 },
      { header: 'Дата рождения', key: 'birthDate', width: 15 },
      { header: 'Группа', key: 'group', width: 15 },
      { header: 'Курс', key: 'course', width: 8 },
      { header: 'Направление', key: 'direction', width: 25 },
      { header: 'Программа', key: 'program', width: 25 },
      { header: 'Статус', key: 'status', width: 20 },
      { header: 'Дата зачисления', key: 'enrollmentDate', width: 18 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    students.forEach((s, i) => {
      ws.addRow({
        num: i + 1,
        lastName: s.lastName,
        firstName: s.firstName,
        middleName: s.middleName ?? '',
        birthDate: s.birthDate ? s.birthDate.toLocaleDateString('ru-RU') : '',
        group: s.currentGroup?.name ?? '',
        course: s.currentCourse ?? '',
        direction: s.program?.direction?.name ?? '',
        program: s.program?.name ?? '',
        status: s.status.name,
        enrollmentDate: s.enrollmentDate ? s.enrollmentDate.toLocaleDateString('ru-RU') : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  async exportAttendance(organizationId: string, query: any): Promise<Buffer> {
    const { groupId, dateFrom, dateTo, periodId } = query;

    const sheets = await this.prisma.attendanceSheet.findMany({
      where: {
        group: { organizationId },
        ...(groupId && { groupId }),
        ...(periodId && { periodId }),
        ...(dateFrom || dateTo ? { date: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } } : {}),
      },
      include: {
        group: { select: { name: true } },
        period: true,
        records: {
          include: {
            student: { select: { lastName: true, firstName: true, middleName: true } },
            reason: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Посещаемость');

    ws.columns = [
      { header: 'Дата', key: 'date', width: 12 },
      { header: 'Период', key: 'period', width: 10 },
      { header: 'Группа', key: 'group', width: 15 },
      { header: 'Фамилия', key: 'lastName', width: 20 },
      { header: 'Имя', key: 'firstName', width: 15 },
      { header: 'Присутствие', key: 'isPresent', width: 14 },
      { header: 'Причина', key: 'reason', width: 25 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const sheet of sheets) {
      for (const record of sheet.records) {
        ws.addRow({
          date: sheet.date.toLocaleDateString('ru-RU'),
          period: sheet.period.name,
          group: sheet.group.name,
          lastName: record.student.lastName,
          firstName: record.student.firstName,
          isPresent: record.isPresent ? 'Присутствует' : 'Отсутствует',
          reason: record.reason?.name ?? '',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
}
