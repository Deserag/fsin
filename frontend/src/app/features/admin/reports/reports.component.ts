import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroupReport, ReportsService, SummaryReport } from '../../../core/services/reports.service';
import { GroupsService } from '../../../core/services/groups.service';
import { ExportsService } from '../../../core/services/exports.service';
import { Group } from '../../../core/models/group.model';
import { ToastService } from '../../../shared/services/toast.service';

type Tab = 'summary' | 'group';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  readonly tab = signal<Tab>('summary');
  readonly groups = signal<Group[]>([]);
  readonly loading = signal(false);

  readonly summary = signal<SummaryReport | null>(null);
  readonly selectedGroupId = signal<string | null>(null);
  readonly groupReport = signal<GroupReport | null>(null);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly groupsService: GroupsService,
    private readonly exportsService: ExportsService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.groupsService.list().subscribe((res) => {
      this.groups.set(res.data);
      if (res.data.length > 0) this.selectedGroupId.set(res.data[0].id);
    });
    this.loadSummary();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'group' && !this.groupReport()) {
      this.loadGroupReport();
    }
  }

  loadSummary(): void {
    this.loading.set(true);
    this.reportsService.summaryReport().subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadGroupReport(): void {
    const id = this.selectedGroupId();
    if (!id) return;
    this.loading.set(true);
    this.reportsService.groupReport(id).subscribe({
      next: (res) => {
        this.groupReport.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onGroupChange(id: string): void {
    this.selectedGroupId.set(id);
    this.loadGroupReport();
  }

  async exportStudents(): Promise<void> {
    try {
      await this.exportsService.downloadStudents();
      this.toast.success('Файл сформирован');
    } catch {
      this.toast.error('Не удалось выгрузить файл');
    }
  }

  reasonEntries(breakdown: Record<string, number>): [string, number][] {
    return Object.entries(breakdown);
  }
}
