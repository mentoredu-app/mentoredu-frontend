import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatResponse, IngestResult } from '../models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ai`;

  askAssistant(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/assistant`, { message });
  }

  askSupport(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/support/ask`, { message });
  }

  ingest(): Observable<IngestResult> {
    return this.http.post<IngestResult>(`${this.base}/support/ingest`, {});
  }
}
