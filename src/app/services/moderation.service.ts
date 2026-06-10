import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import {
  CreateReportRequest,
  ResolveReportRequest,
  ReportResponse,
} from '../models/moderation.model';

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/moderation`;

  report(request: CreateReportRequest): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.base}/reports`, request);
  }

  getReports(page = 0, size = 20): Observable<PagedResponse<ReportResponse>> {
    return this.http.get<PagedResponse<ReportResponse>>(`${this.base}/reports`, {
      params: { page, size },
    });
  }

  resolveReport(id: string, request: ResolveReportRequest): Observable<ReportResponse> {
    return this.http.patch<ReportResponse>(`${this.base}/reports/${id}/resolve`, request);
  }
}
