import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttendanceSheetStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sheets ──────────────────────────────────────────────

  async findSheets(organizationId: string, userContext: any, query: any) {
    const { groupId, periodId, dateFrom, dateTo, status, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    let allowedGroupIds: string[] | undefined;
    if (!userContext.roles.includes('admin') && !userContext.roles.includes('manager')) {
      allowedGroupIds = userContext.groupScopeIds;
    } else if (userContext.roles.includes('manager') && !userContext.roles.includes('admin')) {
      const dGroups = await this.prisma.group.findMany({
        where: { organizationId, directionId: { in: userContext.directionScopeIds } },
        select: { id: true },
      });
      allowedGroupIds = dGroups.map((g) => g.id);
    }

    const where: any = {
      group: { organizationId },
      ...(groupId ? { groupId } : allowedGroupIds ? { groupId: { in: allowedGroupIds } } : {}),
      ...(periodId && { periodId }),
      ...(status && { status }),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attendanceSheet.findMany({
        where,
        skip,
        take: limit,
        include: {
          group: { select: { id: true, name: true } },
          period: true,
        },
        orderBy: [{ date: 'desc' }, { group: { name: 'asc' } }],
      }),
      this.prisma.attendanceSheet.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneSheet(id: string) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, organizationId: true } },
        period: true,
        records: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, middleName: true, currentCourse: true },
            },
            reason: true,
            fieldValues: { include: { field: true } },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');
    return sheet;
  }

  async createSheet(dto: any, userContext: any) {
    const { groupId, periodId, date } = dto;

    // Scope check
    if (
      !userContext.roles.includes('admin') &&
      !userContext.roles.includes('manager') &&
      !userContext.groupScopeIds.includes(groupId)
    ) {
      throw new ForbiddenException('Нет доступа к этой группе');
    }

    // Check for duplicate
    const existing = await this.prisma.attendanceSheet.findFirst({
      where: { groupId, periodId, date: new Date(date) },
    });
    if (existing) {
      throw new BadRequestException('Табель для этой группы, периода и даты уже существует');
    }

    // Get active students count
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });
    if (!group) throw new NotFoundException('Группа не найдена');

    const sheet = await this.prisma.$transaction(async (tx) => {
      const s = await tx.attendanceSheet.create({
        data: {
          groupId,
          periodId,
          date: new Date(date),
          totalCount: group.students.length,
          status: 'DRAFT',
        },
        include: { group: { select: { id: true, name: true } }, period: true },
      });

      // Pre-create records for all active students (all marked as present by default)
      if (group.students.length > 0) {
        await tx.attendanceRecord.createMany({
          data: group.students.map((st) => ({
            sheetId: s.id,
            studentId: st.id,
            isPresent: true,
            markedBy: userContext.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: group.organizationId,
          userId: userContext.id,
          action: 'CREATE',
          entityType: 'AttendanceSheet',
          entityId: s.id,
          newValue: { groupId, periodId, date },
        },
      });

      return s;
    });

    return sheet;
  }

  // ── Records ──────────────────────────────────────────────

  async updateRecord(sheetId: string, studentId: string, dto: any, userContext: any) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id: sheetId },
      include: { group: true },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');

    if (sheet.status === 'CLOSED') {
      throw new ForbiddenException('Закрытый табель нельзя редактировать');
    }

    // Scope check
    if (
      !userContext.roles.includes('admin') &&
      !userContext.roles.includes('manager') &&
      !userContext.groupScopeIds.includes(sheet.groupId)
    ) {
      throw new ForbiddenException('Нет доступа к этой группе');
    }

    // If absent, reason is required
    if (dto.isPresent === false && !dto.reasonId) {
      throw new BadRequestException('При отметке отсутствия необходимо указать причину');
    }

    const record = await this.prisma.attendanceRecord.upsert({
      where: { sheetId_studentId: { sheetId, studentId } },
      create: {
        sheetId,
        studentId,
        isPresent: dto.isPresent,
        reasonId: dto.isPresent ? null : dto.reasonId,
        note: dto.note,
        markedBy: userContext.id,
      },
      update: {
        isPresent: dto.isPresent,
        reasonId: dto.isPresent ? null : dto.reasonId,
        note: dto.note,
        markedAt: new Date(),
        markedBy: userContext.id,
      },
      include: { reason: true },
    });

    // Update sheet counts
    await this.recalculateSheetCounts(sheetId);

    return record;
  }

  async bulkUpdateRecords(sheetId: string, updates: Array<{ studentId: string; isPresent: boolean; reasonId?: string; note?: string }>, userContext: any) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id: sheetId },
      include: { group: true },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');
    if (sheet.status === 'CLOSED') {
      throw new ForbiddenException('Закрытый табель нельзя редактировать');
    }

    // Scope check
    if (!userContext.roles.includes('admin') && !userContext.roles.includes('manager') && !userContext.groupScopeIds.includes(sheet.groupId)) {
      throw new ForbiddenException('Нет доступа к этой группе');
    }

    // Validate: absent records must have reason
    const invalidRecords = updates.filter((u) => u.isPresent === false && !u.reasonId);
    if (invalidRecords.length > 0) {
      throw new BadRequestException(`${invalidRecords.length} записей без причины отсутствия`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.attendanceRecord.upsert({
          where: { sheetId_studentId: { sheetId, studentId: update.studentId } },
          create: {
            sheetId,
            studentId: update.studentId,
            isPresent: update.isPresent,
            reasonId: update.isPresent ? null : update.reasonId,
            note: update.note,
            markedBy: userContext.id,
          },
          update: {
            isPresent: update.isPresent,
            reasonId: update.isPresent ? null : update.reasonId,
            note: update.note,
            markedAt: new Date(),
            markedBy: userContext.id,
          },
        });
      }
    });

    await this.recalculateSheetCounts(sheetId);
    return { updated: updates.length };
  }

  // ── Sheet Status Management ──────────────────────────────

  async submitSheet(id: string, userContext: any) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id },
      include: { group: true, records: true },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');

    if (sheet.status !== 'DRAFT' && sheet.status !== 'FILLED') {
      throw new BadRequestException('Можно отправить только табель в статусе "Черновик" или "Заполнен"');
    }

    // Scope check
    if (!userContext.roles.includes('admin') && !userContext.roles.includes('manager') && !userContext.groupScopeIds.includes(sheet.groupId)) {
      throw new ForbiddenException('Нет доступа к этой группе');
    }

    // Validate completeness: present + absent must equal total
    const presentCount = sheet.records.filter((r) => r.isPresent).length;
    const absentCount = sheet.records.filter((r) => !r.isPresent).length;
    const totalMarked = presentCount + absentCount;

    if (totalMarked !== sheet.totalCount) {
      throw new BadRequestException(
        `Не все студенты отмечены. Отмечено: ${totalMarked} из ${sheet.totalCount}. Незаполнено: ${sheet.totalCount - totalMarked}`,
      );
    }

    // Check absent have reasons
    const absentWithoutReason = sheet.records.filter((r) => !r.isPresent && !r.reasonId);
    if (absentWithoutReason.length > 0) {
      throw new BadRequestException(
        `${absentWithoutReason.length} отсутствующих студентов без указания причины`,
      );
    }

    await this.prisma.attendanceSheet.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userContext.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: sheet.group.organizationId,
        userId: userContext.id,
        action: 'SUBMIT',
        entityType: 'AttendanceSheet',
        entityId: id,
      },
    });

    return { message: 'Табель отправлен на проверку' };
  }

  async reviewSheet(id: string, userContext: any) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');

    if (sheet.status !== 'SUBMITTED') {
      throw new BadRequestException('Можно проверить только отправленный табель');
    }

    await this.prisma.attendanceSheet.update({
      where: { id },
      data: { status: 'REVIEWED', reviewedAt: new Date(), reviewedBy: userContext.id },
    });

    return { message: 'Табель проверен' };
  }

  async closeSheet(id: string, userContext: any) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');

    if (sheet.status !== 'REVIEWED') {
      throw new BadRequestException('Можно закрыть только проверенный табель');
    }

    await this.prisma.attendanceSheet.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: userContext.id },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: sheet.group.organizationId,
        userId: userContext.id,
        action: 'CLOSE',
        entityType: 'AttendanceSheet',
        entityId: id,
      },
    });

    return { message: 'Табель закрыт' };
  }

  async getSheetValidation(id: string) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id },
      include: {
        records: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!sheet) throw new NotFoundException('Табель не найден');

    const presentCount = sheet.records.filter((r) => r.isPresent).length;
    const absentCount = sheet.records.filter((r) => !r.isPresent).length;
    const totalMarked = presentCount + absentCount;
    const absentWithoutReason = sheet.records.filter((r) => !r.isPresent && !r.reasonId);

    return {
      totalStudents: sheet.totalCount,
      totalMarked,
      presentCount,
      absentCount,
      unmarked: sheet.totalCount - totalMarked,
      absentWithoutReasonCount: absentWithoutReason.length,
      isComplete: totalMarked === sheet.totalCount,
      isValid: totalMarked === sheet.totalCount && absentWithoutReason.length === 0,
      absentWithoutReason: absentWithoutReason.map((r) => ({
        studentId: r.studentId,
        studentName: `${r.student.lastName} ${r.student.firstName}`,
      })),
    };
  }

  private async recalculateSheetCounts(sheetId: string) {
    const counts = await this.prisma.attendanceRecord.groupBy({
      by: ['isPresent'],
      where: { sheetId },
      _count: true,
    });

    const presentCount = counts.find((c) => c.isPresent)?._count ?? 0;
    const absentCount = counts.find((c) => !c.isPresent)?._count ?? 0;
    const totalMarked = presentCount + absentCount;
    const newStatus: AttendanceSheetStatus =
      totalMarked > 0 ? 'FILLED' : 'DRAFT';

    await this.prisma.attendanceSheet.update({
      where: { id: sheetId },
      data: {
        presentCount,
        absentCount,
        status: newStatus,
      },
    });
  }
}
