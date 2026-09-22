import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReportsService, DashboardData } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(true);

  constructor(private readonly reports: ReportsService, readonly auth: AuthService) {}

  ngOnInit(): void {
    this.reports.dashboard().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
}
