import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { resolveFileUrl } from '../../services/file-upload.service';

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

  readonly menuOpen = signal(false);
  readonly sidebarOpen = signal(false);
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
    }
  }

  toggleMenu(): void { this.menuOpen.update(v => !v); }

  closeMenu(): void { this.menuOpen.set(false); }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  closeSidebar(): void { this.sidebarOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
  }
}
