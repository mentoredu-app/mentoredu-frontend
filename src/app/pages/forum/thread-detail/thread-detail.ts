import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ForumService } from '../../../services/forum.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ReportButton } from '../../../shared/components/report-button/report-button';
import { AnswerResponse, CommentResponse, ReactionType, ThreadResponse } from '../../../models/forum.model';
import { resolveFileUrl } from '../../../services/file-upload.service';

@Component({
  selector: 'app-thread-detail',
  imports: [RouterLink, ReactiveFormsModule, LoadingSpinner, ReportButton],
  templateUrl: './thread-detail.html',
  styleUrl: './thread-detail.css',
})
export class ThreadDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
  readonly mutatingIds = signal<Set<string>>(new Set());

  // Estado de reacciones: key = 'thread_{id}' | 'answer_{id}', value = tipo activo o null
  private readonly reactions = signal<Record<string, ReactionType | null>>({});
  // Botones en proceso de envío para evitar doble click
  private readonly reacting = signal<Set<string>>(new Set());

  // ── Comentarios ───────────────────────────────────────────────
  private readonly commentsByAnswer = signal<Record<string, CommentResponse[]>>({});
  private readonly loadingComments = signal<Set<string>>(new Set());
  private readonly openComments = signal<Set<string>>(new Set());
  private readonly submittingComment = signal<Set<string>>(new Set());
  private readonly commentTexts = signal<Record<string, string>>({});

  readonly answerForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  readonly bodyLength = computed(() => this.answerForm.get('body')!.value?.length ?? 0);
  readonly isClosed = computed(() => this.thread()?.status === 'CLOSED');

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
        // Inicializar reacción del hilo desde el servidor
        if (thread.myReaction) {
          this.reactions.update(r => ({ ...r, [`thread_${thread.id}`]: thread.myReaction }));
        }
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
        // Inicializar reacciones de las respuestas desde el servidor
        const patch: Record<string, ReactionType | null> = {};
        for (const a of paged.content) {
          if (a.myReaction) patch[`answer_${a.id}`] = a.myReaction;
        }
        if (Object.keys(patch).length > 0) {
          this.reactions.update(r => ({ ...r, ...patch }));
        }
        this.answersPage = paged.page;
        this.hasMoreAnswers.set(!paged.last);
        this.isLoadingAnswers.set(false);
        // Pre-cargar comentarios de cada respuesta para que el botón muestre el conteo correcto
        for (const answer of paged.content) {
          this.fetchComments(answer.id);
        }
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

  canManageThread(): boolean {
    const t = this.thread();
    if (!t) return false;
    if (this.authState.role() === 'ADMIN') return true;
    const userId = this.authState.user()?.id;
    if (!userId) return false;
    if (t.authorId === userId) return true;
    return this.ownsThreadFromLocalStorage(t.id, userId);
  }

  canManageAnswer(answer: AnswerResponse): boolean {
    return this.authState.role() === 'ADMIN' || answer.authorId === this.authState.user()?.id;
  }

  canManageComment(comment: CommentResponse): boolean {
    return this.authState.role() === 'ADMIN' || comment.authorId === this.authState.user()?.id;
  }

  editThread(): void {
    const t = this.thread();
    if (!t || this.isMutating(t.id)) return;
    const title = window.prompt('Nuevo titulo del hilo:', t.title);
    if (title === null) return;
    const body = window.prompt('Nuevo contenido del hilo:', t.body);
    if (body === null) return;

    this.setMutating(t.id, true);
    this.forumService.updateThread(t.id, { title: title.trim(), body: body.trim() }).subscribe({
      next: updated => {
        this.thread.set(updated);
        this.setMutating(t.id, false);
        this.toast.success('Hilo actualizado');
      },
      error: err => {
        this.setMutating(t.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo actualizar el hilo.');
      },
    });
  }

  deleteThread(): void {
    const t = this.thread();
    if (!t || this.isMutating(t.id)) return;
    if (!window.confirm(`Eliminar el hilo "${t.title}"? Tambien se eliminaran sus respuestas y comentarios.`)) return;

    this.setMutating(t.id, true);
    this.forumService.deleteThread(t.id).subscribe({
      next: () => {
        this.toast.success('Hilo eliminado');
        this.router.navigate(['/forum']);
      },
      error: err => {
        this.setMutating(t.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo eliminar el hilo.');
      },
    });
  }

  editAnswer(answer: AnswerResponse): void {
    if (this.isMutating(answer.id)) return;
    const body = window.prompt('Editar respuesta:', answer.body);
    if (body === null) return;
    const threadId = this.route.snapshot.paramMap.get('id')!;

    this.setMutating(answer.id, true);
    this.forumService.updateAnswer(threadId, answer.id, { body: body.trim() }).subscribe({
      next: updated => {
        this.answers.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.setMutating(answer.id, false);
        this.toast.success('Respuesta actualizada');
      },
      error: err => {
        this.setMutating(answer.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo actualizar la respuesta.');
      },
    });
  }

  deleteAnswer(answer: AnswerResponse): void {
    if (this.isMutating(answer.id)) return;
    if (!window.confirm('Eliminar esta respuesta? Tambien se eliminaran sus comentarios.')) return;
    const threadId = this.route.snapshot.paramMap.get('id')!;

    this.setMutating(answer.id, true);
    this.forumService.deleteAnswer(threadId, answer.id).subscribe({
      next: () => {
        this.answers.update(list => list.filter(a => a.id !== answer.id));
        this.commentsByAnswer.update(map => {
          const next = { ...map };
          delete next[answer.id];
          return next;
        });
        this.setMutating(answer.id, false);
        this.toast.success('Respuesta eliminada');
      },
      error: err => {
        this.setMutating(answer.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo eliminar la respuesta.');
      },
    });
  }

  editComment(answerId: string, comment: CommentResponse): void {
    if (this.isMutating(comment.id)) return;
    const body = window.prompt('Editar comentario:', comment.body);
    if (body === null) return;

    this.setMutating(comment.id, true);
    this.forumService.updateComment(answerId, comment.id, { body: body.trim() }).subscribe({
      next: updated => {
        this.commentsByAnswer.update(map => ({
          ...map,
          [answerId]: (map[answerId] ?? []).map(c => c.id === updated.id ? updated : c),
        }));
        this.setMutating(comment.id, false);
        this.toast.success('Comentario actualizado');
      },
      error: err => {
        this.setMutating(comment.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo actualizar el comentario.');
      },
    });
  }

  deleteComment(answerId: string, comment: CommentResponse): void {
    if (this.isMutating(comment.id)) return;
    if (!window.confirm('Eliminar este comentario?')) return;

    this.setMutating(comment.id, true);
    this.forumService.deleteComment(answerId, comment.id).subscribe({
      next: () => {
        this.commentsByAnswer.update(map => ({
          ...map,
          [answerId]: (map[answerId] ?? []).filter(c => c.id !== comment.id),
        }));
        this.setMutating(comment.id, false);
        this.toast.success('Comentario eliminado');
      },
      error: err => {
        this.setMutating(comment.id, false);
        this.toast.error(err.error?.message ?? 'No se pudo eliminar el comentario.');
      },
    });
  }

  // ── Reacciones ────────────────────────────────────────────────

  getReaction(key: string): ReactionType | null {
    return this.reactions()[key] ?? null;
  }

  isReacting(key: string): boolean {
    return this.reacting().has(key);
  }

  reactThread(type: ReactionType): void {
    const t = this.thread();
    if (!t) return;
    const key = `thread_${t.id}`;
    this.sendReaction(key, type, () =>
      this.forumService.reactToThread(t.id, type)
    );
  }

  reactAnswer(answerId: string, type: ReactionType): void {
    const key = `answer_${answerId}`;
    this.sendReaction(key, type, () =>
      this.forumService.reactToAnswer(answerId, type)
    );
  }

  private sendReaction(
    key: string,
    type: ReactionType,
    call: () => ReturnType<ForumService['reactToThread']>
  ): void {
    if (this.reacting().has(key)) return;

    const prevReaction = this.getReaction(key);
    this.reacting.update(s => { const n = new Set(s); n.add(key); return n; });

    call().subscribe({
      next: res => {
        this.reacting.update(s => { const n = new Set(s); n.delete(key); return n; });
        if (res.status === 204) {
          this.reactions.update(r => ({ ...r, [key]: null }));
          this.adjustCounts(key, type, 'removed', prevReaction);
        } else {
          this.reactions.update(r => ({ ...r, [key]: type }));
          this.adjustCounts(key, type, 'added', prevReaction);
        }
      },
      error: () => {
        this.reacting.update(s => { const n = new Set(s); n.delete(key); return n; });
        this.toast.error('No se pudo registrar la reacción.');
      },
    });
  }

  private adjustCounts(
    key: string,
    type: ReactionType,
    action: 'added' | 'removed',
    prev: ReactionType | null
  ): void {
    const delta = (current: number, reaction: ReactionType): number => {
      if (action === 'removed') return reaction === type ? Math.max(0, current - 1) : current;
      // added: increment new type, decrement previous if it was different
      if (reaction === type) return current + 1;
      if (prev && prev !== type && reaction === prev) return Math.max(0, current - 1);
      return current;
    };

    if (key.startsWith('thread_')) {
      this.thread.update(t => t ? ({
        ...t,
        likeCount:    delta(t.likeCount,    'LIKE'),
        dislikeCount: delta(t.dislikeCount, 'DISLIKE'),
      }) : t);
    } else {
      const answerId = key.slice('answer_'.length);
      this.answers.update(list => list.map(a => a.id !== answerId ? a : ({
        ...a,
        likeCount:    delta(a.likeCount,    'LIKE'),
        dislikeCount: delta(a.dislikeCount, 'DISLIKE'),
      })));
    }
  }

  // ── Comentarios ───────────────────────────────────────────────

  isCommentsOpen(answerId: string): boolean {
    return this.openComments().has(answerId);
  }

  commentsFor(answerId: string): CommentResponse[] {
    return this.commentsByAnswer()[answerId] ?? [];
  }

  isLoadingComments(answerId: string): boolean {
    return this.loadingComments().has(answerId);
  }

  isSubmittingComment(answerId: string): boolean {
    return this.submittingComment().has(answerId);
  }

  getCommentText(answerId: string): string {
    return this.commentTexts()[answerId] ?? '';
  }

  setCommentText(answerId: string, value: string): void {
    this.commentTexts.update(t => ({ ...t, [answerId]: value }));
  }

  toggleComments(answerId: string): void {
    const isOpen = this.openComments().has(answerId);
    if (isOpen) {
      this.openComments.update(s => { const n = new Set(s); n.delete(answerId); return n; });
    } else {
      this.openComments.update(s => new Set([...s, answerId]));
      // Carga lazy: solo pide si no se cargaron aún
      if (!(answerId in this.commentsByAnswer())) {
        this.fetchComments(answerId);
      }
    }
  }

  private fetchComments(answerId: string): void {
    this.loadingComments.update(s => new Set([...s, answerId]));
    this.forumService.getComments(answerId).subscribe({
      next: comments => {
        this.commentsByAnswer.update(m => ({ ...m, [answerId]: comments }));
        this.loadingComments.update(s => { const n = new Set(s); n.delete(answerId); return n; });
      },
      error: () => {
        this.loadingComments.update(s => { const n = new Set(s); n.delete(answerId); return n; });
      },
    });
  }

  submitComment(answerId: string): void {
    const body = this.getCommentText(answerId).trim();
    if (!body || this.isSubmittingComment(answerId)) return;

    this.submittingComment.update(s => new Set([...s, answerId]));
    this.forumService.createComment(answerId, { body }).subscribe({
      next: comment => {
        this.commentsByAnswer.update(m => ({
          ...m,
          [answerId]: [...(m[answerId] ?? []), comment],
        }));
        this.setCommentText(answerId, '');
        this.submittingComment.update(s => { const n = new Set(s); n.delete(answerId); return n; });
        this.toast.success('Comentario publicado');
      },
      error: (err: HttpErrorResponse) => {
        this.submittingComment.update(s => { const n = new Set(s); n.delete(answerId); return n; });
        if (err.status === 404) {
          this.toast.error('La respuesta ya no existe.');
        } else {
          this.toast.error('Error al publicar el comentario. Intenta de nuevo.');
        }
      },
    });
  }

  // ── Formato ───────────────────────────────────────────────────

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  authorAvatarUrl(author: { authorAvatarUrl?: string | null }): string | null {
    return resolveFileUrl(author.authorAvatarUrl);
  }

  authorInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  isMutating(id: string): boolean {
    return this.mutatingIds().has(id);
  }

  private setMutating(id: string, value: boolean): void {
    this.mutatingIds.update(current => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private ownsThreadFromLocalStorage(threadId: string, userId: string): boolean {
    const raw = localStorage.getItem(`myThreadIds_${userId}`);
    if (!raw) return false;
    try { return (JSON.parse(raw) as string[]).includes(threadId); } catch { return false; }
  }
}
