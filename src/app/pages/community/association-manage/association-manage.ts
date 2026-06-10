import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  AssociationResponse, AssociationStatus, ASSOCIATION_STATUS_LABELS,
} from '../../../models/association.model';

@Component({
  selector: 'app-association-manage',
  imports: [LoadingSpinner, EmptyState],
  templateUrl: './association-manage.html',
  styleUrl: './association-manage.css',
})
export class AssociationManage implements OnInit {
  private communityService = inject(CommunityService);
  private toast            = inject(ToastService);
  readonly authState       = inject(AuthStateService);

  readonly isLoading    = signal(true);
  readonly loadError    = signal('');
  readonly items        = signal<AssociationResponse[]>([]);
  private allItems: AssociationResponse[] = [];

  readonly actioningId  = signal<string | null>(null);
  readonly statusFilter = signal<AssociationStatus | 'ALL'>('ALL');

  readonly statusLabels = ASSOCIATION_STATUS_LABELS;

  readonly statuses: Array<{ value: AssociationStatus | 'ALL'; label: string }> = [
    { value: 'ALL',      label: 'Todas' },
    { value: 'PENDING',  label: 'Pendientes' },
    { value: 'ACCEPTED', label: 'Aceptadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
  ];

  readonly isAcademy = signal(false);

  ngOnInit(): void {
    this.isAcademy.set(this.authState.role() === 'ACADEMY');
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    const req$ = this.isAcademy()
      ? this.communityService.getAcademyRequests()
      : this.communityService.getMyAssociations();

    req$.subscribe({
      next: list => {
        this.allItems = list;
        this.items.set(this.applyFilter(list));
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.loadError.set('No tienes permiso para ver esta sección.');
        } else {
          this.loadError.set('No se pudo cargar las asociaciones. Intenta de nuevo.');
        }
        this.isLoading.set(false);
      },
    });
  }

  private applyFilter(items: AssociationResponse[]): AssociationResponse[] {
    const f = this.statusFilter();
    return f === 'ALL' ? items : items.filter(r => r.status === f);
  }

  setFilter(value: AssociationStatus | 'ALL'): void {
    this.statusFilter.set(value);
    this.items.set(this.applyFilter(this.allItems));
  }

  accept(item: AssociationResponse): void {
    if (this.actioningId()) return;
    this.actioningId.set(item.id);
    this.communityService.acceptAssociation(item.id).subscribe({
      next: updated => {
        this.items.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.actioningId.set(null);
        this.toast.success('Asociación aceptada');
      },
      error: (err: HttpErrorResponse) => {
        this.actioningId.set(null);
        if (err.status === 409) {
          this.toast.error('Esta solicitud ya fue procesada');
        } else if (err.status === 403) {
          this.toast.error('Solo academias pueden resolver solicitudes');
        } else {
          this.toast.error('No se pudo procesar. Intenta de nuevo.');
        }
      },
    });
  }

  reject(item: AssociationResponse): void {
    if (this.actioningId()) return;
    this.actioningId.set(item.id);
    this.communityService.rejectAssociation(item.id).subscribe({
      next: updated => {
        this.items.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.actioningId.set(null);
        this.toast.success('Solicitud rechazada');
      },
      error: (err: HttpErrorResponse) => {
        this.actioningId.set(null);
        if (err.status === 409) {
          this.toast.error('Esta solicitud ya fue procesada');
        } else if (err.status === 403) {
          this.toast.error('Solo academias pueden resolver solicitudes');
        } else {
          this.toast.error('No se pudo procesar. Intenta de nuevo.');
        }
      },
    });
  }

  isActioning(id: string): boolean {
    return this.actioningId() === id;
  }

  // Muestra los últimos 8 chars del UUID como identificador corto
  shortId(uuid: string): string {
    return uuid ? uuid.slice(-8).toUpperCase() : '—';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
