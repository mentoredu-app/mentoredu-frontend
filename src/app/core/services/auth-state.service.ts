import { Injectable, computed, signal } from '@angular/core';
import { UserInfo } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  // Inicializado desde localStorage inline — nunca hay ventana donde sea null
  // si el usuario ya tiene sesión activa
  private _user         = signal<UserInfo | null>(this.readUserFromStorage());
  private _accessToken  = signal<string | null>(null);

  readonly user        = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isLoggedIn  = computed(() => this._accessToken() !== null);
  readonly role        = computed(() => this._user()?.role ?? null);

  private readUserFromStorage(): UserInfo | null {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try { return JSON.parse(stored) as UserInfo; } catch { return null; }
  }

  setSession(accessToken: string, refreshToken: string, user: UserInfo): void {
    this._accessToken.set(accessToken);
    this._user.set(user);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  setAccessToken(token: string): void {
    this._accessToken.set(token);
    // Si el user signal está vacío (page refresh), restaurar desde localStorage
    if (!this._user()) {
      const stored = this.readUserFromStorage();
      if (stored) this._user.set(stored);
    }
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
