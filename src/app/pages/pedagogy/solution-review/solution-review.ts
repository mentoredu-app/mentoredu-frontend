import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';
import { PedagogyService } from '../../../services/pedagogy.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { FeedbackResponse, SolutionResponse } from '../../../models/pedagogy.model';

type PageState = 'loading' | 'load-error' | 'already-reviewed' | 'form' | 'success';

@Component({
  selector: 'app-solution-review',
  imports: [RouterLink, ReactiveFormsModule, LoadingSpinner],
  templateUrl: './solution-review.html',
  styleUrl: './solution-review.css',
})
export class SolutionReview implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private fb              = inject(FormBuilder);
  private http            = inject(HttpClient);
  private sanitizer       = inject(DomSanitizer);
  private pedagogyService = inject(PedagogyService);
  private toast           = inject(ToastService);
  readonly authState      = inject(AuthStateService);

  readonly pageState       = signal<PageState>('loading');
  readonly loadError       = signal('');
  readonly solution        = signal<SolutionResponse | null>(null);
  readonly existingFeedback = signal<FeedbackResponse | null>(null);
  readonly newFeedback     = signal<FeedbackResponse | null>(null);

  readonly isSubmitting    = signal(false);
  readonly submitError     = signal('');
  readonly isDownloading   = signal(false);
  readonly previewUrl      = signal<SafeResourceUrl | null>(null);
  readonly isPreviewLoading = signal(false);
  readonly previewError    = signal('');

  readonly feedbackForm = this.fb.nonNullable.group({
    body:  ['', [Validators.required, Validators.minLength(5)]],
    score: [null as number | null],
  });

  private resourceId!: string;
  private solutionId!: string;
  private readonly serverUrl = environment.apiUrl.replace('/api/v1', '');
  private blobUrls: string[] = [];

  ngOnInit(): void {
    this.resourceId = this.route.snapshot.paramMap.get('resourceId')!;
    this.solutionId = this.route.snapshot.paramMap.get('solutionId')!;

    this.pedagogyService.getSolutionDetail(this.resourceId, this.solutionId).subscribe({
      next: solution => {
        this.solution.set(solution);
        if (solution.fileUrl) this.loadPdfPreview(solution.fileUrl);

        if (solution.status === 'REVIEWED') {
          // Feedback ya existe — lo cargamos solo en este caso
          this.pedagogyService.getFeedback(this.solutionId).subscribe({
            next: fb => {
              this.existingFeedback.set(fb);
              this.pageState.set('already-reviewed');
            },
            error: () => this.pageState.set('already-reviewed'),
          });
        } else {
          // SUBMITTED — ir directo al formulario sin GET feedback
          this.pageState.set('form');
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.loadError.set('Solo el autor del ejercicio puede dar feedback.');
        } else if (err.status === 404) {
          this.loadError.set('La resolución no existe.');
        } else {
          this.loadError.set('No se pudo cargar la resolución. Intenta de nuevo.');
        }
        this.pageState.set('load-error');
      },
    });
  }

  ngOnDestroy(): void {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
  }

  submit(): void {
    this.feedbackForm.markAllAsTouched();
    if (this.feedbackForm.invalid || this.isSubmitting()) return;

    const raw = this.feedbackForm.getRawValue();
    const scoreVal = raw.score;

    if (scoreVal !== null && (scoreVal < 0 || scoreVal > 10)) {
      this.submitError.set('La nota debe estar entre 0 y 10.');
      return;
    }

    this.submitError.set('');
    this.isSubmitting.set(true);

    this.pedagogyService.giveFeedback(this.solutionId, {
      body:  raw.body.trim(),
      score: scoreVal ?? undefined,
    }).subscribe({
      next: fb => {
        this.newFeedback.set(fb);
        this.isSubmitting.set(false);
        this.pageState.set('success');
        this.toast.success('Feedback enviado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.submitError.set('Ya existe feedback para esta resolución.');
        } else if (err.status === 403) {
          this.submitError.set(err.error?.message ?? 'No tienes permiso para dar feedback.');
        } else if (err.status === 400) {
          const details = err.error?.details;
          if (details?.score) {
            this.submitError.set(`Nota inválida: ${details.score}`);
          } else {
            this.submitError.set(err.error?.message ?? 'Verifica los datos ingresados.');
          }
        } else {
          this.submitError.set('Error al enviar el feedback. Intenta de nuevo.');
        }
      },
    });
  }

  private loadPdfPreview(fileUrl: string): void {
    this.isPreviewLoading.set(true);
    this.previewError.set('');
    this.http.get(this.resolveUrl(fileUrl), { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        this.blobUrls.push(blobUrl);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl));
        this.isPreviewLoading.set(false);
      },
      error: () => {
        this.previewError.set('No se pudo cargar la vista previa del PDF.');
        this.isPreviewLoading.set(false);
      },
    });
  }

  downloadPdf(): void {
    const sol = this.solution();
    if (!sol?.fileUrl || this.isDownloading()) return;

    this.isDownloading.set(true);
    const url = this.resolveUrl(sol.fileUrl);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrls.push(blobUrl);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `resolucion-${(sol.studentName ?? 'estudiante').replace(/\s+/g, '-')}.pdf`;
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

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.serverUrl}${url.startsWith('/') ? url : '/' + url}`;
  }

  fieldError(field: string): string {
    const ctrl = this.feedbackForm.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))  return 'Este campo es obligatorio';
    if (ctrl.hasError('minlength')) return 'El comentario debe tener al menos 5 caracteres';
    return '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  get solutionsLink(): string[] {
    return ['/pedagogy', 'received', this.resourceId];
  }
}
