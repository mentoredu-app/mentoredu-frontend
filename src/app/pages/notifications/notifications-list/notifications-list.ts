import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../../../services/notification.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  NotificationResponse, NotificationType, NOTIFICATION_LABELS,
} from '../../../models/notification.model';

type TabValue = 'all' | 'pending';

@Component({
  selector: 'app-notifications-list',
  imports: [LoadingSpinner, EmptyState],
  templateUrl: './notifications-list.html',
  styleUrl: './notifications-list.css',
})
export class NotificationsList implements OnInit {
  private notifService = inject(NotificationService);
  private toast        = inject(ToastService);

  readonly activeTab     = signal<TabValue>('pending');
  readonly isLoading     = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError     = signal('');
  readonly items         = signal<NotificationResponse[]>([]);
  readonly hasMore       = signal(false);
  readonly unreadCount   = signal(0);
  private currentPage    = 0;

  readonly markingIds    = signal<Set<string>>(new Set());

  readonly typeLabels = NOTIFICATION_LABELS;

  ngOnInit(): void {
    this.load(0);
  }

  switchTab(tab: TabValue): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.load(0);
  }

  private load(page: number): void {
    if (page === 0) { this.isLoading.set(true); this.loadError.set(''); }
    else            { this.isLoadingMore.set(true); }

    const tab = this.activeTab();
    const req$ = tab === 'pending'
      ? this.notifService.getPending(page, 15)
      : this.notifService.getAll(page, 15);

    req$.subscribe({
      next: paged => {
        if (page === 0) this.items.set(paged.content);
        else            this.items.update(prev => [...prev, ...paged.content]);
        this.currentPage = paged.page;
        this.hasMore.set(!paged.last);
        if (tab === 'pending') this.unreadCount.set(paged.totalElements);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(
          err.status === 401 ? 'Debes iniciar sesión para ver tus notificaciones.'
                             : 'No se pudo cargar las notificaciones. Intenta de nuevo.'
        );
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.load(this.currentPage + 1);
  }

  markRead(notif: NotificationResponse): void {
    if (this.isMarking(notif.id) || notif.readAt) return;
    this.markingIds.update(s => new Set([...s, notif.id]));

    this.notifService.markAsRead(notif.id).subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.items.update(list =>
          list.map(n => n.id === notif.id ? { ...n, readAt: now } : n)
        );
        this.markingIds.update(s => { const ns = new Set(s); ns.delete(notif.id); return ns; });
        if (this.activeTab() === 'pending') {
          this.unreadCount.update(c => Math.max(0, c - 1));
          // Remove from pending list after a brief moment
          setTimeout(() => {
            this.items.update(list => list.filter(n => n.id !== notif.id));
          }, 600);
        }
      },
      error: () => {
        this.markingIds.update(s => { const ns = new Set(s); ns.delete(notif.id); return ns; });
        this.toast.error('No se pudo marcar como leída. Intenta de nuevo.');
      },
    });
  }

  isMarking(id: string): boolean { return this.markingIds().has(id); }

  isRead(notif: NotificationResponse): boolean { return !!notif.readAt; }

  typeLabel(type: NotificationType): string {
    return this.typeLabels[type] ?? type;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffH   = Math.floor(diffMs / 3_600_000);
    const diffD   = Math.floor(diffMs / 86_400_000);
    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffH < 24) return `Hace ${diffH} h`;
    if (diffD < 7) return `Hace ${diffD} día${diffD > 1 ? 's' : ''}`;
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
