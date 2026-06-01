import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ForumService } from '../../../services/forum.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { AnswerResponse, ThreadResponse } from '../../../models/forum.model';

@Component({
  selector: 'app-thread-detail',
  imports: [RouterLink, ReactiveFormsModule, LoadingSpinner],
  templateUrl: './thread-detail.html',
  styleUrl: './thread-detail.css',
})
export class ThreadDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private forumService = inject(ForumService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly thread = signal<ThreadResponse | null>(null);
  readonly answers = signal<AnswerResponse[]>([]);
  readonly hasMoreAnswers = signal(false);
  private answersPage = 0;
  readonly isLoadingAnswers = signal(false);
  readonly isSubmitting = signal(false);
  readonly isClosing = signal(false);

  readonly answerForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  readonly bodyLength = computed(() => this.answerForm.get('body')!.value?.length ?? 0);

  readonly isClosed = computed(() => this.thread()?.status === 'CLOSED');

  // Puede cerrar: si el hilo está en myThreadIds (es el autor) o es MODERATOR/ADMIN
  readonly canClose = computed(() => {
    if (this.isClosed()) return false;
    const t = this.thread();
    if (!t) return false;
    const role = this.authState.role();
    if (role === 'MODERATOR' || role === 'ADMIN') return true;
    const userId = this.authState.user()?.id;
    if (!userId) return false;
    const raw = localStorage.getItem(`myThreadIds_${userId}`);
    if (!raw) return false;
    try { return (JSON.parse(raw) as string[]).includes(t.id); } catch { return false; }
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.forumService.getThread(id).subscribe({
      next: thread => {
        this.thread.set(thread);
        this.isLoading.set(false);
        this.loadAnswers(0);
      },
      error: () => {
        this.loadError.set('No se pudo cargar el hilo. Intenta de nuevo.');
        this.isLoading.set(false);
      },
    });
  }

  private loadAnswers(page: number): void {
    this.isLoadingAnswers.set(true);
    const id = this.route.snapshot.paramMap.get('id')!;
    this.forumService.getAnswers(id, page).subscribe({
      next: paged => {
        if (page === 0) {
          this.answers.set(paged.content);
        } else {
          this.answers.update(prev => [...prev, ...paged.content]);
        }
        this.answersPage = paged.page;
        this.hasMoreAnswers.set(!paged.last);
        this.isLoadingAnswers.set(false);
      },
      error: () => { this.isLoadingAnswers.set(false); },
    });
  }

  loadMoreAnswers(): void {
    if (this.isLoadingAnswers() || !this.hasMoreAnswers()) return;
    this.loadAnswers(this.answersPage + 1);
  }

  submitAnswer(): void {
    this.answerForm.markAllAsTouched();
    if (this.answerForm.invalid || this.isSubmitting()) return;

    const body = this.answerForm.getRawValue().body.trim();
    this.isSubmitting.set(true);
    const threadId = this.route.snapshot.paramMap.get('id')!;

    this.forumService.createAnswer(threadId, { body }).subscribe({
      next: answer => {
        this.answers.update(prev => [...prev, answer]);
        this.answerForm.reset();
        this.isSubmitting.set(false);
        this.toast.success('Respuesta publicada');
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.toast.error('Este hilo está cerrado y no acepta nuevas respuestas.');
        } else {
          this.toast.error('Error al publicar la respuesta. Intenta de nuevo.');
        }
      },
    });
  }

  closeThread(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    const threadId = this.route.snapshot.paramMap.get('id')!;

    this.forumService.closeThread(threadId).subscribe({
      next: updated => {
        this.thread.set(updated);
        this.isClosing.set(false);
        this.toast.success('Hilo cerrado');
      },
      error: (err: HttpErrorResponse) => {
        this.isClosing.set(false);
        if (err.status === 403) {
          this.toast.error('No tienes permiso para cerrar este hilo.');
        } else {
          this.toast.error('Error al cerrar el hilo. Intenta de nuevo.');
        }
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
