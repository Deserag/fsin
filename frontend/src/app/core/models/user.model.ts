export type RoleCode = 'admin' | 'manager' | 'foreman';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  organizationId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}
