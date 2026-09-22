import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permission, Role } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class RolesAdminService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Role[]> {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }

  permissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${environment.apiUrl}/roles/permissions`);
  }

  setPermission(roleId: string, permissionId: string, granted: boolean): Observable<Role> {
    return this.http.patch<Role>(`${environment.apiUrl}/roles/${roleId}/permissions/${permissionId}`, { granted });
  }
}
