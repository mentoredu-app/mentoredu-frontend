import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import { AnswerResponse, CommentResponse, CreateAnswerRequest, CreateCommentRequest, CreateThreadRequest, ReactionResponse, ReactionType, SearchThreadParams, ThreadResponse } from '../models/forum.model';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/threads`;

  getThreads(page = 0, size = 15) {
    return this.http.get<PagedResponse<ThreadResponse>>(this.base, { params: { page, size } });
  }

  getThreadsByUser(authorId: string, page = 0, size = 10) {
    return this.http.get<PagedResponse<ThreadResponse>>(this.base, { params: { page, size, authorId } });
  }

  getThread(id: string) {
    return this.http.get<ThreadResponse>(`${this.base}/${id}`);
  }

  createThread(request: CreateThreadRequest) {
    return this.http.post<ThreadResponse>(this.base, request);
  }

  closeThread(threadId: string) {
    return this.http.patch<ThreadResponse>(`${this.base}/${threadId}/close`, {});
  }

  getAnswers(threadId: string, page = 0, size = 30) {
    return this.http.get<PagedResponse<AnswerResponse>>(`${this.base}/${threadId}/answers`, {
      params: { page, size },
    });
  }

  createAnswer(threadId: string, request: CreateAnswerRequest) {
    return this.http.post<AnswerResponse>(`${this.base}/${threadId}/answers`, request);
  }

  // 201 = reacción añadida/cambiada; 204 = toggle off (sin body)
  reactToThread(threadId: string, reactionType: ReactionType) {
    return this.http.post<ReactionResponse | null>(`${this.base}/${threadId}/reactions`, { reactionType }, { observe: 'response' });
  }

  reactToAnswer(answerId: string, reactionType: ReactionType) {
    const base = `${environment.apiUrl}/answers`;
    return this.http.post<ReactionResponse | null>(`${base}/${answerId}/reactions`, { reactionType }, { observe: 'response' });
  }

  getComments(answerId: string) {
    return this.http.get<CommentResponse[]>(`${environment.apiUrl}/answers/${answerId}/comments`);
  }

  createComment(answerId: string, request: CreateCommentRequest) {
    return this.http.post<CommentResponse>(`${environment.apiUrl}/answers/${answerId}/comments`, request);
  }
}
