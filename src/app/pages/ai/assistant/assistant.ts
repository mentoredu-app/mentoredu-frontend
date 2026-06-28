import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AiService } from '../../../services/ai.service';
import { AiMode, ChatMessage } from '../../../models/ai.model';

const GREETING: Record<AiMode, string> = {
  assistant: 'Hola, soy tu asistente de MentorEdu. Puedo ayudarte a encontrar recursos académicos con lenguaje natural. ¿Qué estás buscando?',
  support: 'Modo soporte: respondo preguntas sobre cómo usar MentorEdu basándome en la guía oficial.',
};

@Component({
  selector: 'app-assistant',
  imports: [FormsModule],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class Assistant {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  private aiService = inject(AiService);
  readonly authState = inject(AuthStateService);

  readonly isAdmin = this.authState.role() === 'ADMIN';
  draft = '';
  readonly mode = signal<AiMode>('assistant');
  readonly sending = signal(false);
  readonly ingesting = signal(false);
  readonly ingestMsg = signal('');
  readonly messages = signal<ChatMessage[]>([{ from: 'bot', text: GREETING.assistant }]);

  setMode(newMode: AiMode): void {
    if (this.mode() === newMode) return;
    this.mode.set(newMode);
    this.messages.set([{ from: 'bot', text: GREETING[newMode] }]);
  }

  send(): void {
    const value = this.draft.trim();
    if (!value || this.sending()) return;

    this.push({ from: 'user', text: value });
    this.draft = '';
    this.sending.set(true);
    this.scrollToBottom();

    const call = this.mode() === 'assistant'
      ? this.aiService.askAssistant(value)
      : this.aiService.askSupport(value);

    call.subscribe({
      next: res => {
        this.push({ from: 'bot', text: res.reply });
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.push({ from: 'bot', text: 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.' });
        this.sending.set(false);
        this.scrollToBottom();
      },
    });
  }

  ingest(): void {
    if (this.ingesting()) return;
    this.ingesting.set(true);
    this.ingestMsg.set('');

    this.aiService.ingest().subscribe({
      next: res => {
        this.ingestMsg.set(`Ingesta completada: ${res.chunksIngested} fragmentos cargados.`);
        this.ingesting.set(false);
      },
      error: () => {
        this.ingestMsg.set('Error al ingestar los documentos.');
        this.ingesting.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private push(msg: ChatMessage): void {
    this.messages.update(list => [...list, msg]);
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}
