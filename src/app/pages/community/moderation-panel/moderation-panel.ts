import { Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CommunityService } from '../../../services/community.service';
import { ModerationService } from '../../../services/moderation.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  VerificationResponse, VerificationStatus,
  VERIFICATION_STATUS_LABELS, DOCUMENT_TYPE_LABELS,
} from '../../../models/community.model';
import {
  ReportResponse, ReportStatus, REPORT_TARGET_LABELS,
} from '../../../models/moderation.model';

type PanelTab = 'verifications' | 'reports';

@Component({
  selector: 'app-moderation-panel',
  imports: [ReactiveFormsModule, FormsModule, SlicePipe, LoadingSpinner, EmptyState],
  templateUrl: './moderation-panel.html',
  styleUrl: './moderation-panel.css',
})
export class ModerationPanel implements OnInit {
  private communityService  = inject(CommunityService);
  private moderationService = inject(ModerationService);
  private toast             = inject(ToastService);
  private fb                = inject(FormBuilder);

  // ── Tab ──────────────────────────────────────────────
  readonly activeTab = signal<PanelTab>('verifications');

  // ── Verifications ─────────────────────────────────────
  readonly vIsLoading      = signal(true);
  readonly vIsLoadingMore  = signal(false);
  readonly vLoadError      = signal('');
  readonly requests        = signal<VerificationResponse[]>([]);
  readonly vHasMore        = signal(false);
  private vPage            = 0;

  readonly expandedId      = signal<string | null>(null);
  readonly reviewingId     = signal<string | null>(null);
  private reviewForms      = new Map<string, FormGroup>();

  readonly statusLabels       = VERIFICATION_STATUS_LABELS;
  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;

  readonly statusFilter = signal<VerificationStatus | 'ALL'>('ALL');
  readonly verificationStatuses: Array<{ value: VerificationStatus | 'ALL'; label: string }> = [
    { value: 'ALL',      label: 'Todas' },
    { value: 'PENDING',  label: 'Pendientes' },
    { value: 'APPROVED', label: 'Aprobadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
  ];

  // ── Reports ──────────────────────────────────────────
  readonly rIsLoading      = signal(false);
  readonly rIsLoadingMore  = signal(false);
  readonly rLoadError      = signal('');
  readonly reports         = signal<ReportResponse[]>([]);
  readonly rHasMore        = signal(false);
  private rPage            = 0;

  readonly expandedReportId = signal<string | null>(null);
  readonly resolvingId      = signal<string | null>(null);
  readonly resolutionNotes  = new Map<string, string>();

  readonly reportTargetLabels = REPORT_TARGET_LABELS;
  readonly reportStatusFilter = signal<ReportStatus | 'ALL'>('ALL');
  // Backend usa 'OPEN' (no 'PENDING') para reportes sin resolver
  readonly reportStatuses: Array<{ value: ReportStatus | 'ALL'; label: string }> = [
    { value: 'ALL',      label: 'Todos' },
    { value: 'OPEN',     label: 'Pendientes' },
    { value: 'RESOLVED', label: 'Resueltos' },
  ];

  ngOnInit(): void {
    this.loadVerifications(0);
  }

  // ── Tab switching ─────────────────────────────────────
  switchTab(tab: PanelTab): void {
    this.activeTab.set(tab);
    if (tab === 'reports' && this.reports().length === 0 && !this.rIsLoading()) {
      this.loadReports(0);
    }
  }

  // ── Verifications ─────────────────────────────────────
  private loadVerifications(page: number): void {
    if (page === 0) { this.vIsLoading.set(true); this.vLoadError.set(''); }
    else { this.vIsLoadingMore.set(true); }

    this.communityService.getAllVerifications(page, 15).subscribe({
      next: paged => {
        const filtered = this.applyVerifFilter(paged.content);
        if (page === 0) this.requests.set(filtered);
        else this.requests.update(p => [...p, ...filtered]);
        this.vPage = paged.page;
        this.vHasMore.set(!paged.last);
        this.vIsLoading.set(false);
        this.vIsLoadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.vLoadError.set(err.status === 403
          ? 'No tienes permiso para ver esta sección.'
          : 'No se pudo cargar las solicitudes.'
        );
        this.vIsLoading.set(false);
        this.vIsLoadingMore.set(false);
      },
    });
  }

  private applyVerifFilter(items: VerificationResponse[]): VerificationResponse[] {
    const f = this.statusFilter();
    return f === 'ALL' ? items : items.filter(r => r.status === f);
  }

  setVerifFilter(value: VerificationStatus | 'ALL'): void {
    this.statusFilter.set(value);
    this.loadVerifications(0);
  }

  loadMoreVerifs(): void {
    if (this.vIsLoadingMore() || !this.vHasMore()) return;
    this.loadVerifications(this.vPage + 1);
  }

  toggleExpand(req: VerificationResponse): void {
    this.expandedId.set(this.expandedId() === req.id ? null : req.id);
    if (!this.reviewForms.has(req.id)) this.reviewForms.set(req.id, this.buildReviewForm());
  }

  isExpanded(id: string): boolean  { return this.expandedId() === id; }
  isReviewing(id: string): boolean { return this.reviewingId() === id; }

  private buildReviewForm(): FormGroup {
    return this.fb.group({ action: ['APPROVED', Validators.required], notes: [''] });
  }

  getReviewForm(id: string): FormGroup {
    if (!this.reviewForms.has(id)) this.reviewForms.set(id, this.buildReviewForm());
    return this.reviewForms.get(id)!;
  }

  needsNotes(id: string): boolean {
    return this.getReviewForm(id).get('action')?.value === 'REJECTED';
  }

  submitReview(req: VerificationResponse): void {
    const form  = this.getReviewForm(req.id);
    const action = form.get('action')?.value;
    const notes  = form.get('notes')?.value?.trim();
    if (action === 'REJECTED' && !notes) {
      this.toast.error('El rechazo requiere una razón obligatoria');
      form.get('notes')?.markAsTouched();
      return;
    }
    this.reviewingId.set(req.id);
    this.communityService.reviewVerification(req.id, { action, notes: notes || undefined }).subscribe({
      next: updated => {
        this.requests.update(l => l.map(r => r.id === updated.id ? updated : r));
        this.expandedId.set(null);
        this.reviewingId.set(null);
        this.toast.success(action === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      },
      error: (err: HttpErrorResponse) => {
        this.reviewingId.set(null);
        if (err.status === 409) this.toast.error('Esta solicitud ya fue procesada');
        else this.toast.error('No se pudo procesar la solicitud.');
      },
    });
  }

  // ── Reports ──────────────────────────────────────────
  private loadReports(page: number): void {
    if (page === 0) { this.rIsLoading.set(true); this.rLoadError.set(''); }
    else { this.rIsLoadingMore.set(true); }

    this.moderationService.getReports(page, 15).subscribe({
      next: paged => {
        const filtered = this.applyReportFilter(paged.content);
        if (page === 0) this.reports.set(filtered);
        else this.reports.update(p => [...p, ...filtered]);
        this.rPage = paged.page;
        this.rHasMore.set(!paged.last);
        this.rIsLoading.set(false);
        this.rIsLoadingMore.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.rLoadError.set(err.status === 403
          ? 'No tienes permiso para ver esta sección.'
          : 'No se pudo cargar los reportes.'
        );
        this.rIsLoading.set(false);
        this.rIsLoadingMore.set(false);
      },
    });
  }

  private applyReportFilter(items: ReportResponse[]): ReportResponse[] {
    const f = this.reportStatusFilter();
    return f === 'ALL' ? items : items.filter(r => r.status === f);
  }

  setReportFilter(value: ReportStatus | 'ALL'): void {
    this.reportStatusFilter.set(value);
    this.loadReports(0);
  }

  loadMoreReports(): void {
    if (this.rIsLoadingMore() || !this.rHasMore()) return;
    this.loadReports(this.rPage + 1);
  }

  toggleReport(report: ReportResponse): void {
    this.expandedReportId.set(this.expandedReportId() === report.id ? null : report.id);
    if (!this.resolutionNotes.has(report.id)) this.resolutionNotes.set(report.id, '');
  }

  isReportExpanded(id: string): boolean  { return this.expandedReportId() === id; }
  isResolving(id: string): boolean       { return this.resolvingId() === id; }

  getNoteFor(id: string): string { return this.resolutionNotes.get(id) ?? ''; }
  setNoteFor(id: string, val: string): void { this.resolutionNotes.set(id, val); }

  submitResolve(report: ReportResponse): void {
    const note = this.getNoteFor(report.id).trim();
    if (!note) { this.toast.error('La nota de resolución es obligatoria'); return; }
    this.resolvingId.set(report.id);
    this.moderationService.resolveReport(report.id, { resolutionNote: note }).subscribe({
      next: updated => {
        this.reports.update(l => l.map(r => r.id === updated.id ? updated : r));
        this.expandedReportId.set(null);
        this.resolvingId.set(null);
        this.toast.success('Reporte resuelto');
      },
      error: (err: HttpErrorResponse) => {
        this.resolvingId.set(null);
        if (err.status === 409) this.toast.error('Este reporte ya fue resuelto');
        else if (err.status === 403) this.toast.error('No tienes permiso para resolver reportes');
        else this.toast.error('No se pudo resolver el reporte.');
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────
  docTypeLabel(type: string): string  { return this.documentTypeLabels[type] ?? type; }
  entityLabel(type: string): string   { return type === 'ACADEMY' ? 'Academia' : 'Docente'; }
  targetLabel(type: string): string   { return this.reportTargetLabels[type as keyof typeof this.reportTargetLabels] ?? type; }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
