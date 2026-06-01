import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { ForumService } from '../../../services/forum.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ThreadResponse, ThreadStatus } from '../../../models/forum.model';
import { University, Course } from '../../../models/catalog.model';

interface ThreadFilters {
  universityId: string;
  courseId: string;
  status: ThreadStatus | '';
}

@Component({
  selector: 'app-thread-list',
  imports: [RouterLink, FormsModule, LoadingSpinner, EmptyState],
  templateUrl: './thread-list.html',
  styleUrl: './thread-list.css',
})
export class ThreadList implements OnInit {
  private forumService = inject(ForumService);
  private catalogService = inject(CatalogService);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');
  readonly threads = signal<ThreadResponse[]>([]);
  readonly hasMore = signal(false);
  private currentPage = 0;

  readonly universities = signal<University[]>([]);
  readonly courses = signal<Course[]>([]);

  filters: ThreadFilters = { universityId: '', courseId: '', status: '' };

  private readonly searchTrigger = new Subject<void>();
  // IDs de hilos creados por este usuario en este dispositivo, keyeados por userId
  private myThreadIds = new Set<string>();

  get hasActiveFilters(): boolean {
    return !!(this.filters.universityId || this.filters.courseId || this.filters.status);
  }

  ngOnInit(): void {
    const userId = this.authState.user()?.id;
    if (userId) {
      const raw = localStorage.getItem(`myThreadIds_${userId}`);
      if (raw) { try { this.myThreadIds = new Set(JSON.parse(raw)); } catch {} }
    }

    this.catalogService.getUniversities().subscribe({ next: unis => this.universities.set(unis) });
    this.catalogService.getAllCourses().subscribe({ next: cs => this.courses.set(cs) });

    this.searchTrigger.pipe(debounceTime(200)).subscribe(() => this.resetAndSearch());
    this.searchTrigger.next();
  }

  triggerSearch(): void {
    this.searchTrigger.next();
  }

  clearFilters(): void {
    this.filters = { universityId: '', courseId: '', status: '' };
    this.searchTrigger.next();
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadThreads(this.currentPage + 1);
  }

  private resetAndSearch(): void {
    this.currentPage = 0;
    this.threads.set([]);
    this.hasMore.set(false);
    this.loadThreads(0);
  }

  private loadThreads(page: number): void {
    if (page === 0) {
      this.isLoading.set(true);
      this.loadError.set('');
    } else {
      this.isLoadingMore.set(true);
    }

    this.forumService.getThreads({
      universityId: this.filters.universityId || undefined,
      courseId:     this.filters.courseId     || undefined,
      status:       this.filters.status       || undefined,
      page,
      size: 15,
    }).subscribe({
      next: paged => {
        if (page === 0) {
          this.threads.set(paged.content);
        } else {
          this.threads.update(prev => [...prev, ...paged.content]);
        }
        this.currentPage = paged.page;
        this.hasMore.set(!paged.last);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar el foro. Intenta de nuevo.');
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  // Badge "Mío" / "Mío (Anónimo)" basado en localStorage, no en authorId (que el backend no expone)
  myThreadBadge(thread: ThreadResponse): 'mine' | 'mine-anon' | null {
    if (!this.authState.user() || !this.myThreadIds.has(thread.id)) return null;
    return thread.anonymous ? 'mine-anon' : 'mine';
  }

  // Resuelve el nombre de contexto a partir de los IDs y los catálogos ya cargados
  contextLabel(thread: ThreadResponse): string | null {
    if (thread.courseId) {
      return this.courses().find(c => c.id === thread.courseId)?.name ?? null;
    }
    if (thread.universityId) {
      return this.universities().find(u => u.id === thread.universityId)?.name ?? null;
    }
    if (thread.careerId) return 'Carrera';
    return null;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  excerpt(body: string, max = 120): string {
    return body.length > max ? body.slice(0, max).trimEnd() + '…' : body;
  }
}
