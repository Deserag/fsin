import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { UsersAdminService, CreateUserPayload } from '../../../core/services/users-admin.service';
import { RolesAdminService } from '../../../core/services/roles-admin.service';
import { GroupsService } from '../../../core/services/groups.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { AdminUser, Direction, Role } from '../../../core/models/admin.model';
import { Group } from '../../../core/models/group.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

interface UserFormState {
  id: string | null;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  roleIds: string[];
  groupScopeIds: string[];
  directionScopeIds: string[];
}

function emptyForm(): UserFormState {
  return {
    id: null,
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    roleIds: [],
    groupScopeIds: [],
    directionScopeIds: [],
  };
}

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './users-admin.component.html',
  styleUrl: './users-admin.component.scss',
})
export class UsersAdminComponent implements OnInit {
  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly groups = signal<Group[]>([]);
  readonly directions = signal<Direction[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<UserFormState>(emptyForm());

  constructor(
    private readonly usersService: UsersAdminService,
    private readonly rolesService: RolesAdminService,
    private readonly groupsService: GroupsService,
    private readonly referenceData: ReferenceDataService,
    private readonly toast: ToastService,
    private readonly confirmService: ConfirmService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    forkJoin({
      users: this.usersService.list(this.search()),
      roles: this.rolesService.list(),
      groups: this.groupsService.list(),
      directions: this.referenceData.directions(),
    }).subscribe({
      next: ({ users, roles, groups, directions }) => {
        this.users.set(users.data);
        this.roles.set(roles);
        this.groups.set(groups.data);
        this.directions.set(directions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Не удалось загрузить пользователей');
      },
    });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.usersService.list(value).subscribe((res) => this.users.set(res.data));
  }

  openCreate(): void {
    this.form.set(emptyForm());
    this.modalOpen.set(true);
  }

  openEdit(user: AdminUser): void {
    this.form.set({
      id: user.id,
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName ?? '',
      phone: user.phone ?? '',
      roleIds: user.roles.map((r) => r.role.id),
      groupScopeIds: user.groupScopes.map((g) => g.group.id),
      directionScopeIds: user.directionScopes.map((d) => d.direction.id),
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateField<K extends keyof UserFormState>(key: K, value: UserFormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  toggleRole(roleId: string): void {
    this.form.update((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((id) => id !== roleId) : [...f.roleIds, roleId],
    }));
  }

  toggleGroupScope(groupId: string): void {
    this.form.update((f) => ({
      ...f,
      groupScopeIds: f.groupScopeIds.includes(groupId)
        ? f.groupScopeIds.filter((id) => id !== groupId)
        : [...f.groupScopeIds, groupId],
    }));
  }

  toggleDirectionScope(directionId: string): void {
    this.form.update((f) => ({
      ...f,
      directionScopeIds: f.directionScopeIds.includes(directionId)
        ? f.directionScopeIds.filter((id) => id !== directionId)
        : [...f.directionScopeIds, directionId],
    }));
  }

  save(): void {
    const f = this.form();
    if (!f.firstName || !f.lastName || (!f.id && (!f.email || !f.password))) {
      this.toast.error('Заполните обязательные поля');
      return;
    }

    this.saving.set(true);

    if (f.id) {
      this.usersService
        .update(f.id, {
          firstName: f.firstName,
          lastName: f.lastName,
          middleName: f.middleName || undefined,
          phone: f.phone || undefined,
          roleIds: f.roleIds,
          groupScopeIds: f.groupScopeIds,
          directionScopeIds: f.directionScopeIds,
        })
        .subscribe({
          next: () => this.onSaved('Пользователь обновлён'),
          error: (err) => this.onSaveError(err),
        });
    } else {
      const payload: CreateUserPayload = {
        email: f.email,
        password: f.password,
        firstName: f.firstName,
        lastName: f.lastName,
        middleName: f.middleName || undefined,
        phone: f.phone || undefined,
        roleIds: f.roleIds,
        groupScopeIds: f.groupScopeIds,
        directionScopeIds: f.directionScopeIds,
      };
      this.usersService.create(payload).subscribe({
        next: () => this.onSaved('Пользователь создан'),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private onSaved(message: string): void {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.toast.success(message);
    this.loadAll();
  }

  private onSaveError(err: any): void {
    this.saving.set(false);
    this.toast.error(err.error?.message ?? 'Не удалось сохранить пользователя');
  }

  async toggleBlock(user: AdminUser): Promise<void> {
    if (user.isBlocked) {
      this.usersService.unblock(user.id).subscribe({
        next: () => {
          this.toast.success('Пользователь разблокирован');
          this.loadAll();
        },
        error: () => this.toast.error('Не удалось разблокировать'),
      });
      return;
    }

    const confirmed = await this.confirmService.ask({
      title: 'Заблокировать пользователя?',
      message: `${user.lastName} ${user.firstName} не сможет войти в систему.`,
      confirmLabel: 'Заблокировать',
      danger: true,
    });
    if (!confirmed) return;

    this.usersService.block(user.id, 'Заблокирован администратором').subscribe({
      next: () => {
        this.toast.success('Пользователь заблокирован');
        this.loadAll();
      },
      error: () => this.toast.error('Не удалось заблокировать'),
    });
  }

  roleLabel(user: AdminUser): string {
    return user.roles.map((r) => r.role.displayName).join(', ') || '—';
  }
}
