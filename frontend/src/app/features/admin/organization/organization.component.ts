import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../core/services/organization.service';
import { Organization } from '../../../core/models/admin.model';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-organization-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organization.component.html',
  styleUrl: './organization.component.scss',
})
export class OrganizationComponent implements OnInit {
  readonly org = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  constructor(private readonly orgService: OrganizationService, private readonly toast: ToastService) {}

  ngOnInit(): void {
    this.orgService.get().subscribe({
      next: (o) => {
        this.org.set(o);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  update(key: keyof Organization, value: string): void {
    this.org.update((o) => (o ? { ...o, [key]: value } : o));
  }

  save(): void {
    const o = this.org();
    if (!o) return;
    this.saving.set(true);
    this.orgService.update({ name: o.name, shortName: o.shortName, code: o.code }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Данные организации сохранены');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Не удалось сохранить');
      },
    });
  }
}
