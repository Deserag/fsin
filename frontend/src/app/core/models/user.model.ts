export type RoleCode = 'admin' | 'manager' | 'foreman';

export interface CurrentUser {
  id: string;
  login: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  organizationId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}
