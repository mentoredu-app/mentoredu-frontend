import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LibraryService } from '../../../services/library.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse } from '../../../models/resource.model';
import { SolutionResponse } from '../../../models/pedagogy.model';

@Component({
  selector: 'app-resource-solutions',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './resource-solutions.html',
  styleUrl: './resource-solutions.css',
})
export class ResourceSolutions implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private http            = inject(HttpClient);
  private libraryService  = inject(LibraryService);
  private pedagogyService = inject(PedagogyService);
  private toast           = inject(ToastService);
  readonly authState      = inject(AuthStateService);

  readonly isLoading    = signal(true);
  readonly loadError    = signal('');
  readonly resource     = signal<ResourceResponse | null>(null);
  readonly solutions    = signal<SolutionResponse[]>([]);

  // Detail expansion — stores detail data keyed by solutionId
  readonly expandedId       = signal<string | null>(null);
  readonly loadingDetailId  = signal<string | null>(null);
  readonly detailCache      = signal<Record<string, SolutionResponse>>({});
  readonly downloadingId    = signal<string | null>(null);

  private readonly serverUrl = environment.apiUrl.replace('/api/v1', '');
  private blobUrls: string[] = [];

  ngOnInit(): void {
    const resourceId = this.route.snapshot.paramMap.get('id')!;

    forkJoin({
      resource:  this.libraryService.getById(resourceId),
      solutions: this.pedagogyService.getSolutions(resourceId),
    }).subscribe({
      next: ({ resource, solutions }) => {
        this.resource.set(resource);
        this.solutions.set(solutions);
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
    if (this.detailCache()[solution.id]) return;

    const resourceId = this.resource()!.id;
    this.loadingDetailId.set(solution.id);
    this.pedagogyService.getSolutionDetail(resourceId, solution.id).subscribe({
      next: detail => {
        this.detailCache.update(c => ({ ...c, [solution.id]: detail }));
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

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${this.serverUrl}${path}`;
  }

  isExpanded(id: string): boolean { return this.expandedId() === id; }
  isLoadingDetail(id: string): boolean { return this.loadingDetailId() === id; }
  isDownloading(id: string): boolean { return this.downloadingId() === id; }

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
