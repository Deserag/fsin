import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { AcademicYear, AttendanceField, AttendanceFieldType, Direction, EducationalProgram, StudentStatus } from '../../../core/models/admin.model';
import { AttendancePeriod, AttendanceReason } from '../../../core/models/attendance.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

type TabKey = 'directions' | 'programs' | 'academicYears' | 'statuses' | 'periods' | 'reasons' | 'fields';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'directions', label: 'Направления' },
  { key: 'programs', label: 'Программы' },
  { key: 'academicYears', label: 'Учебные годы' },
  { key: 'statuses', label: 'Статусы студентов' },
  { key: 'periods', label: 'Периоды посещаемости' },
  { key: 'reasons', label: 'Причины отсутствия' },
  { key: 'fields', label: 'Поля табеля' },
];

const FIELD_TYPES: { value: AttendanceFieldType; label: string }[] = [
  { value: 'BOOLEAN', label: 'Да/Нет' },
  { value: 'TEXT', label: 'Текст' },
  { value: 'NUMBER', label: 'Число' },
  { value: 'SELECT', label: 'Список (один вариант)' },
  { value: 'MULTI_SELECT', label: 'Список (несколько вариантов)' },
  { value: 'DATE', label: 'Дата' },
  { value: 'TIME', label: 'Время' },
];

@Component({
  selector: 'app-reference-data',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './reference-data.component.html',
  styleUrl: './reference-data.component.scss',
})
export class ReferenceDataComponent implements OnInit {
  readonly tabs = TABS;
  readonly fieldTypes = FIELD_TYPES;
  readonly activeTab = signal<TabKey>('directions');
  readonly loading = signal(true);

  readonly directions = signal<Direction[]>([]);
  readonly programs = signal<EducationalProgram[]>([]);
  readonly academicYears = signal<AcademicYear[]>([]);
  readonly statuses = signal<StudentStatus[]>([]);
  readonly periods = signal<AttendancePeriod[]>([]);
  readonly reasons = signal<AttendanceReason[]>([]);
  readonly fields = signal<AttendanceField[]>([]);
  readonly newFieldOptions = signal('');

  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<Record<string, any>>({});

  constructor(private readonly refData: ReferenceDataService, private readonly toast: ToastService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    Promise.all([
      firstValueFrom(this.refData.directions()).then((d) => this.directions.set(d ?? [])),
      firstValueFrom(this.refData.programs()).then((d) => this.programs.set(d ?? [])),
      firstValueFrom(this.refData.academicYears()).then((d) => this.academicYears.set(d ?? [])),
      firstValueFrom(this.refData.statuses()).then((d) => this.statuses.set(d ?? [])),
      firstValueFrom(this.refData.periods()).then((d) => this.periods.set(d ?? [])),
      firstValueFrom(this.refData.reasons()).then((d) => this.reasons.set(d ?? [])),
      firstValueFrom(this.refData.fields()).then((d) => this.fields.set(d ?? [])),
    ])
      .then(() => this.loading.set(false))
      .catch(() => {
        this.loading.set(false);
        this.toast.error('Не удалось загрузить справочники');
      });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  openCreate(): void {
    this.form.set({ isActive: true, fieldType: 'TEXT' });
    this.newFieldOptions.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateForm(key: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  save(): void {
    const tab = this.activeTab();
    const f = this.form();
    this.saving.set(true);

    const done = (label: string) => {
      this.saving.set(false);
      this.modalOpen.set(false);
      this.toast.success(label);
      this.loadAll();
    };
    const fail = (err: any) => {
      this.saving.set(false);
      this.toast.error(err.error?.message ?? 'Не удалось сохранить');
    };

    switch (tab) {
      case 'directions':
        this.refData.createDirection({ code: f['code'], name: f['name'], shortName: f['shortName'] }).subscribe({
          next: () => done('Направление добавлено'),
          error: fail,
        });
        break;
      case 'programs':
        this.refData
          .createProgram({
            code: f['code'],
            name: f['name'],
            shortName: f['shortName'],
            directionId: f['directionId'],
            durationYears: Number(f['durationYears']),
            maxCourse: Number(f['maxCourse'] ?? f['durationYears']),
          })
          .subscribe({ next: () => done('Программа добавлена'), error: fail });
        break;
      case 'academicYears':
        this.refData
          .createAcademicYear({ name: f['name'], startDate: f['startDate'], endDate: f['endDate'] })
          .subscribe({ next: () => done('Учебный год добавлен'), error: fail });
        break;
      case 'statuses':
        this.refData
          .createStatus({ code: f['code'], name: f['name'], isTerminal: !!f['isTerminal'] })
          .subscribe({ next: () => done('Статус добавлен'), error: fail });
        break;
      case 'periods':
        this.refData
          .createPeriod({ code: f['code'], name: f['name'], startTime: f['startTime'], endTime: f['endTime'] })
          .subscribe({ next: () => done('Период добавлен'), error: fail });
        break;
      case 'reasons':
        this.refData
          .createReason({ code: f['code'], name: f['name'], requiresNote: !!f['requiresNote'] })
          .subscribe({ next: () => done('Причина добавлена'), error: fail });
        break;
      case 'fields': {
        const needsOptions = f['fieldType'] === 'SELECT' || f['fieldType'] === 'MULTI_SELECT';
        const options = needsOptions
          ? this.newFieldOptions()
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((label, i) => ({ value: label, label, sortOrder: i }))
          : undefined;
        this.refData
          .createField({
            code: f['code'],
            name: f['name'],
            fieldType: f['fieldType'] ?? 'TEXT',
            isRequired: !!f['isRequired'],
            sortOrder: this.fields().length,
            options: options as any,
          })
          .subscribe({ next: () => done('Поле добавлено'), error: fail });
        break;
      }
    }
  }

  toggleFieldRequired(field: AttendanceField): void {
    this.refData.updateField(field.id, { isRequired: !field.isRequired }).subscribe({
      next: () => this.loadAll(),
      error: () => this.toast.error('Не удалось изменить поле'),
    });
  }

  toggleFieldActive(field: AttendanceField): void {
    this.refData.updateField(field.id, { isActive: !field.isActive }).subscribe({
      next: () => {
        this.toast.success(field.isActive ? 'Поле отключено' : 'Поле включено');
        this.loadAll();
      },
      error: () => this.toast.error('Не удалось изменить поле'),
    });
  }

  moveField(field: AttendanceField, direction: -1 | 1): void {
    const sorted = [...this.fields()].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((f) => f.id === field.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];

    Promise.all([
      firstValueFrom(this.refData.updateField(field.id, { sortOrder: other.sortOrder })),
      firstValueFrom(this.refData.updateField(other.id, { sortOrder: field.sortOrder })),
    ])
      .then(() => this.loadAll())
      .catch(() => this.toast.error('Не удалось изменить порядок'));
  }

  fieldTypeLabel(type: AttendanceFieldType): string {
    return this.fieldTypes.find((t) => t.value === type)?.label ?? type;
  }

  setCurrentYear(id: string): void {
    this.refData.setCurrentAcademicYear(id).subscribe({
      next: () => {
        this.toast.success('Текущий учебный год обновлён');
        this.loadAll();
      },
      error: () => this.toast.error('Не удалось обновить'),
    });
  }

  directionName(id: string): string {
    return this.directions().find((d) => d.id === id)?.name ?? '—';
  }
}
