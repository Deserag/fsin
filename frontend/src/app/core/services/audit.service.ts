import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../models/group.model';
import { AuditLogEntry } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private readonly http: HttpClient) {}

  list(page = 1, limit = 50): Observable<Paginated<AuditLogEntry>> {
    return this.http.get<Paginated<AuditLogEntry>>(`${environment.apiUrl}/audit`, {
      params: { page: String(page), limit: String(limit) },
    });
  }
}
