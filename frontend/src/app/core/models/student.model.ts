export interface Student {
  id: string;
  internalId: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  birthDate: string;
  enrollmentDate: string;
  graduationDate?: string | null;
  currentCourse: number;
  currentGroupId?: string | null;
  currentGroup?: { id: string; name: string } | null;
  status?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string } | null;
}
