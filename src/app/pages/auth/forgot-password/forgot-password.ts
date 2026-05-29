import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinner],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  readonly isLoading = signal(false);
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailError(): string {
    const ctrl = this.form.get('email')!;
    if (!ctrl.invalid || !ctrl.touched) return '';
    if (ctrl.hasError('required')) return 'Este campo es obligatorio';
    if (ctrl.hasError('email'))    return 'Ingresa un email válido';
    return '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isLoading()) return;

    this.isLoading.set(true);

    this.authService.forgotPassword({ email: this.form.getRawValue().email }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        // Siempre mostramos éxito por seguridad (RN: nunca revelar si el email existe)
        this.isLoading.set(false);
        this.submitted.set(true);
      },
    });
  }
}
