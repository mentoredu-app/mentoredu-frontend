import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../core/services/auth-state.service';
import { LibraryService } from '../../services/library.service';
import { NotificationService } from '../../services/notification.service';
import { ResourceResponse, RESOURCE_TYPE_LABELS } from '../../models/resource.model';
import { NotificationResponse, NOTIFICATION_LABELS } from '../../models/notification.model';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private authState = inject(AuthStateService);
  private libraryService = inject(LibraryService);
  private notificationService = inject(NotificationService);

  readonly role = computed(() => this.authState.role());
  readonly userName = computed(() => {
    const user = this.authState.user();
    return user ? `${user.firstName} ${user.lastName}` : 'Usuario';
  });

  readonly recentResources = signal<ResourceResponse[]>([]);
  readonly myResources = signal<ResourceResponse[]>([]);
  readonly pendingNotifications = signal<NotificationResponse[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.libraryService.search({ page: 0, size: 6 }).subscribe({
      next: page => {
        this.recentResources.set(page.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    if (this.canManageResources()) {
      this.libraryService.getMyResources(0, 4).subscribe({
        next: page => this.myResources.set(page.content),
        error: () => this.myResources.set([]),
      });
    }

    this.notificationService.getPending(0, 5).subscribe({
      next: page => this.pendingNotifications.set(page.content),
      error: () => this.pendingNotifications.set([]),
    });
  }

  canManageResources(): boolean {
    const role = this.role();
    return role === 'TEACHER' || role === 'ACADEMY' || role === 'ADMIN';
  }

  roleLabel(): string {
    const role = this.role();
    if (role === 'STUDENT') return 'Estudiante';
    if (role === 'TEACHER') return 'Docente';
    if (role === 'ACADEMY') return 'Academia';
    if (role === 'ADMIN') return 'Administrador';
    return role ?? 'Cuenta';
  }

  primaryAction(): { label: string; link: string } {
    const role = this.role();
    if (role === 'STUDENT') return { label: 'Buscar prácticas', link: '/library' };
    if (role === 'TEACHER' || role === 'ACADEMY') return { label: 'Publicar recurso', link: '/library/upload' };
    if (role === 'ADMIN') return { label: 'Revisar moderación', link: '/community/moderation' };
    return { label: 'Ir a biblioteca', link: '/library' };
  }

  secondaryAction(): { label: string; link: string } {
    const role = this.role();
    if (role === 'STUDENT') return { label: 'Mis resoluciones', link: '/pedagogy/my-solutions' };
    if (role === 'TEACHER' || role === 'ACADEMY') return { label: 'Resoluciones recibidas', link: '/pedagogy/received' };
    if (role === 'ADMIN') return { label: 'Catálogo', link: '/admin/catalog' };
    return { label: 'Foro', link: '/forum' };
  }

  typeLabel(resource: ResourceResponse): string {
    return RESOURCE_TYPE_LABELS[resource.resourceType];
  }

  notificationLabel(notification: NotificationResponse): string {
    return NOTIFICATION_LABELS[notification.type] ?? 'Notificación';
  }

  payloadText(notification: NotificationResponse): string {
    const payload = notification.payload ?? {};
    return String(payload['message'] ?? payload['title'] ?? payload['resourceTitle'] ?? 'Actividad reciente');
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(value));
  }
}
