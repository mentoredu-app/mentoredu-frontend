import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthStateService } from '../core/services/auth-state.service';
import {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  register(request: RegisterRequest) {
    return this.http.post<AuthResponse>(`${this.base}/register`, request);
  }

  login(request: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.base}/login`, request).pipe(
      tap(res => {
        this.authState.setSession(res.accessToken, res.refreshToken, res.user);
      })
    );
  }

  logout() {
    const refreshToken = this.authState.getRefreshToken();
    if (!refreshToken) {
      this.authState.clear();
      this.router.navigate(['/login']);
      return;
    }
    const body: LogoutRequest = { refreshToken };
    this.http.post(`${this.base}/logout`, body).subscribe({
      complete: () => {
        this.authState.clear();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.authState.clear();
        this.router.navigate(['/login']);
      },
    });
  }

  refresh(request: RefreshTokenRequest) {
    return this.http.post<AuthResponse>(`${this.base}/refresh`, request).pipe(
      tap(res => {
        this.authState.setAccessToken(res.accessToken);
      })
    );
  }

  forgotPassword(request: ForgotPasswordRequest) {
    return this.http.post<{ message: string }>(`${this.base}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest) {
    return this.http.post<{ message: string }>(`${this.base}/reset-password`, request);
  }
}
