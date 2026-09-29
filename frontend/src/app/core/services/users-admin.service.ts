import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../models/group.model';
import { AdminUser } from '../models/admin.model';

export interface CreateUserPayload {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  roleIds: string[];
  groupScopeIds?: string[];
  programScopeIds?: string[];
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>> & { isActive?: boolean };

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  constructor(private readonly http: HttpClient) {}

  list(search = ''): Observable<Paginated<AdminUser>> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    return this.http.get<Paginated<AdminUser>>(`${environment.apiUrl}/users`, { params });
  }

  create(payload: CreateUserPayload): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${environment.apiUrl}/users`, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${environment.apiUrl}/users/${id}`, payload);
  }

  block(id: string, reason: string): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/users/${id}/block`, { reason });
  }

  unblock(id: string): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/users/${id}/unblock`, {});
  }
}
