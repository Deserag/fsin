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

@Injectable({ providedIn: 'root' })
export class StudentsService {
  constructor(private readonly http: HttpClient) {}

  list(query: StudentsQuery = {}): Observable<Paginated<Student>> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    if (query.groupId) params['groupId'] = query.groupId;
    if (query.search) params['search'] = query.search;
    return this.http.get<Paginated<Student>>(`${environment.apiUrl}/students`, { params });
  }

  get(id: string): Observable<Student> {
    return this.http.get<Student>(`${environment.apiUrl}/students/${id}`);
  }
}
