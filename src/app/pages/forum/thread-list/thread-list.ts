import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { ForumService } from '../../../services/forum.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ReportButton } from '../../../shared/components/report-button/report-button';
import { ThreadResponse, ThreadStatus } from '../../../models/forum.model';
import { University, Course } from '../../../models/catalog.model';

interface ThreadFilters {
  universityId: string;
  courseId: string;
  status: ThreadStatus | '';
}

@Component({
  selector: 'app-thread-list',
  imports: [RouterLink, FormsModule, LoadingSpinner, EmptyState, ReportButton],
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
  // Todos los hilos cargados del servidor (sin filtrar)
  private readonly allThreads = signal<ThreadResponse[]>([]);
  readonly hasMore = signal(false);
  private currentPage = 0;

  readonly universities = signal<University[]>([]);
  readonly courses = signal<Course[]>([]);

  filters: ThreadFilters = { universityId: '', courseId: '', status: '' };
  // Señal auxiliar para que computed reaccione a cambios en filters (plain object)
  private readonly _filterTick = signal(0);

  // Filtrado client-side: el backend solo soporta paginación, los filtros se aplican aquí
  readonly threads = computed(() => {
    this._filterTick(); // reactivo al tick
    const all = this.allThreads();
    return all.filter(t => {
      if (this.filters.status && t.status !== this.filters.status) return false;
      if (this.filters.universityId && t.universityId !== this.filters.universityId) return false;
      if (this.filters.courseId && t.courseId !== this.filters.courseId) return false;
      return true;
    });
  });

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

    this.loadThreads(0);
  }

  applyFilter(): void {
    // Incrementar el tick hace que el computed `threads` se recalcule
    this._filterTick.update(v => v + 1);
  }

  clearFilters(): void {
    this.filters = { universityId: '', courseId: '', status: '' };
    this._filterTick.update(v => v + 1);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadThreads(this.currentPage + 1);
  }

  private loadThreads(page: number): void {
    if (page === 0) {
      this.isLoading.set(true);
      this.loadError.set('');
    } else {
      this.isLoadingMore.set(true);
    }

    this.forumService.getThreads(page, 15).subscribe({
      next: paged => {
        if (page === 0) {
          this.allThreads.set(paged.content);
        } else {
          this.allThreads.update(prev => [...prev, ...paged.content]);
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

  myThreadBadge(thread: ThreadResponse): 'mine' | 'mine-anon' | null {
    if (!this.authState.user() || !this.myThreadIds.has(thread.id)) return null;
    return thread.anonymous ? 'mine-anon' : 'mine';
  }

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
