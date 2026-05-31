import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import { CreateThreadRequest, SearchThreadParams, ThreadResponse } from '../models/forum.model';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/threads`;

  getThreads(params: SearchThreadParams) {
    const query: Record<string, string | number> = {
      page: params.page ?? 0,
      size: params.size ?? 15,
    };
    if (params.universityId) query['universityId'] = params.universityId;
    if (params.courseId)     query['courseId']     = params.courseId;
    if (params.careerId)     query['careerId']      = params.careerId;
    if (params.status)       query['status']        = params.status;
    return this.http.get<PagedResponse<ThreadResponse>>(this.base, { params: query });
  }

  getThread(id: string) {
    return this.http.get<ThreadResponse>(`${this.base}/${id}`);
  }

  createThread(request: CreateThreadRequest) {
    return this.http.post<ThreadResponse>(this.base, request);
  }
}
