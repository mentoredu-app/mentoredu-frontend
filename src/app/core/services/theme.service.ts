import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'mentoredu-theme';
  readonly mode = signal<ThemeMode>(this.readStoredMode());

  constructor() {
    this.apply(this.mode());
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(this.storageKey, mode);
    this.apply(mode);
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private readStoredMode(): ThemeMode {
    return localStorage.getItem(this.storageKey) === 'dark' ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.dataset['theme'] = mode;
  }
}
