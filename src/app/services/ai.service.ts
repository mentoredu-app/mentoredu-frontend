import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiMode, ChatMessage, ChatResponse, IngestResult } from '../models/ai.model';

const GREETING: Record<AiMode, string> = {
  assistant: 'Hola, soy tu asistente de MentorEdu. Puedo ayudarte a encontrar recursos académicos con lenguaje natural. ¿Qué estás buscando?',
  support: 'Modo soporte: respondo preguntas sobre cómo usar MentorEdu basándome en la guía oficial.',
};

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ai`;

  readonly mode = signal<AiMode>('assistant');
  readonly messages = signal<ChatMessage[]>([{ from: 'bot', text: GREETING.assistant }]);

  setMode(newMode: AiMode): void {
    if (this.mode() === newMode) return;
    this.mode.set(newMode);
    this.messages.set([{ from: 'bot', text: GREETING[newMode] }]);
  }

  pushMessage(msg: ChatMessage): void {
    this.messages.update(list => [...list, msg]);
  }

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
