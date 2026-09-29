import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CourseTransitionResult {
  transitions: Array<{
    studentId: string;
    studentName: string;
    fromCourse: number;
    toCourse: number | null;
    action: 'PROMOTE' | 'GRADUATE' | 'SKIP';
    reason?: string;
  }>;
  summary: {
    total: number;
    toPromote: number;
    toGraduate: number;
    toSkip: number;
    byTransition: Record<string, number>;
  };
}

@Injectable()
export class CourseTransitionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Preview of course transition — does NOT modify data
   */
  async preview(organizationId: string): Promise<CourseTransitionResult> {
    // Find the active status codes
    const studyingStatus = await this.prisma.studentStatus.findFirst({
      where: { organizationId, code: 'STUDYING' },
    });

    if (!studyingStatus) {
      throw new BadRequestException('Статус "Обучается" не найден. Проверьте справочник статусов.');
    }

    // Find all active students with programs
    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        statusId: studyingStatus.id,
        isActive: true,
        currentCourse: { not: null },
        programId: { not: null },
      },
      include: {
        program: true,
        status: true,
        currentGroup: { select: { name: true } },
      },
    });

    const transitions: CourseTransitionResult['transitions'] = [];
    const byTransition: Record<string, number> = {};

    for (const student of students) {
      if (!student.currentCourse || !student.program?.maxCourse) {
        transitions.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          fromCourse: student.currentCourse ?? 0,
          toCourse: null,
          action: 'SKIP',
          reason: 'Нет курса или программы',
        });
        continue;
      }

      const maxCourse = student.program.maxCourse;

      if (student.currentCourse >= maxCourse) {
        transitions.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          fromCourse: student.currentCourse,
          toCourse: null,
          action: 'GRADUATE',
          reason: `Завершение обучения (курс ${student.currentCourse} из ${maxCourse})`,
        });
        const key = `${student.currentCourse}→Выпуск`;
        byTransition[key] = (byTransition[key] ?? 0) + 1;
      } else {
        const nextCourse = student.currentCourse + 1;
        transitions.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          fromCourse: student.currentCourse,
          toCourse: nextCourse,
          action: 'PROMOTE',
        });
        const key = `${student.currentCourse}→${nextCourse}`;
        byTransition[key] = (byTransition[key] ?? 0) + 1;
      }
    }

    const toPromote = transitions.filter((t) => t.action === 'PROMOTE').length;
    const toGraduate = transitions.filter((t) => t.action === 'GRADUATE').length;
    const toSkip = transitions.filter((t) => t.action === 'SKIP').length;

    return {
      transitions,
      summary: {
        total: transitions.length,
        toPromote,
        toGraduate,
        toSkip,
        byTransition,
      },
    };
  }

  /**
   * Execute course transition — idempotent, transactional
   */
  async execute(organizationId: string, executedBy: string): Promise<{
    promoted: number;
    graduated: number;
    skipped: number;
    errors: string[];
  }> {
    const previewResult = await this.preview(organizationId);

    let promoted = 0;
    let graduated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Find graduation status
    const graduatedStatus = await this.prisma.studentStatus.findFirst({
      where: { organizationId, code: 'GRADUATED' },
    });
    if (!graduatedStatus) {
      throw new BadRequestException('Статус "Обучение завершено" не найден');
    }

    // Idempotency guard: preview() always computes "current course + 1" from
    // the student's live state, so a naive currentCourse===toCourse check
    // never fires on a second run — it would just promote everyone again.
    // Instead, scope by the current academic year: a student who already has
    // an automatic course-history entry since the academic year started has
    // already been transitioned this cycle.
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { organizationId, isCurrent: true },
    });
    if (!currentYear) {
      throw new BadRequestException('Текущий учебный год не настроен');
    }
    const alreadyTransitioned = await this.prisma.studentCourseHistory.findMany({
      where: {
        isAutomatic: true,
        transitionDate: { gte: currentYear.startDate },
        studentId: { in: previewResult.transitions.map((t) => t.studentId) },
      },
      select: { studentId: true },
    });
    const alreadyTransitionedIds = new Set(alreadyTransitioned.map((h) => h.studentId));

    const transitionDate = new Date();

    for (const transition of previewResult.transitions) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (transition.action === 'PROMOTE') {
            // Idempotency check: skip if already transitioned this academic year
            if (alreadyTransitionedIds.has(transition.studentId)) {
              skipped++;
              return;
            }

            await tx.student.update({
              where: { id: transition.studentId },
              data: { currentCourse: transition.toCourse! },
            });

            await tx.studentCourseHistory.create({
              data: {
                studentId: transition.studentId,
                fromCourse: transition.fromCourse,
                toCourse: transition.toCourse!,
                transitionDate,
                changedBy: executedBy,
                isAutomatic: true,
                reason: 'Автоматический перевод на следующий курс',
              },
            });

            promoted++;
          } else if (transition.action === 'GRADUATE') {
            const student = await tx.student.findUnique({
              where: { id: transition.studentId },
            });

            // Idempotency: skip if already graduated
            if (student?.statusId === graduatedStatus.id) {
              skipped++;
              return;
            }

            await tx.student.update({
              where: { id: transition.studentId },
              data: {
                statusId: graduatedStatus.id,
                graduationDate: transitionDate,
                isActive: false,
              },
            });

            await tx.studentStatusHistory.create({
              data: {
                studentId: transition.studentId,
                statusId: graduatedStatus.id,
                changeDate: transitionDate,
                changedBy: executedBy,
                reason: 'Завершение обучения (автоматический перевод)',
              },
            });

            await tx.studentCourseHistory.create({
              data: {
                studentId: transition.studentId,
                fromCourse: transition.fromCourse,
                toCourse: transition.fromCourse,
                transitionDate,
                changedBy: executedBy,
                isAutomatic: true,
                reason: 'Завершение обучения на последнем курсе',
              },
            });

            graduated++;
          } else {
            skipped++;
          }
        });
      } catch (err: any) {
        errors.push(
          `Студент ${transition.studentName}: ${err?.message ?? 'Неизвестная ошибка'}`,
        );
      }
    }

    // Keep the course selector in sync when the active group has advanced together.
    const groups = await this.prisma.group.findMany({ where: { organizationId, isActive: true }, include: { students: { where: { isActive: true, status: { isTerminal: false, countsInAttendance: true } }, select: { currentCourse: true } } } });
    for (const group of groups) {
      const courses = [...new Set(group.students.map(s => s.currentCourse).filter((c): c is number => c !== null))];
      if (courses.length === 1) await this.prisma.group.update({ where: { id: group.id }, data: { currentCourse: courses[0] } });
    }
    // Audit log
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: executedBy,
        action: 'COURSE_TRANSITION',
        entityType: 'Student',
        entityId: organizationId,
        newValue: { promoted, graduated, skipped, errors },
        metadata: {
          transitionDate: transitionDate.toISOString(),
          totalProcessed: previewResult.summary.total,
        },
      },
    });

    return { promoted, graduated, skipped, errors };
  }
}
