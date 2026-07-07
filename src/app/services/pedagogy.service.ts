import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateFeedbackRequest,
  FeedbackResponse,
  MySolutionSummaryResponse,
  MySolutionWithFeedbackResponse,
  ReceivedSolutionResponse,
  SolutionResponse,
} from '../models/pedagogy.model';
import { PagedResponse } from '../models/common.model';

@Injectable({ providedIn: 'root' })
export class PedagogyService {
  private http = inject(HttpClient);
  private readonly resBase = `${environment.apiUrl}/resources`;
  private readonly solBase = `${environment.apiUrl}/solutions`;

  getSolutions(resourceId: string): Observable<SolutionResponse[]> {
    return this.http.get<SolutionResponse[]>(`${this.resBase}/${resourceId}/solutions`);
  }

  getSolutionDetail(resourceId: string, solutionId: string): Observable<SolutionResponse> {
    return this.http.get<SolutionResponse>(`${this.resBase}/${resourceId}/solutions/${solutionId}`);
  }

  submitSolution(resourceId: string, body: { fileUrl?: string; content?: string }): Observable<SolutionResponse> {
    return this.http.post<SolutionResponse>(`${this.resBase}/${resourceId}/solutions`, body);
  }

  updateSolution(resourceId: string, solutionId: string, body: { fileUrl?: string; content?: string }): Observable<SolutionResponse> {
    return this.http.patch<SolutionResponse>(`${this.resBase}/${resourceId}/solutions/${solutionId}`, body);
  }

  deleteSolution(resourceId: string, solutionId: string): Observable<void> {
    return this.http.delete<void>(`${this.resBase}/${resourceId}/solutions/${solutionId}`);
  }

  getMySolution(resourceId: string): Observable<MySolutionWithFeedbackResponse> {
    return this.http.get<MySolutionWithFeedbackResponse>(`${this.resBase}/${resourceId}/solutions/mine`);
  }

  giveFeedback(solutionId: string, request: CreateFeedbackRequest): Observable<FeedbackResponse> {
    return this.http.post<FeedbackResponse>(`${this.solBase}/${solutionId}/feedback`, request);
  }

  getFeedback(solutionId: string): Observable<FeedbackResponse> {
    return this.http.get<FeedbackResponse>(`${this.solBase}/${solutionId}/feedback`);
  }

  getMySolutions(page = 0, size = 10): Observable<PagedResponse<MySolutionSummaryResponse>> {
    return this.http.get<PagedResponse<MySolutionSummaryResponse>>(`${this.solBase}/mine`, { params: { page, size } });
  }

  getReceivedSolutions(page = 0, size = 10): Observable<PagedResponse<ReceivedSolutionResponse>> {
    return this.http.get<PagedResponse<ReceivedSolutionResponse>>(`${this.solBase}/received`, { params: { page, size } });
  }
}
