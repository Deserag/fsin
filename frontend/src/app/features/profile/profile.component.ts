import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  form = { firstName: '', lastName: '', middleName: '', phone: '', email: '' };
  currentPassword = '';
  newPassword = '';
  repeatPassword = '';
  readonly saving = signal(false);
  readonly changing = signal(false);
  constructor(readonly auth: AuthService, private toast: ToastService) {}

  ngOnInit(): void {
    this.auth.profile().subscribe({
      next: user => this.form = {
        firstName: user.firstName, lastName: user.lastName,
        middleName: user.middleName ?? '', phone: user.phone ?? '', email: user.email ?? '',
      },
      error: () => this.toast.error('Не удалось загрузить профиль'),
    });
  }
  save(): void {
    if (!this.form.firstName.trim() || !this.form.lastName.trim()) {
      this.toast.error('Укажите имя и фамилию'); return;
    }
    this.saving.set(true);
    this.auth.updateProfile(this.form).subscribe({
      next: () => { this.saving.set(false); this.toast.success('Данные сохранены'); },
      error: error => { this.saving.set(false); this.toast.error(error.error?.message ?? 'Не удалось сохранить данные'); },
    });
  }
  changePassword(): void {
    if (this.newPassword.length < 8 || this.newPassword !== this.repeatPassword || !this.currentPassword) {
      this.toast.error('Проверьте текущий и новый пароль'); return;
    }
    this.changing.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => { this.changing.set(false); this.toast.success('Пароль изменён. Войдите снова.'); this.auth.clearSession(); },
      error: error => { this.changing.set(false); this.toast.error(error.error?.message ?? 'Не удалось изменить пароль'); },
    });
  }
}
