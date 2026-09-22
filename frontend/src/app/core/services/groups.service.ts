import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Group, Paginated } from '../models/group.model';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class GroupsService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Paginated<Group>> {
    return this.http.get<Paginated<Group>>(`${base}/groups`);
  }

  get(id: string): Observable<Group> {
    return this.http.get<Group>(`${base}/groups/${id}`);
  }

  create(dto: Record<string, unknown>): Observable<Group> {
    return this.http.post<Group>(`${base}/groups`, dto);
  }

  update(id: string, dto: Record<string, unknown>): Observable<Group> {
    return this.http.patch<Group>(`${base}/groups/${id}`, dto);
  }

  assignForeman(groupId: string, userId: string): Observable<unknown> {
    return this.http.post(`${base}/groups/${groupId}/foreman`, { userId });
  }

  archive(id: string): Observable<unknown> {
    return this.http.patch(`${base}/groups/${id}/archive`, {});
  }
}
