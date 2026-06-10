import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../../models/auth.model';
import { AuthStateService } from '../services/auth-state.service';

const SKIP_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  const httpBackend = inject(HttpBackend);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = SKIP_REFRESH.some(e => req.url.includes(e));

      if (error.status === 401 && !isAuthEndpoint) {
        const refreshToken = authState.getRefreshToken();
        if (refreshToken) {
          // HttpClient via HttpBackend evita el interceptor y previene dependencia circular
          const http = new HttpClient(httpBackend);
          return http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
            switchMap(res => {
              authState.setAccessToken(res.accessToken);
              // Restaurar usuario si se perdió tras refresh de página
              if (!authState.user()) {
                const stored = localStorage.getItem('user');
                if (stored) {
                  try { authState.setUser(JSON.parse(stored)); } catch {}
                }
              }
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }));
            }),
            catchError(() => {
              authState.clear();
              router.navigate(['/login']);
              return throwError(() => error);
            })
          );
        }
        authState.clear();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
