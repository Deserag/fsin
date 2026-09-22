import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourseTransitionPreview, StudentsService } from '../../../core/services/students.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';

@Component({
  selector: 'app-course-transition',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-transition.component.html',
  styleUrl: './course-transition.component.scss',
})
export class CourseTransitionComponent implements OnInit {
  readonly loading = signal(true);
  readonly executing = signal(false);
  readonly preview = signal<CourseTransitionPreview | null>(null);
  readonly executed = signal(false);

  constructor(
    private readonly studentsService: StudentsService,
    private readonly toast: ToastService,
    private readonly confirmService: ConfirmService,
  ) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    this.loading.set(true);
    this.executed.set(false);
    this.studentsService.previewCourseTransition().subscribe({
      next: (p) => {
        this.preview.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Не удалось построить предпросмотр перевода');
      },
    });
  }

  async execute(): Promise<void> {
    const p = this.preview();
    if (!p) return;

    const confirmed = await this.confirmService.ask({
      title: 'Выполнить перевод курса?',
      message: `Будет переведено ${p.summary.toPromote} студентов, завершат обучение ${p.summary.toGraduate}. Действие необратимо для истории курса.`,
      confirmLabel: 'Выполнить перевод',
      danger: true,
    });
    if (!confirmed) return;

    this.executing.set(true);
    this.studentsService.executeCourseTransition().subscribe({
      next: () => {
        this.executing.set(false);
        this.executed.set(true);
        this.toast.success('Перевод курса выполнен');
        this.loadPreview();
      },
      error: (err) => {
        this.executing.set(false);
        this.toast.error(err.error?.message ?? 'Не удалось выполнить перевод');
      },
    });
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = { PROMOTE: 'Перевод на курс', GRADUATE: 'Завершение обучения', SKIP: 'Пропуск' };
    return map[action] ?? action;
  }
}
