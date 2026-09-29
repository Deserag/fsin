import type { Prisma } from '@prisma/client';
import { rosterReasons } from '../src/attendance/roster-reasons.js';

// Column captions supplied in the user's real 08:00 строевая записка.
// Abbreviations such as ЗУБ and УП remain unexpanded because the source does not define them.
export async function updateRosterReferenceData(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.attendancePeriod.updateMany({
    where: { organizationId, code: 'MORNING', startTime: null },
    data: { startTime: '08:00' },
  });
  for (const [sortOrder, reason] of rosterReasons.entries()) {
    await tx.attendanceReason.upsert({
      where: { organizationId_code: { organizationId, code: reason.code } },
      update: { category: reason.category },
      create: { organizationId, ...reason, sortOrder: sortOrder + 20 },
    });
  }
}
