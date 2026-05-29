import { Injectable, computed, signal } from '@angular/core';
import { UserInfo } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private _user = signal<UserInfo | null>(null);
  private _accessToken = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isLoggedIn = computed(() => this._accessToken() !== null);
  readonly role = computed(() => this._user()?.role ?? null);

  setSession(accessToken: string, refreshToken: string, user: UserInfo): void {
    this._accessToken.set(accessToken);
    this._user.set(user);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  setAccessToken(token: string): void {
    this._accessToken.set(token);
  }

  setUser(user: UserInfo): void {
    this._user.set(user);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  clear(): void {
    this._accessToken.set(null);
    this._user.set(null);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }
}
