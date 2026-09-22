import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto, UpdateStudentDto, StudentQueryDto } from './dto/student.dto.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: StudentQueryDto, userContext: any) {
    const {
      search, groupId, currentCourse, statusId, programId,
      directionId, academicYearId, isActive, page = 1, limit = 50,
    } = query;

    const skip = (page - 1) * limit;

    // Scope check: non-admin users can only see students in their scope groups
    let allowedGroupIds: string[] | undefined;
    if (!userContext.roles.includes('admin') && !userContext.roles.includes('manager')) {
      allowedGroupIds = userContext.groupScopeIds;
    } else if (userContext.roles.includes('manager')) {
      // Manager sees groups in their direction scope
      if (userContext.directionScopeIds?.length > 0) {
        const directionGroups = await this.prisma.group.findMany({
          where: {
            organizationId,
            directionId: { in: userContext.directionScopeIds },
          },
          select: { id: true },
        });
        allowedGroupIds = directionGroups.map((g) => g.id);
      }
    }

    const where: any = {
      organizationId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { lastName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { middleName: { contains: search, mode: 'insensitive' } },
          { internalId: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(statusId && { statusId }),
      ...(programId && { programId }),
      ...(academicYearId && { academicYearId }),
      ...(currentCourse && { currentCourse }),
      ...(groupId
        ? { currentGroupId: groupId }
        : allowedGroupIds?.length
          ? { currentGroupId: { in: allowedGroupIds } }
          : {}),
    };

    // Filter by direction through program
    if (directionId && !groupId) {
      const programs = await this.prisma.educationalProgram.findMany({
        where: { organizationId, directionId },
        select: { id: true },
      });
      where.programId = { in: programs.map((p) => p.id) };
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          status: true,
          program: { include: { direction: true } },
          academicYear: true,
          currentGroup: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId },
      include: {
        status: true,
        program: { include: { direction: true } },
        academicYear: true,
        currentGroup: { select: { id: true, name: true } },
        statusHistory: {
          include: { status: true },
          orderBy: { changeDate: 'desc' },
          take: 20,
        },
        groupHistory: {
          include: { group: { select: { id: true, name: true } } },
          orderBy: { joinDate: 'desc' },
          take: 20,
        },
        courseHistory: {
          orderBy: { transitionDate: 'desc' },
          take: 20,
        },
      },
    });

    if (!student) throw new NotFoundException('Студент не найден');
    return student;
  }

  async create(dto: CreateStudentDto, createdBy: string) {
    const organizationId = dto.organizationId as string;

    // Check unique internal ID
    if (dto.internalId) {
      const existing = await this.prisma.student.findFirst({
        where: { organizationId, internalId: dto.internalId },
      });
      if (existing) {
        throw new BadRequestException(`Студент с идентификатором ${dto.internalId} уже существует`);
      }
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const s = await tx.student.create({
        data: {
          organizationId,
          internalId: dto.internalId,
          lastName: dto.lastName,
          firstName: dto.firstName,
          middleName: dto.middleName,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          enrollmentDate: dto.enrollmentDate ? new Date(dto.enrollmentDate) : null,
          academicYearId: dto.academicYearId,
          currentCourse: dto.currentCourse,
          programId: dto.programId,
          statusId: dto.statusId,
          currentGroupId: dto.currentGroupId,
          notes: dto.notes,
        },
        include: { status: true, program: true, currentGroup: { select: { id: true, name: true } } },
      });

      // Status history
      await tx.studentStatusHistory.create({
        data: {
          studentId: s.id,
          statusId: dto.statusId,
          changedBy: createdBy,
          reason: 'Зачисление',
        },
      });

      // Group history
      if (dto.currentGroupId) {
        await tx.studentGroupHistory.create({
          data: {
            studentId: s.id,
            groupId: dto.currentGroupId,
            changedBy: createdBy,
            reason: 'Зачисление в группу',
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          userId: createdBy,
          action: 'CREATE',
          entityType: 'Student',
          entityId: s.id,
          newValue: { lastName: s.lastName, firstName: s.firstName, statusId: s.statusId },
        },
      });

      return s;
    });

    return student;
  }

  async update(id: string, organizationId: string, dto: UpdateStudentDto, updatedBy: string) {
    const existing = await this.prisma.student.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Студент не найден');

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.student.update({
        where: { id },
        data: {
          ...(dto.internalId !== undefined && { internalId: dto.internalId }),
          ...(dto.lastName && { lastName: dto.lastName }),
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
          ...(dto.enrollmentDate && { enrollmentDate: new Date(dto.enrollmentDate) }),
          ...(dto.graduationDate && { graduationDate: new Date(dto.graduationDate) }),
          ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId }),
          ...(dto.currentCourse !== undefined && { currentCourse: dto.currentCourse }),
          ...(dto.programId !== undefined && { programId: dto.programId }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { status: true, program: true, currentGroup: { select: { id: true, name: true } } },
      });

      // If status changed — add history
      if (dto.statusId && dto.statusId !== existing.statusId) {
        await tx.student.update({ where: { id }, data: { statusId: dto.statusId } });
        await tx.studentStatusHistory.create({
          data: {
            studentId: id,
            statusId: dto.statusId,
            changedBy: updatedBy,
            reason: 'Изменение статуса',
          },
        });
      }

      // If group changed — add history
      if (dto.currentGroupId && dto.currentGroupId !== existing.currentGroupId) {
        // Close previous group history
        if (existing.currentGroupId) {
          await tx.studentGroupHistory.updateMany({
            where: { studentId: id, groupId: existing.currentGroupId, leaveDate: null },
            data: { leaveDate: new Date() },
          });
        }

        await tx.student.update({ where: { id }, data: { currentGroupId: dto.currentGroupId } });
        await tx.studentGroupHistory.create({
          data: {
            studentId: id,
            groupId: dto.currentGroupId,
            changedBy: updatedBy,
            reason: 'Перевод в группу',
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: updatedBy,
          action: 'UPDATE',
          entityType: 'Student',
          entityId: id,
          oldValue: { lastName: existing.lastName, statusId: existing.statusId },
          newValue: { lastName: dto.lastName, statusId: dto.statusId },
        },
      });

      return s;
    });

    return updated;
  }

  async getHistory(id: string, organizationId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId },
    });
    if (!student) throw new NotFoundException('Студент не найден');

    const [statusHistory, groupHistory, courseHistory] = await Promise.all([
      this.prisma.studentStatusHistory.findMany({
        where: { studentId: id },
        include: { status: true },
        orderBy: { changeDate: 'desc' },
      }),
      this.prisma.studentGroupHistory.findMany({
        where: { studentId: id },
        include: { group: { select: { id: true, name: true } } },
        orderBy: { joinDate: 'desc' },
      }),
      this.prisma.studentCourseHistory.findMany({
        where: { studentId: id },
        orderBy: { transitionDate: 'desc' },
      }),
    ]);

    return { statusHistory, groupHistory, courseHistory };
  }
}
