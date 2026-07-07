import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LibraryService } from '../../../services/library.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ResourceResponse } from '../../../models/resource.model';
import { MySolutionWithFeedbackResponse } from '../../../models/pedagogy.model';

type PageState = 'loading' | 'load-error' | 'no-solution' | 'ready';

@Component({
  selector: 'app-my-solution',
  imports: [RouterLink, LoadingSpinner],
  templateUrl: './my-solution.html',
  styleUrl: './my-solution.css',
})
export class MySolution implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private http            = inject(HttpClient);
  private libraryService  = inject(LibraryService);
  private pedagogyService = inject(PedagogyService);
  private toast           = inject(ToastService);

  readonly pageState    = signal<PageState>('loading');
  readonly loadError    = signal('');
  readonly resource     = signal<ResourceResponse | null>(null);
  readonly data         = signal<MySolutionWithFeedbackResponse | null>(null);
  readonly isDownloading = signal(false);
  readonly isMutating    = signal(false);

  private resourceId!: string;
  private readonly serverUrl = environment.apiUrl.replace('/api/v1', '');
  private blobUrls: string[] = [];

  ngOnInit(): void {
    this.resourceId = this.route.snapshot.paramMap.get('resourceId')!;

    this.libraryService.getById(this.resourceId).subscribe({
      next: resource => {
        this.resource.set(resource);
        this.pedagogyService.getMySolution(this.resourceId).subscribe({
          next: result => {
            this.data.set(result);
            this.pageState.set('ready');
          },
          error: (err: HttpErrorResponse) => {
            if (err.status === 404) {
              this.pageState.set('no-solution');
            } else {
              this.loadError.set('No se pudo cargar tu resolución. Intenta de nuevo.');
              this.pageState.set('load-error');
            }
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'El ejercicio no existe.' : 'No se pudo cargar el ejercicio.');
        this.pageState.set('load-error');
      },
    });
  }

  ngOnDestroy(): void {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
  }

  downloadPdf(): void {
    const sol = this.data()?.solution;
    if (!sol?.fileUrl || this.isDownloading()) return;

    this.isDownloading.set(true);
    const url = this.resolveUrl(sol.fileUrl);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrls.push(blobUrl);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `mi-resolucion-${this.resourceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.isDownloading.set(false);
      },
      error: () => {
        this.isDownloading.set(false);
        this.toast.error('No se pudo descargar el archivo.');
      },
    });
  }

  editSolution(): void {
    const current = this.data();
    if (!current || this.isMutating()) return;
    const content = window.prompt('Editar texto de tu resolucion:', current.solution.content ?? '');
    if (content === null) return;

    this.isMutating.set(true);
    this.pedagogyService.updateSolution(this.resourceId, current.solution.id, {
      content,
      fileUrl: current.solution.fileUrl,
    }).subscribe({
      next: updated => {
        this.data.set({ solution: updated, feedback: null });
        this.isMutating.set(false);
        this.toast.success('Resolucion actualizada');
      },
      error: (err: HttpErrorResponse) => {
        this.isMutating.set(false);
        this.toast.error(err.error?.message ?? 'No se pudo actualizar tu resolucion.');
      },
    });
  }

  deleteSolution(): void {
    const current = this.data();
    if (!current || this.isMutating()) return;
    if (!window.confirm('Eliminar tu resolucion enviada?')) return;

    this.isMutating.set(true);
    this.pedagogyService.deleteSolution(this.resourceId, current.solution.id).subscribe({
      next: () => {
        this.toast.success('Resolucion eliminada');
        this.router.navigate(['/library', this.resourceId]);
      },
      error: (err: HttpErrorResponse) => {
        this.isMutating.set(false);
        this.toast.error(err.error?.message ?? 'No se pudo eliminar tu resolucion.');
      },
    });
  }

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.serverUrl}${url.startsWith('/') ? url : '/' + url}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
