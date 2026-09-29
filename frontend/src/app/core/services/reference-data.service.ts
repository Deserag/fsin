import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicYear, AttendanceField, Direction, EducationalProgram, StudentStatus } from '../models/admin.model';
import { AttendancePeriod, AttendanceReason } from '../models/attendance.model';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  constructor(private readonly http: HttpClient) {}

  listReference(path: string): Observable<any[]> { return this.http.get<any[]>(`${base}/${path}`); }
  saveReference(path: string, dto: any, id?: string) { return id ? this.http.patch(`${base}/${path}/${id}`, dto) : this.http.post(`${base}/${path}`, dto); }
  deleteReference(path: string, id: string) { return this.http.delete(`${base}/${path}/${id}`); }
  // Directions
  directions(): Observable<Direction[]> {
    return this.http.get<Direction[]>(`${base}/directions`);
  }
  createDirection(dto: Partial<Direction>): Observable<Direction> {
    return this.http.post<Direction>(`${base}/directions`, dto);
  }
  updateDirection(id: string, dto: Partial<Direction>): Observable<Direction> {
    return this.http.patch<Direction>(`${base}/directions/${id}`, dto);
  }

  // Programs
  programs(): Observable<EducationalProgram[]> {
    return this.http.get<EducationalProgram[]>(`${base}/programs`);
  }
  createProgram(dto: Partial<EducationalProgram>): Observable<EducationalProgram> {
    return this.http.post<EducationalProgram>(`${base}/programs`, dto);
  }
  updateProgram(id: string, dto: Partial<EducationalProgram>): Observable<EducationalProgram> {
    return this.http.patch<EducationalProgram>(`${base}/programs/${id}`, dto);
  }

  // Academic years
  academicYears(): Observable<AcademicYear[]> {
    return this.http.get<AcademicYear[]>(`${base}/academic-years`);
  }
  createAcademicYear(dto: Partial<AcademicYear>): Observable<AcademicYear> {
    return this.http.post<AcademicYear>(`${base}/academic-years`, dto);
  }
  setCurrentAcademicYear(id: string): Observable<AcademicYear> {
    return this.http.patch<AcademicYear>(`${base}/academic-years/${id}/set-current`, {});
  }

  // Student statuses
  statuses(): Observable<StudentStatus[]> {
    return this.http.get<StudentStatus[]>(`${base}/settings/student-statuses`);
  }
  createStatus(dto: Partial<StudentStatus>): Observable<StudentStatus> {
    return this.http.post<StudentStatus>(`${base}/settings/student-statuses`, dto);
  }

  // Attendance periods
  periods(): Observable<AttendancePeriod[]> {
    return this.http.get<AttendancePeriod[]>(`${base}/settings/attendance-periods`);
  }
  createPeriod(dto: Partial<AttendancePeriod>): Observable<AttendancePeriod> {
    return this.http.post<AttendancePeriod>(`${base}/settings/attendance-periods`, dto);
  }

  // Attendance reasons
  reasons(): Observable<AttendanceReason[]> {
    return this.http.get<AttendanceReason[]>(`${base}/attendance-reasons`);
  }
  createReason(dto: Partial<AttendanceReason>): Observable<AttendanceReason> {
    return this.http.post<AttendanceReason>(`${base}/attendance-reasons`, dto);
  }
  updateReason(id: string, dto: Partial<AttendanceReason>): Observable<AttendanceReason> {
    return this.http.patch<AttendanceReason>(`${base}/attendance-reasons/${id}`, dto);
  }

  // Attendance fields (табель settings)
  fields(): Observable<AttendanceField[]> {
    return this.http.get<AttendanceField[]>(`${base}/settings/attendance-fields`);
  }
  createField(dto: Partial<AttendanceField>): Observable<AttendanceField> {
    return this.http.post<AttendanceField>(`${base}/settings/attendance-fields`, dto);
  }
  updateField(id: string, dto: Partial<AttendanceField>): Observable<AttendanceField> {
    return this.http.patch<AttendanceField>(`${base}/settings/attendance-fields/${id}`, dto);
  }
}
