import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroupReport(groupId: string, organizationId: string, query: any) {
    const { dateFrom, dateTo, periodId } = query;

    const where: any = {
      groupId,
      group: { organizationId },
      ...(periodId && { periodId }),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } }
        : {}),
    };

    const sheets = await this.prisma.attendanceSheet.findMany({
      where,
      include: {
        period: true,
        records: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            reason: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { direction: true, program: true },
    });

    const totalRecords = sheets.reduce((acc, s) => acc + s.totalCount, 0);
    const presentRecords = sheets.reduce((acc, s) => acc + s.presentCount, 0);
    const absentRecords = sheets.reduce((acc, s) => acc + s.absentCount, 0);
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    // Reasons breakdown
    const reasonBreakdown: Record<string, number> = {};
    for (const sheet of sheets) {
      for (const record of sheet.records) {
        if (!record.isPresent && record.reason) {
          reasonBreakdown[record.reason.name] = (reasonBreakdown[record.reason.name] ?? 0) + 1;
        }
      }
    }

    return {
      group,
      period: { dateFrom, dateTo },
      summary: {
        totalSheets: sheets.length,
        totalRecords,
        presentRecords,
        absentRecords,
        attendanceRate,
        reasonBreakdown,
      },
      sheets,
    };
  }

  async getStudentReport(studentId: string, organizationId: string, query: any) {
    const { dateFrom, dateTo } = query;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: { status: true, program: { include: { direction: true } }, currentGroup: true },
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        sheet: {
          group: { organizationId },
          ...(dateFrom || dateTo
            ? { date: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } }
            : {}),
        },
      },
      include: {
        sheet: { include: { group: { select: { id: true, name: true } }, period: true } },
        reason: true,
      },
      orderBy: { sheet: { date: 'desc' } },
    });

    const total = records.length;
    const present = records.filter((r) => r.isPresent).length;
    const absent = records.filter((r) => !r.isPresent).length;

    return {
      student,
      summary: {
        total,
        present,
        absent,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      },
      records,
    };
  }

  async getSummaryReport(organizationId: string, query: any) {
    const { dateFrom, dateTo, directionId, courseNumber } = query;

    const groups = await this.prisma.group.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(directionId && { directionId }),
        ...(courseNumber && { currentCourse: parseInt(courseNumber) }),
      },
      include: {
        direction: true,
        program: true,
        _count: { select: { students: true } },
        attendanceSheets: {
          where: {
            ...(dateFrom || dateTo
              ? { date: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } }
              : {}),
          },
          select: { presentCount: true, absentCount: true, totalCount: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = groups.map((group) => {
      const totalRecords = group.attendanceSheets.reduce((a, s) => a + s.totalCount, 0);
      const presentRecords = group.attendanceSheets.reduce((a, s) => a + s.presentCount, 0);
      const absentRecords = group.attendanceSheets.reduce((a, s) => a + s.absentCount, 0);
      const rate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : null;

      return {
        id: group.id,
        name: group.name,
        direction: group.direction,
        program: group.program,
        studentCount: group._count.students,
        totalSheets: group.attendanceSheets.length,
        totalRecords,
        presentRecords,
        absentRecords,
        attendanceRate: rate,
      };
    });

    return {
      period: { dateFrom, dateTo },
      groups: result,
      totals: {
        groupCount: result.length,
        totalRecords: result.reduce((a, g) => a + g.totalRecords, 0),
        presentRecords: result.reduce((a, g) => a + g.presentRecords, 0),
        absentRecords: result.reduce((a, g) => a + g.absentRecords, 0),
        avgAttendanceRate: result.length
          ? Math.round(result.filter((g) => g.attendanceRate !== null).reduce((a, g) => a + (g.attendanceRate ?? 0), 0) / result.length)
          : null,
      },
    };
  }

  async getDashboardStats(organizationId: string, userContext: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (userContext.roles.includes('admin')) {
      const [studentCount, groupCount, userCount, todaySheets, recentAuditLogs] = await Promise.all([
        this.prisma.student.count({ where: { organizationId, isActive: true } }),
        this.prisma.group.count({ where: { organizationId, isActive: true } }),
        this.prisma.user.count({ where: { organizationId, isActive: true } }),
        this.prisma.attendanceSheet.findMany({
          where: { group: { organizationId }, date: { gte: today, lt: tomorrow } },
          include: { group: { select: { id: true, name: true } }, period: true },
        }),
        this.prisma.auditLog.findMany({
          where: { organizationId },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return { role: 'admin', studentCount, groupCount, userCount, todaySheets, recentAuditLogs };
    }

    if (userContext.roles.includes('foreman')) {
      const groupIds = userContext.groupScopeIds;
      const todaySheets = await this.prisma.attendanceSheet.findMany({
        where: { groupId: { in: groupIds }, date: { gte: today, lt: tomorrow } },
        include: { group: { select: { id: true, name: true } }, period: true },
      });

      const myGroups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        include: { _count: { select: { students: true } } },
      });

      return { role: 'foreman', myGroups, todaySheets };
    }

    // manager
    const directionIds = userContext.directionScopeIds ?? [];
    const groups = await this.prisma.group.findMany({
      where: { organizationId, directionId: { in: directionIds }, isActive: true },
      include: { _count: { select: { students: true } } },
    });

    const unfilled = await this.prisma.attendanceSheet.count({
      where: { groupId: { in: groups.map((g) => g.id) }, date: { gte: today, lt: tomorrow }, status: 'DRAFT' },
    });

    return { role: 'manager', groups, unfilledSheetsToday: unfilled };
  }
}
