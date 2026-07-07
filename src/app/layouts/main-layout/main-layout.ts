import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { resolveFileUrl } from '../../services/file-upload.service';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {
  readonly authState     = inject(AuthStateService);
  private authService    = inject(AuthService);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);

  readonly menuOpen = signal(false);
  readonly sidebarOpen = signal(false);
  readonly unreadNotifications = signal(0);
  readonly resolveUrl = resolveFileUrl;

  ngOnInit(): void {
    const user = this.authState.user();
    if (user) {
      this.profileService.getMe().subscribe({
        next: profile => {
          this.authState.setUser({ ...user, avatarUrl: profile.avatarUrl });
        },
        error: () => {},
      });
      this.notificationService.getPending(0, 1).subscribe({
        next: page => this.unreadNotifications.set(page.totalElements),
        error: () => this.unreadNotifications.set(0),
      });
    }
  }

  toggleMenu(): void { this.menuOpen.update(v => !v); }

  closeMenu(): void { this.menuOpen.set(false); }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  closeSidebar(): void { this.sidebarOpen.set(false); }

  canManageResources(): boolean {
    const role = this.authState.role();
    return role === 'TEACHER' || role === 'ACADEMY' || role === 'ADMIN';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.closeSidebar();
    this.authService.logout();
  }
}
