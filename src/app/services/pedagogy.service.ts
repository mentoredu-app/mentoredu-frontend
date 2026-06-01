import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateFeedbackRequest,
  FeedbackResponse,
  MySolutionWithFeedbackResponse,
  SolutionResponse,
} from '../models/pedagogy.model';

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

  getMySolution(resourceId: string): Observable<MySolutionWithFeedbackResponse> {
    return this.http.get<MySolutionWithFeedbackResponse>(`${this.resBase}/${resourceId}/solutions/mine`);
  }

  giveFeedback(solutionId: string, request: CreateFeedbackRequest): Observable<FeedbackResponse> {
    return this.http.post<FeedbackResponse>(`${this.solBase}/${solutionId}/feedback`, request);
  }

  getFeedback(solutionId: string): Observable<FeedbackResponse> {
    return this.http.get<FeedbackResponse>(`${this.solBase}/${solutionId}/feedback`);
  }
}
