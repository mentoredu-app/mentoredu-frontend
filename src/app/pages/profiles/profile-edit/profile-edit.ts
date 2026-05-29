import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { ProfileService } from '../../../services/profile.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { Area, Career, University } from '../../../models/catalog.model';

@Component({
  selector: 'app-profile-edit',
  imports: [ReactiveFormsModule, LoadingSpinner],
  templateUrl: './profile-edit.html',
  styleUrl: './profile-edit.css',
})
export class ProfileEdit implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfileService);
  private catalogService = inject(CatalogService);
  private toast = inject(ToastService);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly loadError = signal('');

  readonly universities = signal<University[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly careers = signal<Career[]>([]);

  private hasStudentProfile = false;
  private hasTeacherProfile = false;
  private hasAcademyProfile = false;

  // profileType viene del backend — no depende de authState.role() que puede ser null tras token refresh
  readonly profileType = signal<string | null>(null);

  private currentUserId = '';

  readonly baseForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    city:        ['', [Validators.maxLength(80)]],
    bio:         [''],
  });

  readonly studentForm = this.fb.nonNullable.group({
    gradeLevel:         ['', [Validators.required, Validators.maxLength(20)]],
    schoolName:         ['', [Validators.maxLength(120)]],
    studyShift:         ['', [Validators.maxLength(30)]],
    targetUniversityId: [''],
    targetAreaId:       [''],
    targetCareerId:     [''],
  });

  readonly teacherForm = this.fb.nonNullable.group({
    bioProfessional: ['', [Validators.maxLength(2000)]],
  });

  readonly academyForm = this.fb.nonNullable.group({
    academyName:  ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    ruc:          ['', [Validators.maxLength(20)]],
    website:      ['', [Validators.maxLength(255)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(120)]],
  });

  ngOnInit(): void {
    if (this.authState.role() === 'STUDENT') {
      this.loadUniversities();
      this.watchUniversityChange();
    }
    this.loadProfile();
  }

  private loadProfile(): void {
    this.profileService.getMe().subscribe({
      next: profile => {
        this.currentUserId = profile.userId;
        // profileType desde el backend: siempre fiable, incluso tras token refresh sin user object
        this.profileType.set(profile.profileType);
        this.baseForm.patchValue({
          displayName: profile.displayName,
          city:        profile.city ?? '',
          bio:         profile.bio ?? '',
        });
        this.loadRoleProfile(profile.userId, profile.profileType);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar tu perfil. Intenta de nuevo.');
        this.isLoading.set(false);
      },
    });
  }

  private loadRoleProfile(userId: string, profileType: string): void {
    if (profileType === 'STUDENT') {
      this.profileService.getStudentProfile(userId).subscribe({
        next: sp => {
          this.hasStudentProfile = true;
          this.studentForm.patchValue({
            gradeLevel:         sp.gradeLevel ?? '',
            schoolName:         sp.schoolName ?? '',
            studyShift:         sp.studyShift ?? '',
            targetUniversityId: sp.targetUniversityId ?? '',
            targetAreaId:       sp.targetAreaId ?? '',
            targetCareerId:     sp.targetCareerId ?? '',
          });
          if (sp.targetUniversityId) {
            this.loadAreasByUniversity(sp.targetUniversityId);
            this.loadCareersByUniversity(sp.targetUniversityId);
          }
        },
        error: () => { this.hasStudentProfile = false; },
      });
    }

    if (profileType === 'TEACHER') {
      // GET /profiles/teacher/me — endpoint nuevo agregado al backend
      this.profileService.getMyTeacherProfile().subscribe({
        next: tp => {
          this.hasTeacherProfile = true;
          this.teacherForm.patchValue({ bioProfessional: tp.bioProfessional ?? '' });
        },
        error: () => { this.hasTeacherProfile = false; },
      });
    }

    if (profileType === 'ACADEMY') {
      // GET /profiles/academy/me — endpoint nuevo agregado al backend
      this.profileService.getMyAcademyProfile().subscribe({
        next: ap => {
          this.hasAcademyProfile = true;
          this.academyForm.patchValue({
            academyName:  ap.academyName,
            ruc:          ap.ruc ?? '',
            website:      ap.website ?? '',
            contactEmail: ap.contactEmail ?? '',
          });
        },
        error: () => { this.hasAcademyProfile = false; },
      });
    }
  }

  private loadUniversities(): void {
    this.catalogService.getUniversities().subscribe({
      next: unis => this.universities.set(unis),
    });
  }

  private loadAreasByUniversity(universityId: string): void {
    this.catalogService.getAreasByUniversity(universityId).subscribe({
      next: areas => this.areas.set(areas),
    });
  }

  private loadCareersByUniversity(universityId: string): void {
    this.catalogService.getCareersByUniversity(universityId).subscribe({
      next: careers => this.careers.set(careers),
    });
  }

  private watchUniversityChange(): void {
    this.studentForm.get('targetUniversityId')!.valueChanges.subscribe(universityId => {
      this.areas.set([]);
      this.careers.set([]);
      this.studentForm.patchValue({ targetAreaId: '', targetCareerId: '' });
      if (universityId) {
        this.loadAreasByUniversity(universityId);
        this.loadCareersByUniversity(universityId);
      }
    });
  }

  saveBase(): void {
    this.baseForm.markAllAsTouched();
    if (this.baseForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    const raw = this.baseForm.getRawValue();
    this.profileService.updateMe({
      displayName: raw.displayName,
      city:        raw.city || undefined,
      bio:         raw.bio || undefined,
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toast.success('Datos actualizados');
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Error al guardar. Intenta de nuevo.');
      },
    });
  }

  saveRoleProfile(): void {
    const role = this.profileType();
    if (this.isSaving()) return;

    let request$: Observable<unknown>;

    if (role === 'STUDENT') {
      this.studentForm.markAllAsTouched();
      if (this.studentForm.invalid) return;
      const raw = this.studentForm.getRawValue();
      const updateData = {
        gradeLevel:         raw.gradeLevel || undefined,
        schoolName:         raw.schoolName || undefined,
        studyShift:         raw.studyShift || undefined,
        targetUniversityId: raw.targetUniversityId || undefined,
        targetAreaId:       raw.targetAreaId || undefined,
        targetCareerId:     raw.targetCareerId || undefined,
      };
      const createData = { ...updateData, gradeLevel: raw.gradeLevel };

      if (this.hasStudentProfile) {
        request$ = this.profileService.updateStudentProfile(updateData);
      } else {
        // Si POST retorna 409 (perfil ya existe pero no fue detectado),
        // hace fallback automático a PATCH sin mostrar error al usuario
        request$ = this.profileService.createStudentProfile(createData).pipe(
          catchError(err => {
            if (err.status === 409) {
              this.hasStudentProfile = true;
              return this.profileService.updateStudentProfile(updateData);
            }
            return throwError(() => err);
          })
        );
      }

    } else if (role === 'TEACHER') {
      const data = { bioProfessional: this.teacherForm.getRawValue().bioProfessional || undefined };
      if (this.hasTeacherProfile) {
        request$ = this.profileService.updateTeacherProfile(data);
      } else {
        request$ = this.profileService.createTeacherProfile(data).pipe(
          catchError(err => {
            if (err.status === 409) {
              this.hasTeacherProfile = true;
              return this.profileService.updateTeacherProfile(data);
            }
            return throwError(() => err);
          })
        );
      }

    } else if (role === 'ACADEMY') {
      this.academyForm.markAllAsTouched();
      if (this.academyForm.invalid) return;
      const raw = this.academyForm.getRawValue();
      const updateData = {
        academyName:  raw.academyName || undefined,
        website:      raw.website || undefined,
        contactEmail: raw.contactEmail || undefined,
      };

      if (this.hasAcademyProfile) {
        request$ = this.profileService.updateAcademyProfile(updateData);
      } else {
        const createData = { academyName: raw.academyName, ruc: raw.ruc || undefined, website: raw.website || undefined, contactEmail: raw.contactEmail || undefined };
        request$ = this.profileService.createAcademyProfile(createData).pipe(
          catchError(err => {
            if (err.status === 409) {
              this.hasAcademyProfile = true;
              return this.profileService.updateAcademyProfile(updateData);
            }
            return throwError(() => err);
          })
        );
      }

    } else {
      return;
    }

    this.isSaving.set(true);
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        if (role === 'STUDENT') this.hasStudentProfile = true;
        if (role === 'TEACHER') this.hasTeacherProfile = true;
        if (role === 'ACADEMY') this.hasAcademyProfile = true;
        this.toast.success('Perfil guardado exitosamente');
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        if (err.status === 409) {
          this.toast.error('El nombre de organización o RUC ya está en uso');
        } else if (err.status === 400) {
          this.toast.error('Verifica que los datos del catálogo sean válidos');
        } else {
          this.toast.error('Error al guardar. Intenta de nuevo.');
        }
      },
    });
  }

  fieldError(form: 'base' | 'student' | 'teacher' | 'academy', field: string): string {
    const ctrl = form === 'base'    ? this.baseForm.get(field)
               : form === 'student' ? this.studentForm.get(field)
               : form === 'teacher' ? this.teacherForm.get(field)
               :                      this.academyForm.get(field);

    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))  return 'Este campo es obligatorio';
    if (ctrl.hasError('minlength')) return `Mínimo ${ctrl.errors?.['minlength'].requiredLength} caracteres`;
    if (ctrl.hasError('maxlength')) return `Máximo ${ctrl.errors?.['maxlength'].requiredLength} caracteres`;
    if (ctrl.hasError('email'))     return 'Ingresa un email válido';
    return '';
  }

  get bioLength(): number {
    return this.teacherForm.get('bioProfessional')!.value.length;
  }
}
