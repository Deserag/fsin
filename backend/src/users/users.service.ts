import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: any) {
    const { search, roleId, isActive, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { lastName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { login: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(roleId && { roles: { some: { roleId } } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, login: true, email: true, firstName: true, lastName: true, middleName: true,
          phone: true, isActive: true, isBlocked: true, lastLoginAt: true, createdAt: true,
          roles: { include: { role: true } },
          groupScopes: { include: { group: { select: { id: true, name: true } } } },
          directionScopes: { include: { direction: { select: { id: true, name: true } } } },
          programScopes: { include: { program: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true, login: true, email: true, firstName: true, lastName: true, middleName: true,
        phone: true, isActive: true, isBlocked: true, blockedAt: true, blockedReason: true,
        lastLoginAt: true, createdAt: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        groupScopes: { include: { group: { select: { id: true, name: true } } } },
        directionScopes: { include: { direction: { select: { id: true, name: true } } } },
        programScopes: { include: { program: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async create(dto: any, createdBy: string) {
    if (typeof dto.login !== 'string' || !dto.login.trim() || typeof dto.password !== 'string' || dto.password.length < 8) throw new BadRequestException('Укажите логин и пароль не короче 8 символов');
    dto.login = dto.login.trim();
    const existing = await this.prisma.user.findUnique({ where: { login: dto.login } });
    if (existing) throw new ConflictException('Пользователь с таким логином уже существует');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          organizationId: dto.organizationId,
          login: dto.login,
          email: dto.email || null,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName,
          phone: dto.phone,
        },
      });

      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId: string) => ({ userId: u.id, roleId })),
        });
      }

      if (dto.groupScopeIds?.length) {
        const count = await tx.group.count({ where: { id: { in: dto.groupScopeIds }, organizationId: dto.organizationId } });
        if (count !== new Set(dto.groupScopeIds).size) throw new BadRequestException('Группа другой организации');
        await tx.userGroupScope.createMany({ data: dto.groupScopeIds.map((groupId: string) => ({ userId: u.id, groupId })), skipDuplicates: true });
      }
      if (dto.directionScopeIds?.length) {
        const count = await tx.direction.count({ where: { id: { in: dto.directionScopeIds }, organizationId: dto.organizationId } });
        if (count !== new Set(dto.directionScopeIds).size) throw new BadRequestException('Направление другой организации');
        await tx.userDirectionScope.createMany({ data: dto.directionScopeIds.map((directionId: string) => ({ userId: u.id, directionId })), skipDuplicates: true });
      }
      if (dto.programScopeIds?.length) {
        const count = await tx.educationalProgram.count({ where: { id: { in: dto.programScopeIds }, organizationId: dto.organizationId } });
        if (count !== new Set(dto.programScopeIds).size) throw new BadRequestException('Образовательная программа другой организации');
        await tx.userProgramScope.createMany({ data: dto.programScopeIds.map((programId: string) => ({ userId: u.id, programId })), skipDuplicates: true });
      }
      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          userId: createdBy,
          action: 'CREATE',
          entityType: 'User',
          entityId: u.id,
          newValue: { email: u.email, firstName: u.firstName, lastName: u.lastName },
        },
      });

      return u;
    });

    return this.findOne(user.id, dto.organizationId);
  }

  async update(id: string, organizationId: string, dto: any, updatedBy: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Пользователь не найден');

    for (const [key, model] of [['groupScopeIds','group'],['directionScopeIds','direction'],['programScopeIds','educationalProgram']]) {
      if (dto[key]) {
        const count = await (this.prisma as any)[model].count({ where: { id: { in: dto[key] }, organizationId } });
        if (count !== new Set(dto[key]).size) throw new BadRequestException('Область доступа другой организации');
      }
    }
    const updateData: any = {};
    if (dto.login !== undefined) {
      if (typeof dto.login !== 'string' || !dto.login.trim()) throw new BadRequestException('Укажите логин');
      updateData.login = dto.login.trim();
    }
    if (dto.email !== undefined) updateData.email = dto.email || null;
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.middleName !== undefined) updateData.middleName = dto.middleName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: updateData });

      if (dto.roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId: string) => ({ userId: id, roleId })),
          });
        }
      }

      if (dto.groupScopeIds !== undefined) {
        await tx.userGroupScope.deleteMany({ where: { userId: id } });
        if (dto.groupScopeIds.length > 0) {
          await tx.userGroupScope.createMany({
            data: dto.groupScopeIds.map((groupId: string) => ({ userId: id, groupId })),
          });
        }
      }

      if (dto.directionScopeIds !== undefined) {
        await tx.userDirectionScope.deleteMany({ where: { userId: id } });
        if (dto.directionScopeIds.length > 0) {
          await tx.userDirectionScope.createMany({
            data: dto.directionScopeIds.map((directionId: string) => ({ userId: id, directionId })),
          });
        }
      }
      if (dto.programScopeIds !== undefined) {
        // Once edited in the new UI, program selections replace legacy direction-wide access.
        await tx.userDirectionScope.deleteMany({ where: { userId: id } });
        await tx.userProgramScope.deleteMany({ where: { userId: id } });
        if (dto.programScopeIds.length > 0) {
          await tx.userProgramScope.createMany({ data: dto.programScopeIds.map((programId: string) => ({ userId: id, programId })), skipDuplicates: true });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: updatedBy,
          action: 'UPDATE',
          entityType: 'User',
          entityId: id,
        },
      });
    });

    return this.findOne(id, organizationId);
  }

  async block(id: string, organizationId: string, reason: string, blockedBy: string) {
    await this.findOne(id, organizationId);
    await this.prisma.user.update({
      where: { id },
      data: { isBlocked: true, blockedAt: new Date(), blockedReason: reason },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async unblock(id: string, organizationId: string, unblockedBy: string) {
    await this.findOne(id, organizationId);
    await this.prisma.user.update({
      where: { id },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
  }
}
