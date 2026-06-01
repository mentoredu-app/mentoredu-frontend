import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import {
  DownloadResponse,
  PublishResourceRequest,
  ResourceFileResponse,
  ResourceResponse,
  SearchResourceParams,
  UpdateResourceSettingsRequest,
} from '../models/resource.model';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/resources`;

  uploadFile(file: File): Observable<ResourceFileResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ResourceFileResponse>(`${this.base}/files`, form);
  }

  publish(request: PublishResourceRequest): Observable<ResourceResponse> {
    return this.http.post<ResourceResponse>(this.base, request);
  }

  search(params: SearchResourceParams | Record<string, string | number>): Observable<PagedResponse<ResourceResponse>> {
    const httpParams: Record<string, string | number> = {};
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') httpParams[k] = v; });
    return this.http.get<PagedResponse<ResourceResponse>>(this.base, { params: httpParams });
  }

  getById(id: string): Observable<ResourceResponse> {
    return this.http.get<ResourceResponse>(`${this.base}/${id}`);
  }

  getMyResources(page = 0, size = 20): Observable<PagedResponse<ResourceResponse>> {
    return this.http.get<PagedResponse<ResourceResponse>>(`${this.base}/me`, { params: { page, size } });
  }

  download(id: string): Observable<DownloadResponse> {
    return this.http.get<DownloadResponse>(`${this.base}/${id}/download`);
  }

  updateSettings(id: string, request: UpdateResourceSettingsRequest): Observable<ResourceResponse> {
    return this.http.patch<ResourceResponse>(`${this.base}/${id}/settings`, request);
  }
}
