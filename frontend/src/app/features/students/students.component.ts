import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { StudentsService } from '../../core/services/students.service';
import { GroupsService } from '../../core/services/groups.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Student } from '../../core/models/student.model';
import { Group } from '../../core/models/group.model';
import { EducationalProgram, StudentStatus } from '../../core/models/admin.model';
import { ToastService } from '../../shared/services/toast.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';

interface StudentFormState {
  effectiveDate: string;
  id: string | null;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  birthDate: string;
  enrollmentDate: string;
  currentCourse: number;
  programId: string;
  statusId: string;
  currentGroupId: string;
}

function emptyForm(): StudentFormState {
  return {
    effectiveDate: new Date().toISOString().slice(0,10),
    id: null,
    lastName: '',
    firstName: '',
    middleName: '',
    gender: '',
    birthDate: '',
    enrollmentDate: '',
    currentCourse: 1,
    programId: '',
    statusId: '',
    currentGroupId: '',
  };
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  readonly students = signal<Student[]>([]);
  readonly groups = signal<Group[]>([]);
  readonly programs = signal<EducationalProgram[]>([]);
  readonly statuses = signal<StudentStatus[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly total = signal(0);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<StudentFormState>(emptyForm());

  constructor(
    private readonly studentsService: StudentsService,
    private readonly groupsService: GroupsService,
    private readonly referenceData: ReferenceDataService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadReference();
    this.load();
  }

  private loadReference(): void {
    forkJoin({
      groups: this.groupsService.list(),
      programs: this.referenceData.programs(),
      statuses: this.referenceData.statuses(),
    }).subscribe(({ groups, programs, statuses }) => {
      this.groups.set(groups.data);
      this.programs.set(programs);
      this.statuses.set(statuses);
    });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.studentsService.list({ search: this.search() || undefined, limit: 50 }).subscribe({
      next: (res) => {
        this.students.set(res.data);
        this.total.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.form.set(emptyForm());
    this.modalOpen.set(true);
  }

  openEdit(s: Student): void {
    this.form.set({
      effectiveDate: new Date().toISOString().slice(0,10),
      id: s.id,
      lastName: s.lastName,
      firstName: s.firstName,
      middleName: s.middleName ?? '',
      gender: s.gender ?? '',
      birthDate: s.birthDate?.slice(0, 10) ?? '',
      enrollmentDate: s.enrollmentDate?.slice(0, 10) ?? '',
      currentCourse: s.currentCourse,
      programId: s.program?.id ?? '',
      statusId: s.status?.id ?? '',
      currentGroupId: s.currentGroupId ?? '',
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateField<K extends keyof StudentFormState>(key: K, value: StudentFormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.lastName || !f.firstName || !f.statusId) {
      this.toast.error('Заполните обязательные поля');
      return;
    }

    const payload = {
      ...(f.id && {effectiveDate: f.effectiveDate}),
      lastName: f.lastName,
      firstName: f.firstName,
      middleName: f.middleName || undefined,
      gender: f.gender || undefined,
      birthDate: f.birthDate || undefined,
      enrollmentDate: f.enrollmentDate || undefined,
      currentCourse: Number(f.currentCourse),
      programId: f.programId || undefined,
      statusId: f.statusId,
      currentGroupId: f.currentGroupId || undefined,
    };

    this.saving.set(true);
    const req = f.id ? this.studentsService.update(f.id, payload) : this.studentsService.create(payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(f.id ? 'Студент обновлён' : 'Студент создан');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err.error?.message ?? 'Не удалось сохранить');
      },
    });
  }
}
