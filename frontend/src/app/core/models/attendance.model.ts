export type AttendanceSheetStatus = 'DRAFT' | 'FILLED' | 'SUBMITTED' | 'REVIEWED' | 'CLOSED';

export interface AttendancePeriod {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface AttendanceReason {
  id: string;
  code: string;
  name: string;
  requiresNote: boolean;
}

export interface AttendanceSheet {
  id: string;
  groupId: string;
  periodId: string;
  date: string;
  status: AttendanceSheetStatus;
  totalCount: number;
  presentCount: number;
  absentCount: number;
  group?: { id: string; name: string };
  period?: AttendancePeriod;
}

export interface AttendanceRecord {
  id: string;
  sheetId: string;
  studentId: string;
  isPresent: boolean;
  reasonId?: string | null;
  note?: string | null;
  student: { id: string; firstName: string; lastName: string; middleName?: string | null; currentCourse: number };
  reason?: AttendanceReason | null;
}

export interface AttendanceSheetDetail extends AttendanceSheet {
  records: AttendanceRecord[];
}

export interface SheetValidation {
  totalStudents: number;
  totalMarked: number;
  presentCount: number;
  absentCount: number;
  unmarked: number;
  absentWithoutReasonCount: number;
  isComplete: boolean;
  isValid: boolean;
  absentWithoutReason: { studentId: string; studentName: string }[];
}

export interface BulkRecordUpdate {
  studentId: string;
  isPresent: boolean;
  reasonId?: string;
  note?: string;
}
