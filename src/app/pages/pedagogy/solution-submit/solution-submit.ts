import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LibraryService } from '../../../services/library.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ResourceResponse } from '../../../models/resource.model';
import { MySolutionWithFeedbackResponse, SolutionResponse } from '../../../models/pedagogy.model';
import { ResourceFileResponse } from '../../../models/resource.model';

type PageState = 'loading' | 'load-error' | 'not-allowed' | 'already-submitted' | 'form' | 'success';
type SubmitTab = 'pdf' | 'text';

@Component({
  selector: 'app-solution-submit',
  imports: [RouterLink, ReactiveFormsModule, LoadingSpinner],
  templateUrl: './solution-submit.html',
  styleUrl: './solution-submit.css',
})
export class SolutionSubmit implements OnInit {
  private route           = inject(ActivatedRoute);
  private fb              = inject(FormBuilder);
  private libraryService  = inject(LibraryService);
  private pedagogyService = inject(PedagogyService);
  readonly authState      = inject(AuthStateService);

  readonly pageState   = signal<PageState>('loading');
  readonly loadError   = signal('');
  readonly resource    = signal<ResourceResponse | null>(null);
  readonly existing    = signal<MySolutionWithFeedbackResponse | null>(null);
  readonly submitted   = signal<SolutionResponse | null>(null);

  // Submission mode
  readonly activeTab   = signal<SubmitTab>('pdf');

  // PDF upload state
  readonly isUploading     = signal(false);
  readonly isDragging      = signal(false);
  readonly uploadedFile    = signal<ResourceFileResponse | null>(null);
  readonly selectedPdfName = signal('');
  readonly uploadError     = signal('');

  // Text form
  readonly textForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.minLength(10)]],
  });

  readonly isSubmitting = signal(false);
  readonly submitError  = signal('');

  ngOnInit(): void {
    const resourceId = this.route.snapshot.paramMap.get('resourceId')!;

    this.libraryService.getById(resourceId).subscribe({
      next: resource => {
        this.resource.set(resource);

        if (!resource.aceptaResoluciones || this.authState.role() !== 'STUDENT') {
          this.pageState.set('not-allowed');
          return;
        }

        if (resource.mySubmission) {
          // El recurso ya trae el estado de la resolución — cargamos el detalle completo.
          // getMySolution devuelve 200 aquí porque sabemos que la resolución existe.
          this.pedagogyService.getMySolution(resourceId).subscribe({
            next: existing => {
              this.existing.set(existing);
              this.pageState.set('already-submitted');
            },
            error: () => this.pageState.set('form'),
          });
        } else {
          this.pageState.set('form');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'El ejercicio no existe.' : 'No se pudo cargar el ejercicio.');
        this.pageState.set('load-error');
      },
    });
  }

  setTab(tab: SubmitTab): void {
    this.activeTab.set(tab);
    this.submitError.set('');
  }

  // ── PDF upload ───────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.handleFile(input.files[0]);
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); this.isDragging.set(true); }
  onDragLeave(): void { this.isDragging.set(false); }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    this.uploadError.set('');
    if (file.type !== 'application/pdf') { this.uploadError.set('Solo se permiten archivos PDF.'); return; }
    if (file.size > 20 * 1024 * 1024) { this.uploadError.set('El archivo no puede superar 20 MB.'); return; }

    this.selectedPdfName.set(file.name);
    this.isUploading.set(true);
    this.libraryService.uploadFile(file).subscribe({
      next: resp => { this.uploadedFile.set(resp); this.isUploading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.isUploading.set(false);
        this.selectedPdfName.set('');
        if (err.status === 415) this.uploadError.set('El archivo no es un PDF válido.');
        else if (err.status === 413) this.uploadError.set('El archivo supera 20 MB.');
        else this.uploadError.set('Error al subir el archivo. Intenta de nuevo.');
      },
    });
  }

  clearPdf(): void {
    this.uploadedFile.set(null);
    this.selectedPdfName.set('');
    this.uploadError.set('');
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  submit(): void {
    this.submitError.set('');
    const resourceId = this.resource()!.id;

    let body: { fileUrl?: string; content?: string };

    if (this.activeTab() === 'pdf') {
      const file = this.uploadedFile();
      if (!file) { this.submitError.set('Debes subir un archivo PDF antes de enviar.'); return; }
      body = { fileUrl: file.fileUrl };
    } else {
      this.textForm.markAllAsTouched();
      if (this.textForm.invalid) return;
      body = { content: this.textForm.getRawValue().content.trim() };
    }

    this.isSubmitting.set(true);
    this.pedagogyService.submitSolution(resourceId, body).subscribe({
      next: sol => {
        this.submitted.set(sol);
        this.isSubmitting.set(false);
        this.pageState.set('success');
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.submitError.set('Ya enviaste una resolución para este ejercicio.');
        } else if (err.status === 403) {
          this.submitError.set(err.error?.message ?? 'No tienes permiso para enviar resoluciones.');
        } else if (err.status === 400) {
          this.submitError.set(err.error?.message ?? 'Debes proporcionar un archivo o contenido de texto.');
        } else {
          this.submitError.set('Error al enviar la resolución. Intenta de nuevo.');
        }
      },
    });
  }

  fieldError(field: string): string {
    const ctrl = this.textForm.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required')) return 'Este campo es obligatorio';
    if (ctrl.hasError('minlength')) return 'La respuesta debe tener al menos 10 caracteres';
    return '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatSize(bytes: number): string {
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
}
