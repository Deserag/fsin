import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../models/group.model';
import {
  AttendancePeriod,
  AttendanceReason,
  AttendanceSheet,
  AttendanceSheetDetail,
  BulkRecordUpdate,
  SheetValidation,
} from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private readonly http: HttpClient) {}

  periods(): Observable<AttendancePeriod[]> {
    return this.http.get<AttendancePeriod[]>(`${environment.apiUrl}/settings/attendance-periods`);
  }

  reasons(): Observable<AttendanceReason[]> {
    return this.http.get<AttendanceReason[]>(`${environment.apiUrl}/attendance-reasons`);
  }

  findSheets(query: { groupId?: string; date?: string; periodId?: string } = {}): Observable<Paginated<AttendanceSheet>> {
    const params: Record<string, string> = {};
    if (query.groupId) params['groupId'] = query.groupId;
    if (query.periodId) params['periodId'] = query.periodId;
    if (query.date) {
      params['dateFrom'] = query.date;
      params['dateTo'] = query.date;
    }
    return this.http.get<Paginated<AttendanceSheet>>(`${environment.apiUrl}/attendance/sheets`, { params });
  }

  getSheet(id: string): Observable<AttendanceSheetDetail> {
    return this.http.get<AttendanceSheetDetail>(`${environment.apiUrl}/attendance/sheets/${id}`);
  }

  getValidation(id: string): Observable<SheetValidation> {
    return this.http.get<SheetValidation>(`${environment.apiUrl}/attendance/sheets/${id}/validation`);
  }

  createSheet(groupId: string, periodId: string, date: string): Observable<AttendanceSheet> {
    return this.http.post<AttendanceSheet>(`${environment.apiUrl}/attendance/sheets`, { groupId, periodId, date });
  }

  submitSheet(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${environment.apiUrl}/attendance/sheets/${id}/submit`, {});
  }

  reviewSheet(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${environment.apiUrl}/attendance/sheets/${id}/review`, {});
  }

  closeSheet(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${environment.apiUrl}/attendance/sheets/${id}/close`, {});
  }

  bulkUpdate(sheetId: string, updates: BulkRecordUpdate[]): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${environment.apiUrl}/attendance/records/bulk`, { sheetId, updates });
  }
}
