import { ReportsService } from '../reports/reports.service.js';
import { groupScope, requirePermission } from '../auth/scope.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';
import { addRosterSheet } from './roster-sheet.js';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportStudents(user: any, query: any): Promise<Buffer> {
    requirePermission(user, 'REPORTS_EXPORT');
    const organizationId = user.organizationId;
    const { groupId, statusId } = query;

    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        isActive: true,
        currentGroup: groupScope(user),
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

  async exportAttendance(user: any, query: any): Promise<Buffer> {
    requirePermission(user, 'REPORTS_EXPORT');
    const reportService = new ReportsService(this.prisma);
    const filter = reportService.filters(user, query);
    const { dateFrom, dateTo } = query;

    const sheets = await this.prisma.attendanceSheet.findMany({
      where: filter.sheet,
      include: {
        group: { select: { name: true } },
        period: true,
        records: {
          where: { ...filter, sheet: undefined },
          include: {
            student: { select: { lastName: true, firstName: true, middleName: true, gender: true } },
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
      { header: 'Курс', key: 'course', width: 9 },
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
          course: record.courseSnapshot ?? 'Неизвестен',
          group: sheet.group.name,
          lastName: record.student.lastName,
          firstName: record.student.firstName,
          isPresent: record.isPresent === null ? 'Не отмечен' : record.isPresent ? 'Присутствует' : 'Отсутствует',
          reason: record.reason?.name ?? '',
        });
      }
    }

    ws.insertRows(1, [['Отчет по посещаемости'], [`Период: ${query.from??dateFrom??'начало учета'} — ${query.to??dateTo??'по настоящее время'}; курс: ${query.course??'все'}`], [`Группы: ${[...new Set(sheets.map(s=>s.group.name))].join(', ')}`]]);
    for(let row=1;row<=3;row++){ws.mergeCells(row,1,row,8);ws.getRow(row).font={bold:true,size:row===1?16:11};ws.getRow(row).height=30;ws.getRow(row).alignment={wrapText:true,vertical:'middle'};}
    ws.views=[{state:'frozen',ySplit:4}]; ws.autoFilter={from:'A4',to:'H4'};
    const report=await reportService.attendance(user,query,'REPORTS_EXPORT');
    ws.addRow([]);ws.addRow(['ИТОГО',`Учтено: ${report.summary.total}`,`Присутствий: ${report.summary.present}`,`Отсутствий: ${report.summary.absent}`,`Не отмечено: ${report.summary.unmarked}`,`${report.summary.attendanceRate}%`]).font={bold:true};
    ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4'};
    addRosterSheet(workbook, sheets);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
}
