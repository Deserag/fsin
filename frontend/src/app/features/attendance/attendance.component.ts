import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { GroupsService } from '../../core/services/groups.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { Group } from '../../core/models/group.model';
import { AttendancePeriod, AttendanceReason, AttendanceSheetDetail, SheetValidation } from '../../core/models/attendance.model';

interface RowState {
  studentId: string;
  name: string;
  isPresent: boolean;
  reasonId: string | null;
  note: string;
  selected: boolean;
  dirty: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly groups = signal<Group[]>([]);
  readonly periods = signal<AttendancePeriod[]>([]);
  readonly reasons = signal<AttendanceReason[]>([]);

  readonly selectedGroupId = signal<string | null>(null);
  readonly selectedPeriodId = signal<string | null>(null);
  readonly date = signal(todayIso());

  readonly sheet = signal<AttendanceSheetDetail | null>(null);
  readonly rows = signal<RowState[]>([]);
  readonly validation = signal<SheetValidation | null>(null);
  readonly search = signal('');

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => r.name.toLowerCase().includes(q));
  });

  readonly selectedCount = computed(() => this.rows().filter((r) => r.selected).length);
  readonly allSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => r.selected));

  constructor(
    private readonly groupsService: GroupsService,
    private readonly attendanceService: AttendanceService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const queryGroupId = this.route.snapshot.queryParamMap.get('groupId');

    forkJoin({
      groups: this.groupsService.list(),
      periods: this.attendanceService.periods(),
      reasons: this.attendanceService.reasons(),
    }).subscribe({
      next: ({ groups, periods, reasons }) => {
        this.groups.set(groups.data);
        this.periods.set(periods);
        this.reasons.set(reasons);
        this.loading.set(false);

        const initialGroup = queryGroupId ?? groups.data[0]?.id ?? null;
        const initialPeriod = periods.find((p) => p.code === 'MORNING')?.id ?? periods[0]?.id ?? null;
        if (initialGroup) this.selectedGroupId.set(initialGroup);
        if (initialPeriod) this.selectedPeriodId.set(initialPeriod);
        if (initialGroup && initialPeriod) this.loadOrCreateSheet();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не удалось загрузить справочники');
      },
    });
  }

  onContextChange(): void {
    this.sheet.set(null);
    this.rows.set([]);
    this.validation.set(null);
    if (this.selectedGroupId() && this.selectedPeriodId()) {
      this.loadOrCreateSheet();
    }
  }

  private loadOrCreateSheet(): void {
    const groupId = this.selectedGroupId();
    const periodId = this.selectedPeriodId();
    const date = this.date();
    if (!groupId || !periodId) return;

    this.loading.set(true);
    this.error.set(null);

    this.attendanceService.findSheets({ groupId, periodId, date }).subscribe({
      next: (res) => {
        if (res.data.length > 0) {
          this.openSheet(res.data[0].id);
        } else {
          this.attendanceService.createSheet(groupId, periodId, `${date}T00:00:00.000Z`).subscribe({
            next: (created) => this.openSheet(created.id),
            error: (err) => {
              this.loading.set(false);
              this.error.set(err.error?.message ?? 'Не удалось создать табель');
            },
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не удалось получить табель');
      },
    });
  }

  private openSheet(id: string): void {
    this.attendanceService.getSheet(id).subscribe({
      next: (detail) => {
        this.sheet.set(detail);
        this.rows.set(
          detail.records.map((r) => ({
            studentId: r.studentId,
            name: `${r.student.lastName} ${r.student.firstName} ${r.student.middleName ?? ''}`.trim(),
            isPresent: r.isPresent,
            reasonId: r.reasonId ?? null,
            note: r.note ?? '',
            selected: false,
            dirty: false,
          })),
        );
        this.loading.set(false);
        this.refreshValidation();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не удалось открыть табель');
      },
    });
  }

  private refreshValidation(): void {
    const sheetId = this.sheet()?.id;
    if (!sheetId) return;
    this.attendanceService.getValidation(sheetId).subscribe((v) => this.validation.set(v));
  }

  toggleSelectAll(): void {
    const next = !this.allSelected();
    this.rows.update((rows) => rows.map((r) => ({ ...r, selected: next })));
  }

  toggleRowSelected(studentId: string): void {
    this.rows.update((rows) => rows.map((r) => (r.studentId === studentId ? { ...r, selected: !r.selected } : r)));
  }

  markPresent(studentId: string): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.studentId === studentId ? { ...r, isPresent: true, reasonId: null, dirty: true } : r)),
    );
  }

  defaultReasonId(): string {
    return this.reasons()[0]?.id ?? '';
  }

  markAbsent(studentId: string, reasonId: string): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.studentId === studentId ? { ...r, isPresent: false, reasonId, dirty: true } : r)),
    );
  }

  bulkMarkAbsent(reasonId: string): void {
    if (!reasonId) return;
    this.rows.update((rows) =>
      rows.map((r) => (r.selected ? { ...r, isPresent: false, reasonId, dirty: true } : r)),
    );
  }

  bulkMarkPresent(): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.selected ? { ...r, isPresent: true, reasonId: null, dirty: true } : r)),
    );
  }

  save(): void {
    const sheetId = this.sheet()?.id;
    const dirtyRows = this.rows().filter((r) => r.dirty);
    if (!sheetId || dirtyRows.length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    this.attendanceService
      .bulkUpdate(
        sheetId,
        dirtyRows.map((r) => ({
          studentId: r.studentId,
          isPresent: r.isPresent,
          reasonId: r.reasonId ?? undefined,
          note: r.note || undefined,
        })),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.rows.update((rows) => rows.map((r) => ({ ...r, dirty: false })));
          this.refreshValidation();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err.error?.message ?? 'Не удалось сохранить изменения');
        },
      });
  }

  submit(): void {
    const sheetId = this.sheet()?.id;
    if (!sheetId) return;
    this.saving.set(true);
    this.error.set(null);
    this.attendanceService.submitSheet(sheetId).subscribe({
      next: () => {
        this.saving.set(false);
        this.openSheet(sheetId);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.message ?? 'Не удалось отправить табель');
      },
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Черновик',
      FILLED: 'Заполнен',
      SUBMITTED: 'На проверке',
      REVIEWED: 'Проверен',
      CLOSED: 'Закрыт',
    };
    return map[status] ?? status;
  }

  reasonName(reasonId: string | null): string {
    if (!reasonId) return '';
    return this.reasons().find((r) => r.id === reasonId)?.name ?? '';
  }

  get isClosed(): boolean {
    return this.sheet()?.status === 'CLOSED';
  }
}
