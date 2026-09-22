import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string, query: any) {
    const { userId, entityType, action, dateFrom, dateTo } = query;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;
    const where: any = {
      organizationId,
      ...(userId && { userId }),
      ...(entityType && { entityType }),
      ...(action && { action }),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } }
        : {}),
    };
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }));
  }
}
