import { groupScope, assertGroup } from '../auth/scope.js';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto, UpdateStudentDto, StudentQueryDto } from './dto/student.dto.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateReferences(dto: any, organizationId: string, user?: any) {
    for (const [key, model] of [['statusId','studentStatus'],['programId','educationalProgram'],['academicYearId','academicYear'],['currentGroupId','group']]) {
      if (!dto[key]) continue;
      const item = await (this.prisma as any)[model].findFirst({ where: { id: dto[key], organizationId } });
      if (!item) throw new BadRequestException('Справочная запись не принадлежит организации');
      if (key === 'currentGroupId' && user) assertGroup(item,user);
    }
  }
  async findAll(organizationId: string, query: StudentQueryDto, userContext: any) {
    const {
      search, groupId, currentCourse, statusId, programId,
      directionId, academicYearId, isActive, page = 1, limit = 50,
    } = query;

    const skip = (page - 1) * limit;

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
      ...(groupId && { currentGroupId: groupId }),
      ...(!userContext.roles.includes('admin') && { currentGroup: groupScope(userContext) }),
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

  async findOne(id: string, organizationId: string, user?: any) {
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
    if (user && !user.roles.includes('admin')) { const group = await this.prisma.group.findUnique({ where: { id: student.currentGroupId ?? '' } }); assertGroup(group, user); }
    return student;
  }

  async create(dto: CreateStudentDto, createdBy: string, user?: any) {
    const organizationId = dto.organizationId as string;

    await this.validateReferences(dto, organizationId, user);
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
          gender: dto.gender,
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
          changeDate: dto.enrollmentDate ? new Date(dto.enrollmentDate) : new Date(),
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
            joinDate: dto.enrollmentDate ? new Date(dto.enrollmentDate) : new Date(),
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

  async update(id: string, organizationId: string, dto: UpdateStudentDto, updatedBy: string, user?: any) {
    const existing = await this.prisma.student.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Студент не найден');
    if (user) await this.findOne(id, organizationId, user);
    await this.validateReferences(dto, organizationId, user);

    const changeDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(new Date().toISOString().slice(0,10));
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.currentCourse !== undefined && dto.currentCourse !== existing.currentCourse) await tx.studentCourseHistory.create({ data: { studentId: id, fromCourse: existing.currentCourse, toCourse: dto.currentCourse, transitionDate: changeDate, changedBy: updatedBy, reason: 'Изменение курса' } });
      const s = await tx.student.update({
        where: { id },
        data: {
          ...(dto.internalId !== undefined && { internalId: dto.internalId }),
          ...(dto.lastName && { lastName: dto.lastName }),
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
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
            changeDate,
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
            data: { leaveDate: changeDate },
          });
        }

        await tx.student.update({ where: { id }, data: { currentGroupId: dto.currentGroupId } });
        await tx.studentGroupHistory.create({
          data: {
            studentId: id,
            groupId: dto.currentGroupId,
            changedBy: updatedBy,
            joinDate: changeDate,
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

      return tx.student.findUnique({ where: { id }, include: { status: true, program: true, currentGroup: { select: { id: true, name: true } } } });
    });

    return updated;
  }

  async getHistory(id: string, organizationId: string, user?: any) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId },
    });
    if (!student) throw new NotFoundException('Студент не найден');

    if (user) await this.findOne(id, organizationId, user);
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
