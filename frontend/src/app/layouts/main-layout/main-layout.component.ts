import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  constructor(readonly auth: AuthService) {}
  initials(): string {
    const user = this.auth.currentUser();
    return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'П';
  }
  roleLabel(role: string) {
    return ({ admin: 'Администратор', manager: 'Оперативный дежурный', foreman: 'Сотрудник УСП' } as Record<string, string>)[role] ?? role;
  }
  closeAccountMenu(): void { document.querySelector('details.account-menu')?.removeAttribute('open'); }
  logout(): void { this.auth.logout(); }
}
