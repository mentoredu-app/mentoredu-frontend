import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import {
  VerificationResponse, VerificationEntityType,
  VERIFICATION_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES,
} from '../../../models/community.model';

@Component({
  selector: 'app-verification-request',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './verification-request.html',
  styleUrl: './verification-request.css',
})
export class VerificationRequest implements OnInit {
  private fb               = inject(FormBuilder);
  private communityService = inject(CommunityService);
  readonly authState       = inject(AuthStateService);
  private toast            = inject(ToastService);

  readonly isLoading      = signal(true);
  readonly isSubmitting   = signal(false);
  readonly myRequests     = signal<VerificationResponse[]>([]);
  readonly latestRequest  = signal<VerificationResponse | null>(null);
  readonly showForm       = signal(false);

  readonly statusLabels       = VERIFICATION_STATUS_LABELS;
  readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;
  readonly documentTypes      = DOCUMENT_TYPES;

  form!: FormGroup;

  get documents(): FormArray {
    return this.form.get('documents') as FormArray;
  }

  ngOnInit(): void {
    const role = this.authState.role();
    const entityType: VerificationEntityType = role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER';

    this.form = this.fb.group({
      entityType: [{ value: entityType, disabled: true }],
      documents:  this.fb.array([this.createDocumentGroup()]),
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
      fileUrl: ['', [Validators.required, Validators.minLength(4)]],
    });
  }

  addDocument(): void {
    this.documents.push(this.createDocumentGroup());
  }

  removeDocument(index: number): void {
    if (this.documents.length > 1) this.documents.removeAt(index);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    const role = this.authState.role();
    const entityType: VerificationEntityType = role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER';

    this.communityService.requestVerification({
      entityType,
      documents: this.documents.value,
    }).subscribe({
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
  }

  openForm(): void {
    this.showForm.set(true);
    this.form.reset();
    while (this.documents.length > 1) this.documents.removeAt(1);
    const role = this.authState.role();
    this.form.get('entityType')?.setValue(role === 'ACADEMY' ? 'ACADEMY' : 'TEACHER');
    this.documents.at(0).reset({ documentType: 'DNI', fileUrl: '' });
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

  isFieldInvalid(group: FormGroup, field: string): boolean {
    const ctrl = group.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }
}
