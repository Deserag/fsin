import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { RolesAdminService } from '../../../core/services/roles-admin.service';
import { Permission, Role } from '../../../core/models/admin.model';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-roles-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles-admin.component.html',
  styleUrl: './roles-admin.component.scss',
})
export class RolesAdminComponent implements OnInit {
  readonly roles = signal<Role[]>([]);
  readonly permissions = signal<Permission[]>([]);
  readonly loading = signal(true);
  readonly pending = signal<Set<string>>(new Set());

  readonly modules = computed(() => {
    const set = new Set(this.permissions().map((p) => p.module));
    return Array.from(set).sort();
  });

  constructor(private readonly rolesService: RolesAdminService, private readonly toast: ToastService) {}

  ngOnInit(): void {
    forkJoin({ roles: this.rolesService.list(), permissions: this.rolesService.permissions() }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles.set(roles);
        this.permissions.set(permissions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Не удалось загрузить роли');
      },
    });
  }

  modulePermissions(module: string): Permission[] {
    return this.permissions().filter((p) => p.module === module);
  }

  hasPermission(role: Role, permissionId: string): boolean {
    return role.permissions.some((rp) => rp.permission.id === permissionId);
  }

  isPending(roleId: string, permissionId: string): boolean {
    return this.pending().has(`${roleId}:${permissionId}`);
  }

  toggle(role: Role, permission: Permission): void {
    if (role.isSystem && role.name === 'admin') {
      this.toast.info('Права администратора нельзя изменить');
      return;
    }

    const key = `${role.id}:${permission.id}`;
    const granted = !this.hasPermission(role, permission.id);

    this.pending.update((set) => new Set(set).add(key));

    this.rolesService.setPermission(role.id, permission.id, granted).subscribe({
      next: (updated) => {
        this.roles.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.pending.update((set) => {
          const next = new Set(set);
          next.delete(key);
          return next;
        });
      },
      error: () => {
        this.toast.error('Не удалось изменить право');
        this.pending.update((set) => {
          const next = new Set(set);
          next.delete(key);
          return next;
        });
      },
    });
  }
}
