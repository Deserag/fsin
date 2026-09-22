import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardSheet {
  id: string;
  status: string;
  totalCount: number;
  presentCount: number;
  absentCount: number;
  group: { id: string; name: string };
  period: { id: string; name: string };
}

export interface DashboardGroupSummary {
  id: string;
  name: string;
  currentCourse: number;
  _count: { students: number };
}

export interface DashboardData {
  role: 'admin' | 'manager' | 'foreman';
  // admin
  studentCount?: number;
  groupCount?: number;
  userCount?: number;
  recentAuditLogs?: Array<{ id: string; action: string; entityType: string; createdAt: string; user: { firstName: string; lastName: string } }>;
  // foreman
  myGroups?: DashboardGroupSummary[];
  // manager
  groups?: DashboardGroupSummary[];
  unfilledSheetsToday?: number;
  todaySheets: DashboardSheet[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly http: HttpClient) {}

  dashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${environment.apiUrl}/reports/dashboard`);
  }
}
