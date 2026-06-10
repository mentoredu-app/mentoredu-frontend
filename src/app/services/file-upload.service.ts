import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  return `${environment.baseUrl}/${url}`;
}

export interface ImageFileResponse {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/files`;

  uploadImage(file: File): Observable<ImageFileResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImageFileResponse>(`${this.base}/images`, fd);
  }
}
