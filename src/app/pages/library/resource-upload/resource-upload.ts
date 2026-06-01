import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { LibraryService } from '../../../services/library.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { Area, Career, Course, University } from '../../../models/catalog.model';
import {
  ResourceFileResponse,
  ResourceType,
  RESOURCE_TYPE_LABELS,
  TYPES_REQUIRING_COURSE,
} from '../../../models/resource.model';

@Component({
  selector: 'app-resource-upload',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './resource-upload.html',
  styleUrl: './resource-upload.css',
})
export class ResourceUpload implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private libraryService = inject(LibraryService);
  private catalogService = inject(CatalogService);
  private toast = inject(ToastService);
  readonly authState = inject(AuthStateService);
  private destroyRef = inject(DestroyRef);

  readonly step = signal<1 | 2>(1);
  readonly isUploading = signal(false);
  readonly isPublishing = signal(false);
  readonly isDragging = signal(false);

  readonly uploadedFile = signal<ResourceFileResponse | null>(null);
  readonly selectedFileName = signal('');
  readonly uploadError = signal('');

  readonly universities = signal<University[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly careers = signal<Career[]>([]);
  readonly courses = signal<Course[]>([]);

  readonly typeLabels = RESOURCE_TYPE_LABELS;
  readonly resourceTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

  readonly metaForm = this.fb.nonNullable.group({
    title:        ['', [Validators.required, Validators.maxLength(200)]],
    resourceType: ['' as ResourceType, [Validators.required]],
    universityId: ['', [Validators.required]],
    areaId:       ['', [Validators.required]],
    careerId:     [''],
    courseId:     [''],
  });

  // Signal actualizado via valueChanges para que funcione en zoneless Angular
  readonly selectedType = signal<ResourceType | ''>('');
  readonly requiresCourse = computed(() => TYPES_REQUIRING_COURSE.includes(this.selectedType() as ResourceType));

  readonly isAllowedRole = computed(() => {
    const r = this.authState.role();
    return r === 'TEACHER' || r === 'ACADEMY' || r === 'ADMIN';
  });

  ngOnInit(): void {
    this.catalogService.getUniversities().subscribe({
      next: unis => this.universities.set(unis),
    });

    this.metaForm.get('resourceType')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(type => {
      this.selectedType.set(type as ResourceType | '');
      const courseCtrl = this.metaForm.get('courseId')!;
      if (TYPES_REQUIRING_COURSE.includes(type as ResourceType)) {
        courseCtrl.addValidators(Validators.required);
      } else {
        courseCtrl.clearValidators();
        courseCtrl.setValue('');
      }
      courseCtrl.updateValueAndValidity();
    });

    this.metaForm.get('universityId')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      this.areas.set([]);
      this.careers.set([]);
      this.courses.set([]);
      this.metaForm.patchValue({ areaId: '', careerId: '', courseId: '' });
      if (id) {
        this.catalogService.getAreasByUniversity(id).subscribe({ next: a => this.areas.set(a) });
        this.catalogService.getCareersByUniversity(id).subscribe({ next: c => this.careers.set(c) });
      }
    });

    this.metaForm.get('areaId')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      this.courses.set([]);
      this.metaForm.patchValue({ courseId: '' });
      if (id) {
        this.catalogService.getCoursesByArea(id).subscribe({ next: c => this.courses.set(c) });
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.handleFile(input.files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    this.uploadError.set('');

    if (file.type !== 'application/pdf') {
      this.uploadError.set('Solo se permiten archivos PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.uploadError.set('El archivo no puede superar 20 MB.');
      return;
    }

    this.selectedFileName.set(file.name);
    this.isUploading.set(true);
    this.libraryService.uploadFile(file).subscribe({
      next: resp => {
        this.uploadedFile.set(resp);
        this.isUploading.set(false);
        this.step.set(2);
      },
      error: (err: HttpErrorResponse) => {
        this.isUploading.set(false);
        this.selectedFileName.set('');
        if (err.status === 415) {
          this.uploadError.set('El archivo no es un PDF válido.');
        } else if (err.status === 413) {
          this.uploadError.set('El archivo supera el límite de 20 MB permitido.');
        } else {
          this.uploadError.set('Error al subir el archivo. Intenta de nuevo.');
        }
      },
    });
  }

  publish(): void {
    this.metaForm.markAllAsTouched();
    const fileInfo = this.uploadedFile();
    if (!fileInfo || this.isPublishing()) return;

    if (this.metaForm.invalid) {
      if (this.requiresCourse() && !this.metaForm.get('courseId')!.value) {
        this.toast.error('El tipo seleccionado requiere especificar un curso.');
      }
      return;
    }

    const raw = this.metaForm.getRawValue();
    this.isPublishing.set(true);
    this.libraryService.publish({
      title:        raw.title,
      resourceType: raw.resourceType,
      universityId: raw.universityId,
      areaId:       raw.areaId,
      careerId:     raw.careerId  || undefined,
      courseId:     raw.courseId  || undefined,
      fileUrl:      fileInfo.fileUrl,
      fileName:     fileInfo.fileName,
      mimeType:     fileInfo.mimeType,
      sizeBytes:    fileInfo.sizeBytes,
    }).subscribe({
      next: () => {
        this.isPublishing.set(false);
        this.toast.success('Recurso publicado exitosamente');
        this.router.navigate(['/library']);
      },
      error: (err: HttpErrorResponse) => {
        this.isPublishing.set(false);
        if (err.status === 400) {
          this.toast.error(err.error?.message ?? 'Verifica los datos del catálogo.');
        } else if (err.status === 403) {
          this.toast.error('No tienes permisos para publicar recursos.');
        } else {
          this.toast.error('Error al publicar. Intenta de nuevo.');
        }
      },
    });
  }

  goBackToStep1(): void {
    this.uploadedFile.set(null);
    this.selectedFileName.set('');
    this.uploadError.set('');
    this.step.set(1);
  }

  fieldError(field: string): string {
    const ctrl = this.metaForm.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))  return 'Este campo es obligatorio';
    if (ctrl.hasError('maxlength')) return `Máximo ${ctrl.errors?.['maxlength'].requiredLength} caracteres`;
    return '';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
