import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'students',
        loadComponent: () => import('./features/students/students.component').then((m) => m.StudentsComponent),
      },
      {
        path: 'groups',
        loadComponent: () => import('./features/groups/groups.component').then((m) => m.GroupsComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/admin/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/users/users-admin.component').then((m) => m.UsersAdminComponent),
      },
      {
        path: 'admin/roles',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/roles/roles-admin.component').then((m) => m.RolesAdminComponent),
      },
      {
        path: 'admin/reference',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/reference-data/reference-data.component').then((m) => m.ReferenceDataComponent),
      },
      {
        path: 'admin/imports',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/imports/imports-wizard.component').then((m) => m.ImportsWizardComponent),
      },
      {
        path: 'admin/course-transition',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/course-transition/course-transition.component').then((m) => m.CourseTransitionComponent),
      },
      {
        path: 'admin/organization',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/organization/organization.component').then((m) => m.OrganizationComponent),
      },
      {
        path: 'admin/audit',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/audit/audit-log.component').then((m) => m.AuditLogComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
