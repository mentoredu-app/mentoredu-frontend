import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'success'): void {
    const id = crypto.randomUUID();
    this._toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 3500);
  }

  dismiss(id: string): void {
    this._toasts.update(t => t.filter(toast => toast.id !== id));
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void { this.show(message, 'error'); }
  warning(message: string): void { this.show(message, 'warning'); }
}
