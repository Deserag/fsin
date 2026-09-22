import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../models/group.model';
import { Student } from '../models/student.model';

export interface StudentsQuery {
  page?: number;
  limit?: number;
  groupId?: string;
  search?: string;
}

export interface CourseTransitionPreview {
  transitions: {
    studentId: string;
    studentName: string;
    fromCourse: number;
    toCourse: number | null;
    action: 'PROMOTE' | 'GRADUATE' | 'SKIP';
    reason?: string;
  }[];
  summary: {
    total: number;
    toPromote: number;
    toGraduate: number;
    toSkip: number;
    byTransition: Record<string, number>;
  };
}

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class StudentsService {
  constructor(private readonly http: HttpClient) {}

  list(query: StudentsQuery = {}): Observable<Paginated<Student>> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    if (query.groupId) params['groupId'] = query.groupId;
    if (query.search) params['search'] = query.search;
    return this.http.get<Paginated<Student>>(`${base}/students`, { params });
  }

  get(id: string): Observable<Student> {
    return this.http.get<Student>(`${base}/students/${id}`);
  }

  create(dto: Record<string, unknown>): Observable<Student> {
    return this.http.post<Student>(`${base}/students`, dto);
  }

  update(id: string, dto: Record<string, unknown>): Observable<Student> {
    return this.http.patch<Student>(`${base}/students/${id}`, dto);
  }

  history(id: string): Observable<unknown> {
    return this.http.get(`${base}/students/${id}/history`);
  }

  previewCourseTransition(): Observable<CourseTransitionPreview> {
    return this.http.get<CourseTransitionPreview>(`${base}/students/course-transition/preview`);
  }

  executeCourseTransition(): Observable<unknown> {
    return this.http.post(`${base}/students/course-transition/execute`, { confirmed: true });
  }
}
