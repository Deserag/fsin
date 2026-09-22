import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface JwtPayload {
  sub: string;        // userId
  email: string;
  orgId: string;      // organizationId
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'fallback-secret-change-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        groupScopes: true,
        directionScopes: true,
      },
    });

    if (!user || !user.isActive || user.isBlocked) {
      return null;
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );
    const groupScopeIds = user.groupScopes.map((gs) => gs.groupId);
    const directionScopeIds = user.directionScopes.map((ds) => ds.directionId);

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      roles,
      permissions,
      groupScopeIds,
      directionScopeIds,
    };
  }
}
