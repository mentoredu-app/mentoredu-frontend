import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  VerificationResponse, VerificationStatus,
  VERIFICATION_STATUS_LABELS, DOCUMENT_TYPE_LABELS,
} from '../../../models/community.model';

@Component({
  selector: 'app-moderation-panel',
  imports: [ReactiveFormsModule, LoadingSpinner, EmptyState],
  templateUrl: './moderation-panel.html',
  styleUrl: './moderation-panel.css',
})
export class ModerationPanel implements OnInit {
  private communityService = inject(CommunityService);
  private toast            = inject(ToastService);
  private fb               = inject(FormBuilder);

  readonly isLoading      = signal(true);
  readonly isLoadingMore  = signal(false);
  readonly loadError      = signal('');
  readonly requests       = signal<VerificationResponse[]>([]);
  readonly hasMore        = signal(false);
  private currentPage     = 0;

  // Expanded card with inline review form
  readonly expandedId     = signal<string | null>(null);
  readonly reviewingId    = signal<string | null>(null);

  readonly statusLabels       = VERIFICATION_STATUS_LABELS;
  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;

  readonly statusFilter = signal<VerificationStatus | 'ALL'>('ALL');
  readonly statuses: Array<{ value: VerificationStatus | 'ALL'; label: string }> = [
    { value: 'ALL',      label: 'Todas' },
    { value: 'PENDING',  label: 'Pendientes' },
    { value: 'APPROVED', label: 'Aprobadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
  ];

  // Per-request review forms
  private reviewForms = new Map<string, FormGroup>();

  ngOnInit(): void {
    this.load(0);
  }

  private load(page: number): void {
    if (page === 0) {
      this.isLoading.set(true);
      this.loadError.set('');
    } else {
      this.isLoadingMore.set(true);
    }

    this.communityService.getAllVerifications(page, 15).subscribe({
      next: paged => {
        const filtered = this.applyFilter(paged.content);
        if (page === 0) {
          this.requests.set(filtered);
        } else {
          this.requests.update(prev => [...prev, ...filtered]);
        }
        this.currentPage = paged.page;
        this.hasMore.set(!paged.last);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.loadError.set('No tienes permiso para ver esta sección.');
        } else {
          this.loadError.set('No se pudo cargar las solicitudes. Intenta de nuevo.');
        }
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  private applyFilter(items: VerificationResponse[]): VerificationResponse[] {
    const f = this.statusFilter();
    return f === 'ALL' ? items : items.filter(r => r.status === f);
  }

  setFilter(value: VerificationStatus | 'ALL'): void {
    this.statusFilter.set(value);
    this.load(0);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.load(this.currentPage + 1);
  }

  // ── Expand / collapse ────────────────────────────────
  toggleExpand(req: VerificationResponse): void {
    const current = this.expandedId();
    this.expandedId.set(current === req.id ? null : req.id);
    if (!this.reviewForms.has(req.id)) {
      this.reviewForms.set(req.id, this.buildReviewForm());
    }
  }

  isExpanded(id: string): boolean { return this.expandedId() === id; }
  isReviewing(id: string): boolean { return this.reviewingId() === id; }

  private buildReviewForm(): FormGroup {
    return this.fb.group({
      action: ['APPROVED', Validators.required],
      notes:  [''],
    });
  }

  getReviewForm(id: string): FormGroup {
    if (!this.reviewForms.has(id)) this.reviewForms.set(id, this.buildReviewForm());
    return this.reviewForms.get(id)!;
  }

  needsNotes(id: string): boolean {
    return this.getReviewForm(id).get('action')?.value === 'REJECTED';
  }

  // ── Review submit ────────────────────────────────────
  submitReview(req: VerificationResponse): void {
    const form = this.getReviewForm(req.id);
    const action = form.get('action')?.value;
    const notes  = form.get('notes')?.value?.trim();

    if (action === 'REJECTED' && !notes) {
      this.toast.error('El rechazo requiere una razón obligatoria');
      form.get('notes')?.markAsTouched();
      return;
    }

    this.reviewingId.set(req.id);
    this.communityService.reviewVerification(req.id, {
      action,
      notes: notes || undefined,
    }).subscribe({
      next: updated => {
        this.requests.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.expandedId.set(null);
        this.reviewingId.set(null);
        this.toast.success(
          action === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada'
        );
      },
      error: (err: HttpErrorResponse) => {
        this.reviewingId.set(null);
        if (err.status === 409) {
          this.toast.error('Esta solicitud ya fue procesada');
          this.requests.update(list =>
            list.map(r => r.id === req.id ? { ...r, status: err.error?.currentStatus ?? r.status } : r)
          );
        } else if (err.status === 400) {
          this.toast.error(err.error?.message ?? 'Datos inválidos');
        } else {
          this.toast.error('No se pudo procesar la solicitud. Intenta de nuevo.');
        }
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────
  docTypeLabel(type: string): string {
    return this.documentTypeLabels[type] ?? type;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  entityLabel(type: string): string {
    return type === 'ACADEMY' ? 'Academia' : 'Docente';
  }
}
