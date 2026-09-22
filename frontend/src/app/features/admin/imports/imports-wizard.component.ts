import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImportsService, ParseResult, ValidateResult } from '../../../core/services/imports.service';
import { ExportsService } from '../../../core/services/exports.service';
import { ToastService } from '../../../shared/services/toast.service';

const REQUIRED_FIELDS = [
  { key: 'lastName', label: 'Фамилия' },
  { key: 'firstName', label: 'Имя' },
  { key: 'middleName', label: 'Отчество' },
  { key: 'birthDate', label: 'Дата рождения' },
  { key: 'groupName', label: 'Группа' },
  { key: 'currentCourse', label: 'Курс' },
  { key: 'directionCode', label: 'Направление (код)' },
  { key: 'programCode', label: 'Программа (код)' },
  { key: 'enrollmentYear', label: 'Год поступления' },
  { key: 'statusCode', label: 'Статус (код)' },
];

type Step = 'upload' | 'mapping' | 'preview' | 'done';

@Component({
  selector: 'app-imports-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './imports-wizard.component.html',
  styleUrl: './imports-wizard.component.scss',
})
export class ImportsWizardComponent {
  readonly fields = REQUIRED_FIELDS;
  readonly step = signal<Step>('upload');
  readonly busy = signal(false);

  readonly parseResult = signal<ParseResult | null>(null);
  readonly mapping = signal<Record<string, string>>({});
  readonly validateResult = signal<ValidateResult | null>(null);
  readonly importedRows = signal(0);

  private selectedFile: File | null = null;

  constructor(
    private readonly importsService: ImportsService,
    private readonly exportsService: ExportsService,
    private readonly toast: ToastService,
  ) {}

  downloadTemplate(): void {
    this.exportsService.downloadTemplate();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.selectedFile) {
      this.toast.error('Выберите файл');
      return;
    }
    this.busy.set(true);
    this.importsService.parse(this.selectedFile).subscribe({
      next: (res) => {
        this.parseResult.set(res);
        // auto-guess mapping by matching Russian headers we generate in the template
        const guess: Record<string, string> = {};
        const headerByLabel = new Map(res.headers.map((h) => [h.toLowerCase(), h]));
        for (const f of this.fields) {
          const found = res.headers.find((h) => h.toLowerCase().includes(f.label.toLowerCase().slice(0, 4)));
          if (found) guess[f.key] = found;
        }
        this.mapping.set(guess);
        this.busy.set(false);
        this.step.set('mapping');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err.error?.message ?? 'Не удалось разобрать файл');
      },
    });
  }

  updateMapping(field: string, header: string): void {
    this.mapping.update((m) => ({ ...m, [field]: header }));
  }

  confirmMapping(): void {
    const pr = this.parseResult();
    if (!pr) return;
    this.busy.set(true);
    this.importsService.setMapping(pr.jobId, this.mapping()).subscribe({
      next: () => {
        this.importsService.validate(pr.jobId).subscribe({
          next: (res) => {
            this.validateResult.set(res);
            this.busy.set(false);
            this.step.set('preview');
          },
          error: (err) => {
            this.busy.set(false);
            this.toast.error(err.error?.message ?? 'Ошибка валидации');
          },
        });
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Не удалось сохранить сопоставление колонок');
      },
    });
  }

  confirmImport(): void {
    const pr = this.parseResult();
    if (!pr) return;
    this.busy.set(true);
    this.importsService.confirm(pr.jobId).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.importedRows.set(res.importedRows);
        this.step.set('done');
        this.toast.success(`Импортировано студентов: ${res.importedRows}`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err.error?.message ?? 'Не удалось выполнить импорт');
      },
    });
  }

  restart(): void {
    this.step.set('upload');
    this.parseResult.set(null);
    this.validateResult.set(null);
    this.mapping.set({});
    this.selectedFile = null;
  }
}
