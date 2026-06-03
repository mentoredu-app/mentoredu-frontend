import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ToastService } from '../../../shared/components/toast/toast.service';

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  return hasUpper && hasLower && hasDigit ? null : { passwordStrength: true };
}

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm  = group.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private toast       = inject(ToastService);

  readonly isLoading   = signal(false);
  readonly serverError = signal('');

  readonly form = this.fb.nonNullable.group(
    {
      firstName:       ['', [Validators.required, Validators.minLength(2)]],
      lastName:        ['', [Validators.required, Validators.minLength(2)]],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      role:            ['STUDENT' as 'STUDENT' | 'TEACHER' | 'ACADEMY', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  get f() { return this.form.controls; }

  fieldError(field: keyof typeof this.form.controls): string {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))         return 'Este campo es obligatorio';
    if (ctrl.hasError('minlength'))        return `Mínimo ${ctrl.errors?.['minlength'].requiredLength} caracteres`;
    if (ctrl.hasError('email'))            return 'Ingresa un email válido';
    if (ctrl.hasError('passwordStrength')) return 'Debe tener mayúscula, minúscula y número';
    return '';
  }

  confirmPasswordError(): string {
    const ctrl = this.form.get('confirmPassword');
    if (!ctrl || !ctrl.touched) return '';
    if (ctrl.hasError('required'))        return 'Este campo es obligatorio';
    if (this.form.hasError('passwordMismatch')) return 'Las contraseñas no coinciden';
    return '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.serverError.set('');

    const { confirmPassword, ...request } = this.form.getRawValue();

    this.authService.register(request).subscribe({
      next: () => {
        this.toast.success('Cuenta creada. Inicia sesión para continuar.');
        this.router.navigate(['/login']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 409) {
          this.serverError.set('Este email ya está registrado');
        } else {
          this.serverError.set('Ocurrió un error. Intenta de nuevo.');
        }
      },
    });
  }
}
