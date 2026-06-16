import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { CommunityService } from '../../../services/community.service';
import { FileUploadService } from '../../../services/file-upload.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { DocImagePreview } from '../../../shared/components/doc-image-preview/doc-image-preview';
import { University } from '../../../models/catalog.model';
import {
  VerificationResponse, VerificationEntityType,
  VERIFICATION_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES,
} from '../../../models/community.model';

@Component({
  selector: 'app-verification-request',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner, DocImagePreview],
  templateUrl: './verification-request.html',
  styleUrl: './verification-request.css',
})
export class VerificationRequest implements OnInit {
  private fb                = inject(FormBuilder);
  private catalogService    = inject(CatalogService);
  private communityService  = inject(CommunityService);
  private fileUploadService = inject(FileUploadService);
  readonly authState        = inject(AuthStateService);
  private toast             = inject(ToastService);

  readonly isLoading     = signal(true);
  readonly isSubmitting  = signal(false);
  readonly myRequests    = signal<VerificationResponse[]>([]);
  readonly latestRequest = signal<VerificationResponse | null>(null);
  readonly showForm      = signal(false);
  readonly universities  = signal<University[]>([]);

  readonly statusLabels       = VERIFICATION_STATUS_LABELS;
  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;
  readonly documentTypes      = DOCUMENT_TYPES;

  readonly pendingFiles = signal<(File | null)[]>([null]);

  readonly allDocsHaveFiles = computed(() =>
    this.pendingFiles().length > 0 && this.pendingFiles().every(f => f !== null)
  );

  form!: FormGroup;

  get documents(): FormArray {
    return this.form.get('documents') as FormArray;
  }

  ngOnInit(): void {
    const role = this.authState.role();
    const entityType: VerificationEntityType = role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER';

    this.form = this.fb.group({
      entityType: [{ value: entityType, disabled: true }],
      universityId: ['', Validators.required],
      documents:  this.fb.array([this.createDocumentGroup()]),
    });

    this.catalogService.getUniversities().subscribe({
      next: universities => this.universities.set(universities),
    });

    this.communityService.getMyVerifications(0, 5).subscribe({
      next: paged => {
        this.myRequests.set(paged.content);
        const latest = paged.content[0] ?? null;
        this.latestRequest.set(latest);
        this.showForm.set(!latest || latest.status === 'REJECTED');
        this.isLoading.set(false);
      },
      error: () => {
        this.showForm.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private createDocumentGroup(): FormGroup {
    return this.fb.group({
      documentType: ['DNI', Validators.required],
    });
  }

  addDocument(): void {
    this.documents.push(this.createDocumentGroup());
    this.pendingFiles.update(files => [...files, null]);
  }

  removeDocument(index: number): void {
    if (this.documents.length > 1) {
      this.documents.removeAt(index);
      this.pendingFiles.update(files => files.filter((_, i) => i !== index));
    }
  }

  onFileSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.pendingFiles.update(files => {
      const updated = [...files];
      updated[index] = file;
      return updated;
    });
  }

  submit(): void {
    if (this.isSubmitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const files = this.pendingFiles();
    if (files.some(f => f === null)) {
      this.toast.error('Debes adjuntar una imagen a cada documento');
      return;
    }

    this.isSubmitting.set(true);

    forkJoin(files.map(f => this.fileUploadService.uploadImage(f!))).subscribe({
      next: uploadResults => {
        const role = this.authState.role();
        const entityType: VerificationEntityType = role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER';
        const universityId = this.form.get('universityId')!.value as string;
        const documents = uploadResults.map((result, i) => ({
          documentType: this.getDocGroup(i).get('documentType')!.value as string,
          fileUrl:      result.fileUrl,
        }));

        this.communityService.requestVerification({ entityType, universityId, documents }).subscribe({
          next: res => {
            this.toast.success('Solicitud de verificación enviada correctamente');
            this.myRequests.update(list => [res, ...list]);
            this.latestRequest.set(res);
            this.showForm.set(false);
            this.isSubmitting.set(false);
          },
          error: (err: HttpErrorResponse) => {
            if (err.status === 409) {
              this.toast.error('Ya tienes una solicitud de verificación pendiente');
            } else if (err.status === 400) {
              this.toast.error(err.error?.message ?? 'Revisa los documentos e intenta de nuevo');
            } else {
              this.toast.error('No se pudo enviar la solicitud. Intenta de nuevo.');
            }
            this.isSubmitting.set(false);
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 415) {
          this.toast.error('Solo se aceptan imágenes PNG o JPEG.');
        } else if (err.status === 413) {
          this.toast.error('Una imagen supera el tamaño máximo de 5 MB.');
        } else {
          this.toast.error('Error al subir los archivos. Intenta de nuevo.');
        }
        this.isSubmitting.set(false);
      },
    });
  }

  openForm(): void {
    this.showForm.set(true);
    while (this.documents.length > 1) this.documents.removeAt(1);
    const role = this.authState.role();
    this.form.get('entityType')?.setValue(role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER');
    this.form.get('universityId')?.reset('');
    this.documents.at(0).reset({ documentType: 'DNI' });
    this.pendingFiles.set([null]);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  docTypeLabel(type: string): string {
    return this.documentTypeLabels[type] ?? type;
  }

  getDocGroup(index: number): FormGroup {
    return this.documents.at(index) as FormGroup;
  }

  fileName(index: number): string {
    return this.pendingFiles()[index]?.name ?? '';
  }

  universityName(id?: string): string {
    if (!id) return '';
    return this.universities().find(u => u.id === id)?.name ?? 'Universidad no registrada';
  }
}
