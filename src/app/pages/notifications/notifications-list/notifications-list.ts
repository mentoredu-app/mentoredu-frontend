import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
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
  private router       = inject(Router);

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
    this.markReadInternal(notif, true);
  }

  openNotification(notif: NotificationResponse): void {
    const route = this.notificationRoute(notif);
    if (!route) return;
    this.markReadInternal(notif, false);
    this.router.navigate(route);
  }

  notificationRoute(notif: NotificationResponse): string[] | null {
    const p = notif.payload ?? {};
    const value = (key: string): string | null => {
      const raw = p[key];
      return typeof raw === 'string' && raw.trim() ? raw : null;
    };

    switch (notif.type) {
      case 'new_follower':
        return value('followerId') ? ['/profiles', value('followerId')!] : null;
      case 'answer_received':
      case 'comment_received':
        return value('threadId') ? ['/forum', value('threadId')!] : ['/forum'];
      case 'reaction_received': {
        const targetType = value('targetType');
        const targetId = value('targetId');
        if (targetType === 'THREAD' && targetId) return ['/forum', targetId];
        if (targetType === 'RESOURCE' && targetId) return ['/library', targetId];
        return ['/forum'];
      }
      case 'solution_submitted':
        return value('resourceId') && value('solutionId')
          ? ['/pedagogy', 'received', value('resourceId')!, 'review', value('solutionId')!]
          : value('resourceId') ? ['/pedagogy', 'received', value('resourceId')!] : ['/library/my-resources'];
      case 'feedback_received':
        return value('resourceId') ? ['/pedagogy', value('resourceId')!, 'my-solution'] : ['/library'];
      case 'verification_processed':
        return ['/community/verification'];
      case 'association_resolved':
        return ['/community/association'];
      default:
        return null;
    }
  }

  private markReadInternal(notif: NotificationResponse, removeFromPending: boolean): void {
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
          if (removeFromPending) {
            // Remove from pending list after a brief moment
            setTimeout(() => {
              this.items.update(list => list.filter(n => n.id !== notif.id));
            }, 600);
          }
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

  // El texto de la notificación viene en payload (Map<String,Object>).
  // Intenta extraer texto de claves comunes que el backend puede incluir.
  getPayloadText(notif: NotificationResponse): string {
    const p = notif.payload;
    if (!p) return '';
    for (const key of ['message', 'text', 'description', 'content', 'body']) {
      const val = p[key];
      if (typeof val === 'string' && val.trim()) return val;
    }
    // Fallback: componer texto a partir de campos de nombre si existen
    const name =
      p['senderName'] ?? p['followerName'] ?? p['authorName'] ??
      p['teacherName'] ?? p['studentName'];
    if (typeof name === 'string') return name;
    return '';
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
