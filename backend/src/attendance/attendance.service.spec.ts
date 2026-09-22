import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';

function mockPrisma() {
  return {
    attendanceSheet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    attendanceRecord: {
      upsert: vi.fn(),
      groupBy: vi.fn(),
    },
  } as any;
}

describe('AttendanceService.updateRecord', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: AttendanceService;
  const userContext = { id: 'user-1', roles: ['foreman'], groupScopeIds: ['group-1'] };

  beforeEach(() => {
    prisma = mockPrisma();
    service = new AttendanceService(prisma);
  });

  it('rejects marking a student absent without a reason', async () => {
    prisma.attendanceSheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      groupId: 'group-1',
      status: 'DRAFT',
      group: {},
    });

    await expect(
      service.updateRecord('sheet-1', 'student-1', { isPresent: false }, userContext),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it('accepts marking a student absent when a reason is provided', async () => {
    prisma.attendanceSheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      groupId: 'group-1',
      status: 'DRAFT',
      group: {},
    });
    prisma.attendanceRecord.upsert.mockResolvedValue({ id: 'record-1' });
    prisma.attendanceRecord.groupBy.mockResolvedValue([]);

    await service.updateRecord('sheet-1', 'student-1', { isPresent: false, reasonId: 'reason-1' }, userContext);

    expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPresent: false, reasonId: 'reason-1' }),
      }),
    );
  });

  it('rejects editing a closed sheet', async () => {
    prisma.attendanceSheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      groupId: 'group-1',
      status: 'CLOSED',
      group: {},
    });

    await expect(
      service.updateRecord('sheet-1', 'student-1', { isPresent: true }, userContext),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects updating a record for a group outside the user scope', async () => {
    prisma.attendanceSheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      groupId: 'other-group',
      status: 'DRAFT',
      group: {},
    });

    await expect(
      service.updateRecord('sheet-1', 'student-1', { isPresent: true }, userContext),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException for a missing sheet', async () => {
    prisma.attendanceSheet.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRecord('missing-sheet', 'student-1', { isPresent: true }, userContext),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
