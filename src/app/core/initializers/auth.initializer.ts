import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserInfo } from '../../models/auth.model';
import { AuthStateService } from '../services/auth-state.service';

export function authInitializer(): () => Promise<void> {
  const authState   = inject(AuthStateService);
  const httpBackend = inject(HttpBackend);

  return async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    try {
      // HttpClient via HttpBackend evita interceptores (sin dependencia circular)
      const http = new HttpClient(httpBackend);
      const res  = await firstValueFrom(
        http.post<{ accessToken: string }>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      );
      authState.setAccessToken(res.accessToken);

      const userJson = localStorage.getItem('user');
      if (userJson) {
        authState.setUser(JSON.parse(userJson) as UserInfo);
      }
    } catch {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  };
}
