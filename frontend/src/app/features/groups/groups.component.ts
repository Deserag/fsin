import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { GroupsService } from '../../core/services/groups.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { UsersAdminService } from '../../core/services/users-admin.service';
import { Group } from '../../core/models/group.model';
import { AcademicYear, AdminUser, Direction, EducationalProgram } from '../../core/models/admin.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmService } from '../../shared/services/confirm.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

interface GroupFormState {
  id: string | null;
  name: string;
  directionId: string;
  programId: string;
  academicYearId: string;
  currentCourse: number;
}

function emptyForm(): GroupFormState {
  return { id: null, name: '', directionId: '', programId: '', academicYearId: '', currentCourse: 1 };
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
})
export class GroupsComponent implements OnInit {
  readonly groups = signal<Group[]>([]);
  readonly directions = signal<Direction[]>([]);
  readonly programs = signal<EducationalProgram[]>([]);
  readonly academicYears = signal<AcademicYear[]>([]);
  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<GroupFormState>(emptyForm());

  readonly foremanModalGroup = signal<Group | null>(null);
  readonly selectedForemanId = signal<string>('');

  constructor(
    private readonly groupsService: GroupsService,
    private readonly referenceData: ReferenceDataService,
    private readonly usersService: UsersAdminService,
    readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly confirmService: ConfirmService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      groups: this.groupsService.list(),
      directions: this.referenceData.directions(),
      programs: this.referenceData.programs(),
      academicYears: this.referenceData.academicYears(),
      users: this.usersService.list(),
    }).subscribe({
      next: ({ groups, directions, programs, academicYears, users }) => {
        this.groups.set(groups.data);
        this.directions.set(directions);
        this.programs.set(programs);
        this.academicYears.set(academicYears);
        this.users.set(users.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  programsForDirection(directionId: string): EducationalProgram[] {
    return this.programs().filter((p) => p.directionId === directionId);
  }

  openCreate(): void {
    this.form.set(emptyForm());
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateField<K extends keyof GroupFormState>(key: K, value: GroupFormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.name || !f.directionId || !f.programId || !f.academicYearId) {
      this.toast.error('Заполните обязательные поля');
      return;
    }

    this.saving.set(true);
    this.groupsService
      .create({
        name: f.name,
        directionId: f.directionId,
        programId: f.programId,
        academicYearId: f.academicYearId,
        currentCourse: Number(f.currentCourse),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success('Группа создана');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err.error?.message ?? 'Не удалось создать группу');
        },
      });
  }

  currentForeman(group: Group): string {
    const active = group.foremanHistory?.find((f) => f.isActive);
    if (!active) return '—';
    return `${active.user.lastName} ${active.user.firstName}`;
  }

  openForemanModal(group: Group): void {
    this.foremanModalGroup.set(group);
    this.selectedForemanId.set('');
  }

  closeForemanModal(): void {
    this.foremanModalGroup.set(null);
  }

  assignForeman(): void {
    const group = this.foremanModalGroup();
    const userId = this.selectedForemanId();
    if (!group || !userId) return;

    this.groupsService.assignForeman(group.id, userId).subscribe({
      next: () => {
        this.toast.success('Старшина назначен');
        this.foremanModalGroup.set(null);
        this.load();
      },
      error: (err) => this.toast.error(err.error?.message ?? 'Не удалось назначить старшину'),
    });
  }

  async archive(group: Group): Promise<void> {
    const confirmed = await this.confirmService.ask({
      title: 'Архивировать группу?',
      message: `Группа «${group.name}» будет помечена как неактивная.`,
      confirmLabel: 'Архивировать',
      danger: true,
    });
    if (!confirmed) return;

    this.groupsService.archive(group.id).subscribe({
      next: () => {
        this.toast.success('Группа архивирована');
        this.load();
      },
      error: () => this.toast.error('Не удалось архивировать группу'),
    });
  }
}
