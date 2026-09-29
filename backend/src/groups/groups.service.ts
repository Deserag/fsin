import { groupScope, assertGroup } from '../auth/scope.js';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, userContext: any, query: any) {
    const { search, directionId, academicYearId, isActive, isArchived, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...groupScope(userContext),
      ...(isActive !== undefined && { isActive: String(isActive) === 'true' }),
      ...(isArchived !== undefined && { isArchived: String(isArchived) === 'true' }),
      ...(directionId && { directionId }),
      ...(academicYearId && { academicYearId }),

      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          direction: true,
          program: true,
          academicYear: true,
          foremanHistory: {
            where: { isActive: true },
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
            take: 1,
          },
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.group.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, organizationId: string, userContext: any) {
    const group = await this.prisma.group.findFirst({
      where: { id, organizationId },
      include: {
        direction: true,
        program: true,
        academicYear: true,
        foremanHistory: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { startDate: 'desc' },
        },
        students: {
          where: { isActive: true },
          include: { status: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
        _count: { select: { students: true, attendanceSheets: true } },
      },
    });
    if (!group) throw new NotFoundException('Группа не найдена');
    assertGroup(group, userContext);
    return group;
  }

  async create(dto: any, organizationId: string, createdBy: string) {
    if (dto.programId) { const program = await this.prisma.educationalProgram.findFirst({ where: { id: dto.programId, organizationId } }); if (!program) throw new BadRequestException('Образовательная программа не найдена'); dto.directionId = program.directionId; }
    const group = await this.prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: { ...dto, organizationId },
        include: { direction: true, program: true, academicYear: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: createdBy,
          action: 'CREATE',
          entityType: 'Group',
          entityId: g.id,
          newValue: { name: g.name },
        },
      });

      return g;
    });
    return group;
  }

  async update(id: string, organizationId: string, dto: any, updatedBy: string) {
    const existing = await this.prisma.group.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Группа не найдена');

    if (dto.programId !== undefined) {
      const program = await this.prisma.educationalProgram.findFirst({ where: { id: dto.programId, organizationId } });
      if (!program) throw new BadRequestException('Образовательная программа не найдена');
      dto.directionId = program.directionId;
    }
    if (dto.academicYearId !== undefined) {
      const year = await this.prisma.academicYear.findFirst({ where: { id: dto.academicYearId, organizationId } });
      if (!year) throw new BadRequestException('Учебный год не найден');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const g = await tx.group.update({
        where: { id },
        data: dto,
        include: { direction: true, program: true },
      });
      if (dto.programId && dto.programId !== existing.programId) {
        await tx.student.updateMany({
          where: { currentGroupId: id, programId: existing.programId },
          data: { programId: dto.programId },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: updatedBy,
          action: 'UPDATE',
          entityType: 'Group',
          entityId: id,
          oldValue: { name: existing.name, programId: existing.programId, isActive: existing.isActive },
          newValue: { name: g.name, programId: g.programId, isActive: g.isActive },
        },
      });
      return g;
    });
    return updated;
  }

  async assignForeman(groupId: string, userId: string, organizationId: string, assignedBy: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, isActive: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    await this.prisma.$transaction(async (tx) => {
      // Deactivate current foreman
      await tx.groupForeman.updateMany({
        where: { groupId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });

      // Create new foreman
      await tx.groupForeman.create({
        data: { groupId, userId, isActive: true },
      });

      // Add group scope for user
      await tx.userGroupScope.upsert({
        where: { userId_groupId: { userId, groupId } },
        create: { userId, groupId },
        update: {},
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: assignedBy,
          action: 'ASSIGN_FOREMAN',
          entityType: 'Group',
          entityId: groupId,
          newValue: { foremanId: userId, foremanName: `${user.lastName} ${user.firstName}` },
        },
      });
    });

    return { message: 'Сотрудник УСП назначен', foremanId: userId };
  }

  async restore(id: string, organizationId: string, userId: string) {
    return this.prisma.$transaction(async tx => {
      const group = await tx.group.update({ where: { id, organizationId }, data: { isArchived: false, isActive: true, archivedAt: null } });
      await tx.auditLog.create({ data: { organizationId, userId, action: 'RESTORE', entityType: 'Group', entityId: id } });
      return group;
    });
  }
  async archive(id: string, organizationId: string, archivedBy: string) {
    const group = await this.prisma.group.findFirst({ where: { id, organizationId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id },
        data: { isArchived: true, isActive: false, archivedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: archivedBy,
          action: 'ARCHIVE',
          entityType: 'Group',
          entityId: id,
          newValue: { name: group.name },
        },
      });
    });

    return { message: 'Группа архивирована' };
  }
}
