import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../services/catalog.service';
import { ForumService } from '../../../services/forum.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { Area, Career, Course, University } from '../../../models/catalog.model';
import { ThreadContextMode } from '../../../models/forum.model';

@Component({
  selector: 'app-thread-create',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './thread-create.html',
  styleUrl: './thread-create.css',
})
export class ThreadCreate implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private forumService = inject(ForumService);
  private catalogService = inject(CatalogService);
  private toast = inject(ToastService);

  readonly isSubmitting = signal(false);

  readonly universities = signal<University[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly careers = signal<Career[]>([]);
  readonly courses = signal<Course[]>([]);

  readonly contextMode = signal<ThreadContextMode>('course');

  readonly form = this.fb.nonNullable.group({
    title:        ['', [Validators.required, Validators.maxLength(200)]],
    body:         ['', [Validators.required, Validators.maxLength(5000)]],
    isAnonymous:  [false],
    universityId: [''],
    areaId:       [''],
    careerId:     [''],
    courseId:     [''],
  });

  readonly bodyLength = computed(() => this.form.get('body')!.value?.length ?? 0);

  ngOnInit(): void {
    this.catalogService.getUniversities().subscribe({ next: unis => this.universities.set(unis) });
    this.catalogService.getAllCourses().subscribe({ next: cs => this.courses.set(cs) });

    this.form.get('universityId')!.valueChanges.subscribe(id => {
      this.areas.set([]);
      this.careers.set([]);
      this.form.patchValue({ areaId: '', careerId: '' });
      if (id) {
        this.catalogService.getAreasByUniversity(id).subscribe({ next: a => this.areas.set(a) });
        this.catalogService.getCareersByUniversity(id).subscribe({ next: c => this.careers.set(c) });
      }
    });
  }

  setMode(mode: ThreadContextMode): void {
    this.contextMode.set(mode);
    this.form.patchValue({ universityId: '', areaId: '', careerId: '', courseId: '' });
    this.areas.set([]);
    this.careers.set([]);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) return;

    const raw = this.form.getRawValue();
    const mode = this.contextMode();

    // Validar que haya al menos un contexto seleccionado
    const hasContext =
      (mode === 'course'      && !!raw.courseId) ||
      (mode === 'university'  && !!raw.universityId) ||
      (mode === 'career'      && !!raw.careerId);

    if (!hasContext) {
      this.toast.error('Selecciona al menos una categoría de contexto para el hilo.');
      return;
    }

    this.isSubmitting.set(true);
    this.forumService.createThread({
      title:        raw.title,
      body:         raw.body,
      isAnonymous:  raw.isAnonymous,
      universityId: mode === 'university' || mode === 'career' ? raw.universityId || undefined : undefined,
      areaId:       mode === 'university' ? raw.areaId || undefined : undefined,
      careerId:     mode === 'career'     ? raw.careerId || undefined : undefined,
      courseId:     mode === 'course'     ? raw.courseId || undefined : undefined,
    }).subscribe({
      next: thread => {
        this.isSubmitting.set(false);
        this.toast.success('Hilo publicado exitosamente');
        this.router.navigate(['/forum', thread.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 400) {
          this.toast.error(err.error?.message ?? 'Verifica los datos del formulario.');
        } else {
          this.toast.error('Error al publicar el hilo. Intenta de nuevo.');
        }
      },
    });
  }

  fieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))   return 'Este campo es obligatorio';
    if (ctrl.hasError('maxlength'))  return `Máximo ${ctrl.errors?.['maxlength'].requiredLength} caracteres`;
    return '';
  }
}
