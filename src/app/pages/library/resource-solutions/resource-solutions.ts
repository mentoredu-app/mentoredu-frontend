import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LibraryService } from '../../../services/library.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { AiService } from '../../../services/ai.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse } from '../../../models/resource.model';
import { SolutionResponse } from '../../../models/pedagogy.model';
import { ReportResponse } from '../../../models/ai.model';

type SolutionSortMode = 'date_desc' | 'date_asc' | 'student_asc';

@Component({
  selector: 'app-resource-solutions',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './resource-solutions.html',
  styleUrl: './resource-solutions.css',
})
export class ResourceSolutions implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private http            = inject(HttpClient);
  private sanitizer       = inject(DomSanitizer);
  private libraryService  = inject(LibraryService);
  private pedagogyService = inject(PedagogyService);
  private aiService       = inject(AiService);
  private toast           = inject(ToastService);
  readonly authState      = inject(AuthStateService);

  readonly isLoading    = signal(true);
  readonly loadError    = signal('');
  readonly resource     = signal<ResourceResponse | null>(null);
  readonly solutions    = signal<SolutionResponse[]>([]);
  readonly sortMode     = signal<SolutionSortMode>('date_desc');
  readonly selectedIds  = signal<Set<string>>(new Set());
  readonly report       = signal<ReportResponse | null>(null);
  readonly reporting    = signal(false);

  // Detail expansion — stores detail data keyed by solutionId
  readonly expandedId       = signal<string | null>(null);
  readonly loadingDetailId  = signal<string | null>(null);
  readonly detailCache      = signal<Record<string, SolutionResponse>>({});
  readonly downloadingId    = signal<string | null>(null);
  readonly deletingId       = signal<string | null>(null);
  readonly previewCache     = signal<Record<string, SafeResourceUrl>>({});
  readonly previewLoading   = signal<Set<string>>(new Set());
  readonly previewError     = signal<Set<string>>(new Set());

  readonly sortedSolutions = computed(() => {
    const list = [...this.solutions()];
    const mode = this.sortMode();
    if (mode === 'student_asc') {
      return list.sort((a, b) => this.studentLabel(a).localeCompare(this.studentLabel(b), 'es'));
    }
    if (mode === 'date_asc') {
      return list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  private readonly serverUrl = environment.apiUrl.replace('/api/v1', '');
  private blobUrls: string[] = [];

  ngOnInit(): void {
    const resourceId = this.route.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('resourceId')!;

    forkJoin({
      resource:  this.libraryService.getById(resourceId),
      solutions: this.pedagogyService.getSolutions(resourceId),
    }).subscribe({
      next: ({ resource, solutions }) => {
        this.resource.set(resource);
        this.solutions.set(solutions);
        this.selectedIds.set(new Set(solutions.map(s => s.id)));
        this.isLoading.set(false);
      },
      error: (err) => {
        if (err.status === 403) {
          this.loadError.set('Solo el autor del ejercicio puede ver las resoluciones.');
        } else if (err.status === 404) {
          this.loadError.set('El recurso no existe.');
        } else {
          this.loadError.set('No se pudo cargar las resoluciones. Intenta de nuevo.');
        }
        this.isLoading.set(false);
      },
    });
  }

  setSortMode(mode: SolutionSortMode): void {
    this.sortMode.set(mode);
  }

  toggleSelection(solutionId: string, event: Event): void {
    event.stopPropagation();
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(solutionId)) next.delete(solutionId);
      else next.add(solutionId);
      return next;
    });
  }

  selectAll(): void {
    this.selectedIds.set(new Set(this.solutions().map(s => s.id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  isSelected(solutionId: string): boolean {
    return this.selectedIds().has(solutionId);
  }

  runReport(solutionIds?: string[]): void {
    const resource = this.resource();
    if (!resource || this.reporting()) return;

    const ids = solutionIds ?? [...this.selectedIds()];
    if (!ids.length) {
      this.toast.error('Selecciona al menos una resoluciÃ³n para analizar.');
      return;
    }

    this.reporting.set(true);
    this.aiService.getReport(resource.id, ids).subscribe({
      next: report => {
        this.report.set(report);
        this.reporting.set(false);
      },
      error: () => {
        this.reporting.set(false);
        this.toast.error('No se pudo generar el anÃ¡lisis IA.');
      },
    });
  }

  ngOnDestroy(): void {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
  }

  toggleExpand(solution: SolutionResponse): void {
    const current = this.expandedId();
    if (current === solution.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(solution.id);
    const cached = this.detailCache()[solution.id];
    if (cached) {
      if (cached.fileUrl) this.ensurePdfPreview(cached.fileUrl);
      return;
    }

    const resourceId = this.resource()!.id;
    this.loadingDetailId.set(solution.id);
    this.pedagogyService.getSolutionDetail(resourceId, solution.id).subscribe({
      next: detail => {
        this.detailCache.update(c => ({ ...c, [solution.id]: detail }));
        if (detail.fileUrl) this.ensurePdfPreview(detail.fileUrl);
        this.loadingDetailId.set(null);
      },
      error: () => {
        this.loadingDetailId.set(null);
        this.toast.error('No se pudo cargar el detalle de esta resolución.');
      },
    });
  }

  downloadSolutionPdf(solution: SolutionResponse): void {
    const detail = this.detailCache()[solution.id];
    if (!detail?.fileUrl || this.downloadingId() === solution.id) return;

    this.downloadingId.set(solution.id);
    const url = this.resolveUrl(detail.fileUrl);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrls.push(blobUrl);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `resolucion-${(solution.studentName ?? 'estudiante').replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.downloadingId.set(null);
      },
      error: () => {
        this.downloadingId.set(null);
        this.toast.error('No se pudo descargar el archivo.');
      },
    });
  }

  deleteSolution(solution: SolutionResponse): void {
    const resource = this.resource();
    if (!resource || this.authState.role() !== 'ADMIN' || this.deletingId()) return;
    if (!window.confirm(`Eliminar la resolucion de ${this.studentLabel(solution)}?`)) return;

    this.deletingId.set(solution.id);
    this.pedagogyService.deleteSolution(resource.id, solution.id).subscribe({
      next: () => {
        this.solutions.update(list => list.filter(item => item.id !== solution.id));
        this.selectedIds.update(current => {
          const next = new Set(current);
          next.delete(solution.id);
          return next;
        });
        this.detailCache.update(cache => {
          const { [solution.id]: _removed, ...rest } = cache;
          return rest;
        });
        if (this.expandedId() === solution.id) this.expandedId.set(null);
        this.deletingId.set(null);
      },
      error: () => {
        this.toast.error('No se pudo eliminar la resolucion.');
        this.deletingId.set(null);
      },
    });
  }

  pdfPreviewUrl(url: string): SafeResourceUrl | null {
    return this.previewCache()[url] ?? null;
  }

  isPreviewLoading(url: string): boolean {
    return this.previewLoading().has(url);
  }

  hasPreviewError(url: string): boolean {
    return this.previewError().has(url);
  }

  private ensurePdfPreview(url: string): void {
    if (this.previewCache()[url] || this.previewLoading().has(url) || this.previewError().has(url)) return;
    this.previewLoading.update(current => new Set(current).add(url));
    this.http.get(this.resolveUrl(url), { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        this.blobUrls.push(blobUrl);
        const safe = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
        this.previewCache.update(cache => ({ ...cache, [url]: safe }));
        this.previewLoading.update(current => {
          const next = new Set(current);
          next.delete(url);
          return next;
        });
      },
      error: () => {
        this.previewLoading.update(current => {
          const next = new Set(current);
          next.delete(url);
          return next;
        });
        this.previewError.update(current => new Set(current).add(url));
      },
    });
  }

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${this.serverUrl}${path}`;
  }

  isExpanded(id: string): boolean { return this.expandedId() === id; }
  isLoadingDetail(id: string): boolean { return this.loadingDetailId() === id; }
  isDownloading(id: string): boolean { return this.downloadingId() === id; }
  isDeleting(id: string): boolean { return this.deletingId() === id; }

  studentLabel(solution: SolutionResponse): string {
    return solution.studentName || 'Estudiante';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  statusLabel(status: string): string {
    return status === 'REVIEWED' ? 'Revisada' : 'Enviada';
  }
}
