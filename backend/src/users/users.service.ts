import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
          id: true, email: true, firstName: true, lastName: true, middleName: true,
          phone: true, isActive: true, isBlocked: true, lastLoginAt: true, createdAt: true,
          roles: { include: { role: true } },
          groupScopes: { include: { group: { select: { id: true, name: true } } } },
          directionScopes: { include: { direction: { select: { id: true, name: true } } } },
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
        id: true, email: true, firstName: true, lastName: true, middleName: true,
        phone: true, isActive: true, isBlocked: true, blockedAt: true, blockedReason: true,
        lastLoginAt: true, createdAt: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        groupScopes: { include: { group: { select: { id: true, name: true } } } },
        directionScopes: { include: { direction: { select: { id: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async create(dto: any, createdBy: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          organizationId: dto.organizationId,
          email: dto.email,
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

    const updateData: any = {};
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
    await this.prisma.user.update({
      where: { id },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
  }
}
