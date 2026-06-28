import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AiService } from '../../../services/ai.service';
import { AiMode } from '../../../models/ai.model';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-assistant',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class Assistant {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  readonly aiService = inject(AiService);
  readonly authState = inject(AuthStateService);

  readonly isAdmin = this.authState.role() === 'ADMIN';
  draft = '';
  readonly sending = signal(false);
  readonly ingesting = signal(false);
  readonly ingestMsg = signal('');

  get mode() { return this.aiService.mode; }
  get messages() { return this.aiService.messages; }

  setMode(newMode: AiMode): void {
    this.aiService.setMode(newMode);
  }

  send(): void {
    const value = this.draft.trim();
    if (!value || this.sending()) return;

    this.aiService.pushMessage({ from: 'user', text: value });
    this.draft = '';
    this.sending.set(true);
    this.scrollToBottom();

    const call = this.mode() === 'assistant'
      ? this.aiService.askAssistant(value)
      : this.aiService.askSupport(value);

    call.subscribe({
      next: res => {
        this.aiService.pushMessage({ from: 'bot', text: res.reply });
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.aiService.pushMessage({ from: 'bot', text: 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.' });
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

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}
