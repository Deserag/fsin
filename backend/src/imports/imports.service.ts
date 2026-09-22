import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import ExcelJS from 'exceljs';

const EXPECTED_COLUMNS = [
  'lastName', 'firstName', 'middleName', 'birthDate',
  'groupName', 'currentCourse', 'directionCode', 'programCode',
  'enrollmentYear', 'statusCode',
];

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async parseExcel(buffer: Buffer, organizationId: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('Файл не содержит листов');

    const rows: any[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
      } else {
        const rowData: any = {};
        row.eachCell((cell, colIndex) => {
          rowData[headers[colIndex - 1]] = cell.value;
        });
        rows.push(rowData);
      }
    });

    // Create import job — store the FULL parsed row set so later steps never
    // operate on a truncated subset (only previewData is capped, for display).
    const job = await this.prisma.importJob.create({
      data: {
        organizationId,
        userId,
        type: 'STUDENTS',
        status: 'PARSING',
        totalRows: rows.length,
        previewData: rows.slice(0, 10),
        rawData: rows,
      },
    });

    return { jobId: job.id, headers, totalRows: rows.length, previewData: rows.slice(0, 10) };
  }

  async setColumnMapping(jobId: string, mapping: Record<string, string>) {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'VALIDATING', columnMapping: mapping },
    });
    return { jobId, mapping };
  }

  async validate(jobId: string, organizationId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Задание импорта не найдено');

    const rows = (job.rawData as any[]) ?? [];
    const mapping = job.columnMapping as Record<string, string>;
    const errors: Array<{ row: number; field: string; message: string; value: string }> = [];
    const valid: any[] = [];

    const [groups, programs, statuses] = await Promise.all([
      this.prisma.group.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.educationalProgram.findMany({ where: { organizationId }, select: { id: true, code: true } }),
      this.prisma.studentStatus.findMany({ where: { organizationId }, select: { id: true, code: true } }),
    ]);

    const groupMap = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]));
    const programMap = new Map(programs.map((p) => [p.code.toLowerCase(), p.id]));
    const statusMap = new Map(statuses.map((s) => [s.code.toLowerCase(), s.id]));

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const mapped: any = {};
      let rowValid = true;

      // Apply column mapping
      for (const [field, colName] of Object.entries(mapping)) {
        mapped[field] = row[colName] ?? null;
      }

      if (!mapped.lastName) { errors.push({ row: rowNum, field: 'lastName', message: 'Фамилия обязательна', value: '' }); rowValid = false; }
      if (!mapped.firstName) { errors.push({ row: rowNum, field: 'firstName', message: 'Имя обязательно', value: '' }); rowValid = false; }

      // Validate group
      if (mapped.groupName) {
        const groupId = groupMap.get(String(mapped.groupName).toLowerCase());
        if (!groupId) { errors.push({ row: rowNum, field: 'groupName', message: `Группа "${mapped.groupName}" не найдена`, value: mapped.groupName }); rowValid = false; }
        else mapped.groupId = groupId;
      }

      // Validate program
      if (mapped.programCode) {
        const programId = programMap.get(String(mapped.programCode).toLowerCase());
        if (!programId) { errors.push({ row: rowNum, field: 'programCode', message: `Программа "${mapped.programCode}" не найдена`, value: mapped.programCode }); rowValid = false; }
        else mapped.programId = programId;
      }

      // Validate status
      const statusCode = (mapped.statusCode ?? 'STUDYING').toLowerCase();
      const statusId = statusMap.get(statusCode);
      if (!statusId) { errors.push({ row: rowNum, field: 'statusCode', message: `Статус "${mapped.statusCode}" не найден`, value: mapped.statusCode }); rowValid = false; }
      else mapped.statusId = statusId;

      if (rowValid) valid.push(mapped);
    });

    // Save errors to DB
    if (errors.length > 0) {
      await this.prisma.importError.createMany({
        data: errors.map((e) => ({ jobId, rowNumber: e.row, field: e.field, message: e.message, value: String(e.value) })),
      });
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'PREVIEW', validRows: valid.length, errorRows: errors.length, validData: valid },
    });

    return { jobId, totalRows: rows.length, validRows: valid.length, errorRows: errors.length, errors };
  }

  async confirm(jobId: string, organizationId: string, userId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { errors: true },
    });
    if (!job) throw new NotFoundException('Задание импорта не найдено');
    if (job.status !== 'PREVIEW') throw new BadRequestException('Импорт уже выполнен или не прошёл валидацию');

    const validRows = (job.validData as any[]) ?? [];
    if (validRows.length === 0) {
      throw new BadRequestException('Нет валидных строк для импорта');
    }

    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'IMPORTING', confirmedAt: new Date() } });

    let importedRows = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of validRows) {
        const enrollmentDate = row.enrollmentYear ? new Date(`${row.enrollmentYear}-09-01`) : new Date();
        const student = await tx.student.create({
          data: {
            organizationId,
            lastName: String(row.lastName),
            firstName: String(row.firstName),
            middleName: row.middleName ? String(row.middleName) : null,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            enrollmentDate,
            currentCourse: row.currentCourse ? Number(row.currentCourse) : 1,
            programId: row.programId ?? null,
            statusId: row.statusId,
            currentGroupId: row.groupId ?? null,
          },
        });

        if (row.groupId) {
          await tx.studentGroupHistory.create({
            data: { studentId: student.id, groupId: row.groupId, joinDate: new Date() },
          });
        }

        importedRows += 1;
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'IMPORT',
          entityType: 'Student',
          newValue: { jobId, importedRows },
        },
      });
    });

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date(), importedRows },
    });

    return { jobId, importedRows, errorRows: job.errorRows };
  }

  async getJob(jobId: string) {
    return this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { errors: { take: 100 } },
    });
  }

  async generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Студенты');

    ws.columns = [
      { header: 'Фамилия', key: 'lastName', width: 20 },
      { header: 'Имя', key: 'firstName', width: 15 },
      { header: 'Отчество', key: 'middleName', width: 20 },
      { header: 'Дата рождения', key: 'birthDate', width: 15 },
      { header: 'Группа', key: 'groupName', width: 20 },
      { header: 'Курс', key: 'currentCourse', width: 10 },
      { header: 'Направление (код)', key: 'directionCode', width: 20 },
      { header: 'Программа (код)', key: 'programCode', width: 20 },
      { header: 'Год поступления', key: 'enrollmentYear', width: 15 },
      { header: 'Статус (код)', key: 'statusCode', width: 15 },
    ];

    // Style headers
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add example row
    ws.addRow(['Иванов', 'Иван', 'Иванович', '01.01.1995', '204', '2', 'LAW', 'LAW_BACHELOR', '2023', 'STUDYING']);

    return workbook.xlsx.writeBuffer();
  }
}
