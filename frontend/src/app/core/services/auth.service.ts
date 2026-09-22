import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginResponse, RoleCode } from '../models/user.model';

const TOKEN_KEY = 'fsin_access_token';
const USER_KEY = 'fsin_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<CurrentUser | null>(this.restoreUser());
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly roles = computed<RoleCode[]>(() => this.currentUserSignal()?.roles ?? []);
  readonly isAdmin = computed(() => this.roles().includes('admin'));
  readonly isManager = computed(() => this.roles().includes('manager'));
  readonly isForeman = computed(() => this.roles().includes('foreman'));

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  get token(): string | null {
    return this.tokenSignal();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this.tokenSignal.set(res.accessToken);
        this.currentUserSignal.set(res.user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  hasPermission(permission: string): boolean {
    return this.currentUserSignal()?.permissions.includes(permission) ?? false;
  }

  private restoreUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      return null;
    }
  }
}
