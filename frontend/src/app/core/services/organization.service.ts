import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Organization } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private readonly http: HttpClient) {}

  get(): Observable<Organization> {
    return this.http.get<Organization>(`${environment.apiUrl}/organization`);
  }

  update(dto: Partial<Organization>): Observable<Organization> {
    return this.http.patch<Organization>(`${environment.apiUrl}/organization`, dto);
  }
}
