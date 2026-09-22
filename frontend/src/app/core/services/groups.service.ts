import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Group, Paginated } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class GroupsService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Paginated<Group>> {
    return this.http.get<Paginated<Group>>(`${environment.apiUrl}/groups`);
  }

  get(id: string): Observable<Group> {
    return this.http.get<Group>(`${environment.apiUrl}/groups/${id}`);
  }
}
