import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
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

  get hasActiveFilters(): boolean {
    return !!(this.filters.universityId || this.filters.courseId || this.filters.status);
  }

  ngOnInit(): void {
    this.catalogService.getUniversities().subscribe({ next: unis => this.universities.set(unis) });
    this.catalogService.getAllCourses().subscribe({ next: courses => this.courses.set(courses) });

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

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  excerpt(body: string, max = 120): string {
    return body.length > max ? body.slice(0, max).trimEnd() + '…' : body;
  }
}
