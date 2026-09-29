import { ForbiddenException } from '@nestjs/common';
export function groupScope(user: any): any {
  if (!user?.organizationId) throw new ForbiddenException('Организация не определена');
  return { organizationId: user.organizationId, ...(user.roles?.includes('admin') ? {} : {
    OR: [{ id: { in: user.groupScopeIds ?? [] } }, { programId: { in: user.programScopeIds ?? [] } }, { directionId: { in: user.directionScopeIds ?? [] } }],
  }) };
}
export function assertGroup(group: any, user: any) {
  if (!group || group.organizationId !== user.organizationId || (!user.roles?.includes('admin') &&
    !(user.groupScopeIds ?? []).includes(group.id) && !(user.programScopeIds ?? []).includes(group.programId) && !(user.directionScopeIds ?? []).includes(group.directionId)))
    throw new ForbiddenException('Нет доступа к этой группе');
}
export function requirePermission(user: any, permission: string) {
  if (!user.roles?.includes('admin') && !user.permissions?.includes(permission)) throw new ForbiddenException('Недостаточно прав');
}
