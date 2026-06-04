import { Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../services/catalog.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { University, Area, Course, Career } from '../../../models/catalog.model';

type CatalogTab = 'universities' | 'areas' | 'courses' | 'careers';

@Component({
  selector: 'app-catalog-admin',
  imports: [ReactiveFormsModule, SlicePipe, LoadingSpinner, EmptyState],
  templateUrl: './catalog-admin.html',
  styleUrl: './catalog-admin.css',
})
export class CatalogAdmin implements OnInit {
  private catalogService = inject(CatalogService);
  private toast          = inject(ToastService);
  private fb             = inject(FormBuilder);

  // ── Tab ──────────────────────────────────────────────────────────────────
  readonly activeTab = signal<CatalogTab>('universities');

  // ── Universidades ────────────────────────────────────────────────────────
  readonly universities  = signal<University[]>([]);
  readonly uIsLoading    = signal(true);
  readonly uLoadError    = signal('');
  readonly uShowForm     = signal(false);
  readonly uIsSaving     = signal(false);
  readonly univForm      = this.fb.nonNullable.group({
    name: ['', Validators.required],
    city: [''],
  });

  // ── Áreas ─────────────────────────────────────────────────────────────────
  readonly selectedUnivForArea = signal('');
  readonly areas         = signal<Area[]>([]);
  readonly aIsLoading    = signal(false);
  readonly aLoadError    = signal('');
  readonly aShowForm     = signal(false);
  readonly aIsSaving     = signal(false);
  readonly areaForm      = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });

  // ── Cursos ────────────────────────────────────────────────────────────────
  readonly courses       = signal<Course[]>([]);
  readonly cIsLoading    = signal(true);
  readonly cLoadError    = signal('');
  readonly cShowForm     = signal(false);
  readonly cIsSaving     = signal(false);
  readonly courseForm    = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  // ── Asociar curso a área ───────────────────────────────────────────────────
  readonly linkUnivId      = signal('');
  readonly linkAreas       = signal<Area[]>([]);
  readonly linkAreasLoading = signal(false);
  readonly linkAreaId      = signal('');
  readonly linkCourseId    = signal('');
  readonly linkIsSaving    = signal(false);

  // ── Carreras ──────────────────────────────────────────────────────────────
  readonly selectedUnivForCareer = signal('');
  readonly careerAreas     = signal<Area[]>([]);
  readonly careerAreasLoading = signal(false);
  readonly careers         = signal<Career[]>([]);
  readonly carIsLoading    = signal(false);
  readonly carLoadError    = signal('');
  readonly carShowForm     = signal(false);
  readonly carIsSaving     = signal(false);
  readonly careerForm      = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    areaId:      ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.loadUniversities();
    this.loadCourses();
  }

  // ── Tab ───────────────────────────────────────────────────────────────────
  switchTab(tab: CatalogTab): void { this.activeTab.set(tab); }

  // ── Universidades ─────────────────────────────────────────────────────────
  private loadUniversities(): void {
    this.uIsLoading.set(true);
    this.uLoadError.set('');
    this.catalogService.getUniversitiesFresh().subscribe({
      next: data => { this.universities.set(data); this.uIsLoading.set(false); },
      error: () => { this.uLoadError.set('No se pudo cargar las universidades.'); this.uIsLoading.set(false); },
    });
  }

  submitUniversity(): void {
    if (this.univForm.invalid) { this.univForm.markAllAsTouched(); return; }
    this.uIsSaving.set(true);
    const { name, city } = this.univForm.getRawValue();
    this.catalogService.createUniversity({ name, city: city || undefined }).subscribe({
      next: univ => {
        this.universities.update(l => [...l, univ]);
        this.univForm.reset();
        this.uShowForm.set(false);
        this.uIsSaving.set(false);
        this.toast.success('Universidad creada');
      },
      error: (err: HttpErrorResponse) => {
        this.uIsSaving.set(false);
        if (err.status === 409) this.toast.error('Ya existe una universidad con ese nombre');
        else this.toast.error('No se pudo crear la universidad.');
      },
    });
  }

  // ── Áreas ─────────────────────────────────────────────────────────────────
  onUnivAreaChange(universityId: string): void {
    this.selectedUnivForArea.set(universityId);
    this.aShowForm.set(false);
    this.areas.set([]);
    if (!universityId) return;
    this.aIsLoading.set(true);
    this.aLoadError.set('');
    this.catalogService.getAreasByUniversityFresh(universityId).subscribe({
      next: data => { this.areas.set(data); this.aIsLoading.set(false); },
      error: () => { this.aLoadError.set('No se pudo cargar las áreas.'); this.aIsLoading.set(false); },
    });
  }

  submitArea(): void {
    if (this.areaForm.invalid) { this.areaForm.markAllAsTouched(); return; }
    const univId = this.selectedUnivForArea();
    if (!univId) return;
    this.aIsSaving.set(true);
    const { name, description } = this.areaForm.getRawValue();
    this.catalogService.createArea(univId, { name, description: description || undefined }).subscribe({
      next: area => {
        this.areas.update(l => [...l, area]);
        this.areaForm.reset();
        this.aShowForm.set(false);
        this.aIsSaving.set(false);
        this.toast.success('Área creada');
      },
      error: (err: HttpErrorResponse) => {
        this.aIsSaving.set(false);
        if (err.status === 404) this.toast.error('Universidad no encontrada');
        else this.toast.error('No se pudo crear el área.');
      },
    });
  }

  // ── Cursos ────────────────────────────────────────────────────────────────
  private loadCourses(): void {
    this.cIsLoading.set(true);
    this.cLoadError.set('');
    this.catalogService.getCoursesFresh().subscribe({
      next: data => { this.courses.set(data); this.cIsLoading.set(false); },
      error: () => { this.cLoadError.set('No se pudo cargar los cursos.'); this.cIsLoading.set(false); },
    });
  }

  submitCourse(): void {
    if (this.courseForm.invalid) { this.courseForm.markAllAsTouched(); return; }
    this.cIsSaving.set(true);
    const { name } = this.courseForm.getRawValue();
    this.catalogService.createCourse({ name }).subscribe({
      next: course => {
        this.courses.update(l => [...l, course]);
        this.courseForm.reset();
        this.cShowForm.set(false);
        this.cIsSaving.set(false);
        this.toast.success('Curso creado');
      },
      error: (err: HttpErrorResponse) => {
        this.cIsSaving.set(false);
        if (err.status === 409) this.toast.error('Ya existe un curso con ese nombre');
        else this.toast.error('No se pudo crear el curso.');
      },
    });
  }

  // ── Asociar curso a área ──────────────────────────────────────────────────
  onLinkUnivChange(universityId: string): void {
    this.linkUnivId.set(universityId);
    this.linkAreaId.set('');
    this.linkAreas.set([]);
    if (!universityId) return;
    this.linkAreasLoading.set(true);
    this.catalogService.getAreasByUniversityFresh(universityId).subscribe({
      next: data => { this.linkAreas.set(data); this.linkAreasLoading.set(false); },
      error: () => this.linkAreasLoading.set(false),
    });
  }

  submitLink(): void {
    const areaId   = this.linkAreaId();
    const courseId = this.linkCourseId();
    if (!areaId || !courseId) { this.toast.error('Selecciona un área y un curso'); return; }
    this.linkIsSaving.set(true);
    this.catalogService.linkCourseToArea(areaId, courseId).subscribe({
      next: () => {
        this.linkAreaId.set('');
        this.linkCourseId.set('');
        this.linkIsSaving.set(false);
        this.toast.success('Curso asociado al área');
      },
      error: (err: HttpErrorResponse) => {
        this.linkIsSaving.set(false);
        if (err.status === 404) this.toast.error('Área o curso no encontrado');
        else this.toast.error('No se pudo asociar el curso.');
      },
    });
  }

  // ── Carreras ──────────────────────────────────────────────────────────────
  onUnivCareerChange(universityId: string): void {
    this.selectedUnivForCareer.set(universityId);
    this.carShowForm.set(false);
    this.careerAreas.set([]);
    this.careers.set([]);
    this.careerForm.reset();
    if (!universityId) return;
    this.careerAreasLoading.set(true);
    this.carIsLoading.set(true);
    this.carLoadError.set('');
    this.catalogService.getAreasByUniversityFresh(universityId).subscribe({
      next: data => { this.careerAreas.set(data); this.careerAreasLoading.set(false); },
      error: () => this.careerAreasLoading.set(false),
    });
    this.catalogService.getCareersByUniversityFresh(universityId).subscribe({
      next: data => { this.careers.set(data); this.carIsLoading.set(false); },
      error: () => { this.carLoadError.set('No se pudo cargar las carreras.'); this.carIsLoading.set(false); },
    });
  }

  submitCareer(): void {
    if (this.careerForm.invalid) { this.careerForm.markAllAsTouched(); return; }
    const univId = this.selectedUnivForCareer();
    if (!univId) return;
    this.carIsSaving.set(true);
    const { name, areaId, description } = this.careerForm.getRawValue();
    this.catalogService.createCareer(univId, { name, areaId, description: description || undefined }).subscribe({
      next: career => {
        this.careers.update(l => [...l, career]);
        this.careerForm.reset();
        this.carShowForm.set(false);
        this.carIsSaving.set(false);
        this.toast.success('Carrera creada');
      },
      error: (err: HttpErrorResponse) => {
        this.carIsSaving.set(false);
        if (err.status === 404) this.toast.error('Universidad o área no encontrada');
        else this.toast.error('No se pudo crear la carrera.');
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  hasFieldError(control: any, error: string): boolean {
    return control?.hasError(error) && control?.touched;
  }
}
