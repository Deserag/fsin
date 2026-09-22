export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { permission: Permission }[];
}

export interface Permission {
  id: string;
  code: string;
  displayName: string;
  module: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  isActive: boolean;
  isBlocked: boolean;
  lastLoginAt?: string | null;
  roles: { role: { id: string; name: string; displayName: string } }[];
  groupScopes: { group: { id: string; name: string } }[];
  directionScopes: { direction: { id: string; name: string } }[];
}

export interface Direction {
  id: string;
  code: string;
  name: string;
  shortName: string;
  isActive: boolean;
  _count?: { programs: number; groups: number };
}

export interface EducationalProgram {
  id: string;
  code: string;
  name: string;
  shortName: string;
  directionId: string;
  durationYears: number;
  maxCourse: number;
  isActive: boolean;
  direction?: { id: string; name: string };
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface StudentStatus {
  id: string;
  code: string;
  name: string;
  isTerminal: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type AttendanceFieldType = 'BOOLEAN' | 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'TIME';

export interface AttendanceField {
  id: string;
  code: string;
  name: string;
  fieldType: AttendanceFieldType;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Organization {
  id: string;
  name: string;
  shortName: string;
  code?: string | null;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}
