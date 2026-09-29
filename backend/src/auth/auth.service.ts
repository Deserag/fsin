import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(login: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { login: login.trim() },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Неверный логин или пароль');
    if (!user.isActive) throw new UnauthorizedException('Учётная запись неактивна');
    if (user.isBlocked) throw new UnauthorizedException('Учётная запись заблокирована');

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) throw new UnauthorizedException('Неверный логин или пароль');

    return user;
  }

  async login(login: string, password: string) {
    const user = await this.validateUser(login, password);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );

    const payload = {
      sub: user.id,
      login: user.login,
      email: user.email,
      orgId: user.organizationId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshTokenValue = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        login: user.login,
      email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        organizationId: user.organizationId,
        roles,
        permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Недействительный refresh-токен');
    }

    if (!tokenRecord.user.isActive || tokenRecord.user.isBlocked) {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }



    const user = tokenRecord.user;
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );

    const payload = {
      sub: user.id,
      login: user.login,
      email: user.email,
      orgId: user.organizationId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const newRefreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({ where: { id: tokenRecord.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (claimed.count !== 1) throw new UnauthorizedException('Сессия уже обновлена');
      await tx.refreshToken.create({ data: { userId: user.id, token: newRefreshToken, expiresAt } });
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new BadRequestException('Текущий пароль неверен');

    const newHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        groupScopes: { include: { group: { select: { id: true, name: true } } } },
        directionScopes: { include: { direction: { select: { id: true, name: true } } } },
        programScopes: { include: { program: { select: { id: true, name: true, code: true } } } },
      },
    });

    if (!user) throw new NotFoundException('Пользователь не найден');

    return {
      id: user.id,
      login: user.login,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phone: user.phone,
      organizationId: user.organizationId,
      roles: user.roles.map((ur) => ur.role.name),
      permissions: user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      groupScopes: user.groupScopes.map((gs) => gs.group),
      directionScopes: user.directionScopes.map((ds) => ds.direction),
      programScopes: user.programScopes.map((ps) => ps.program),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) throw new BadRequestException('Укажите имя и фамилию');
    const account = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!account) throw new NotFoundException('Пользователь не найден');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        middleName: dto.middleName?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
      },
    });
    return this.getProfile(userId);
  }
}
