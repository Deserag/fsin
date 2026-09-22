export interface Group {
  id: string;
  name: string;
  currentCourse: number;
  isActive: boolean;
  isArchived: boolean;
  direction?: { id: string; name: string; shortName: string } | null;
  program?: { id: string; name: string; shortName: string } | null;
  academicYear?: { id: string; name: string } | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
