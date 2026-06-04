import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import { NotificationResponse, NotificationType } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  getAll(page = 0, size = 20, type?: NotificationType): Observable<PagedResponse<NotificationResponse>> {
    const params: Record<string, string | number> = { page, size };
    if (type) params['type'] = type;
    return this.http.get<PagedResponse<NotificationResponse>>(`${this.base}/me`, { params });
  }

  getPending(page = 0, size = 20): Observable<PagedResponse<NotificationResponse>> {
    return this.http.get<PagedResponse<NotificationResponse>>(`${this.base}/me/pending`, {
      params: { page, size },
    });
  }

  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/read`, {});
  }
}
