import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { AcademicYear, Direction, EducationalProgram, StudentStatus } from '../../../core/models/admin.model';
import { AttendancePeriod, AttendanceReason } from '../../../core/models/attendance.model';
import { ToastService } from '../../../shared/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

type TabKey = 'directions' | 'programs' | 'academicYears' | 'statuses' | 'periods' | 'reasons';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'directions', label: 'Направления' },
  { key: 'programs', label: 'Программы' },
  { key: 'academicYears', label: 'Учебные годы' },
  { key: 'statuses', label: 'Статусы студентов' },
  { key: 'periods', label: 'Периоды посещаемости' },
  { key: 'reasons', label: 'Причины отсутствия' },
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
  readonly activeTab = signal<TabKey>('directions');
  readonly loading = signal(true);

  readonly directions = signal<Direction[]>([]);
  readonly programs = signal<EducationalProgram[]>([]);
  readonly academicYears = signal<AcademicYear[]>([]);
  readonly statuses = signal<StudentStatus[]>([]);
  readonly periods = signal<AttendancePeriod[]>([]);
  readonly reasons = signal<AttendanceReason[]>([]);

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
    this.form.set({ isActive: true });
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
    }
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
