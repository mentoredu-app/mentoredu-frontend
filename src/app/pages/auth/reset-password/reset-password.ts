import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  return hasUpper && hasLower && hasDigit ? null : { passwordStrength: true };
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm  = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly succeeded = signal(false);
  readonly tokenInvalid = signal(false);
  readonly serverError = signal('');

  private token = '';

  readonly form = this.fb.nonNullable.group(
    {
      password:        ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator }
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.tokenInvalid.set(true);
    }
  }

  fieldError(field: 'password' | 'confirmPassword'): string {
    const ctrl = this.form.get(field)!;
    if (!ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required'))         return 'Este campo es obligatorio';
    if (ctrl.hasError('minlength'))        return 'Mínimo 8 caracteres';
    if (ctrl.hasError('passwordStrength')) return 'Debe tener al menos una mayúscula, una minúscula y un número';
    return '';
  }

  get confirmError(): string {
    if (!this.form.hasError('passwordsMismatch')) return '';
    const ctrl = this.form.get('confirmPassword')!;
    if (!ctrl.touched) return '';
    return 'Las contraseñas no coinciden';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.serverError.set('');

    this.authService.resetPassword({
      token:       this.token,
      newPassword: this.form.getRawValue().password,
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.succeeded.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 400) {
          this.tokenInvalid.set(true);
        } else {
          this.serverError.set('Ocurrió un error. Intenta de nuevo.');
        }
      },
    });
  }
}
