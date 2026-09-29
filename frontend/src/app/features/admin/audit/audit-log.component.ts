import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditService } from '../../../core/services/audit.service';
import { AuditLogEntry } from '../../../core/models/admin.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent implements OnInit {
  readonly entries = signal<AuditLogEntry[]>([]);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly totalPages = signal(1);

  constructor(private readonly auditService: AuditService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.auditService.list(this.page()).subscribe({
      next: (res) => {
        this.entries.set(res.data);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Создание',
      UPDATE: 'Изменение',
      DELETE: 'Удаление',
      SUBMIT: 'Отправка на проверку',
      CLOSE: 'Закрытие',
      ARCHIVE: 'Архивирование',
      ASSIGN_FOREMAN: 'Назначение сотрудника УСП',
      IMPORT: 'Импорт',
    };
    return map[action] ?? action;
  }

  entityLabel(entity: string): string {
    const map: Record<string, string> = {
      Student: 'Студент',
      Group: 'Группа',
      AttendanceSheet: 'Табель',
      User: 'Пользователь',
    };
    return map[entity] ?? entity;
  }
}
