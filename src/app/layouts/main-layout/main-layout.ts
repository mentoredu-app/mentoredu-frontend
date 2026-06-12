import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '../../services/auth.service';
import { resolveFileUrl } from '../../services/file-upload.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  readonly authState  = inject(AuthStateService);
  private authService = inject(AuthService);

  readonly menuOpen = signal(false);
  readonly resolveUrl = resolveFileUrl;

  toggleMenu(): void { this.menuOpen.update(v => !v); }

  closeMenu(): void { this.menuOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.menuOpen.set(false); }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
  }
}
