import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { LibraryService } from '../../../services/library.service';
import { ForumService } from '../../../services/forum.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { ThreadResponse } from '../../../models/forum.model';

type ActivityKind = 'resources' | 'threads';

@Component({
  selector: 'app-profile-activity',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './profile-activity.html',
  styleUrl: './profile-activity.css',
})
export class ProfileActivity implements OnInit {
  private route = inject(ActivatedRoute);
  private profileService = inject(ProfileService);
  private libraryService = inject(LibraryService);
  private forumService = inject(ForumService);

  readonly kind = signal<ActivityKind>('resources');
  readonly userId = signal('');
  readonly displayName = signal('');
  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly hasMore = signal(false);
  readonly resources = signal<ResourceResponse[]>([]);
  readonly threads = signal<ThreadResponse[]>([]);

  readonly typeLabels = RESOURCE_TYPE_LABELS;
  private page = 0;

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id') ?? '';
    const kind = (this.route.snapshot.data['kind'] as ActivityKind | undefined) ?? 'resources';
    this.userId.set(userId);
    this.kind.set(kind);

    this.profileService.getById(userId).subscribe({
      next: profile => {
        this.displayName.set(profile.displayName);
        this.loadPage(0);
      },
      error: () => {
        this.error.set('No se pudo cargar este perfil.');
        this.isLoading.set(false);
      },
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingMore()) return;
    this.loadPage(this.page + 1);
  }

  private loadPage(page: number): void {
    const loadingSignal = page === 0 ? this.isLoading : this.isLoadingMore;
    loadingSignal.set(true);
    this.page = page;

    if (this.kind() === 'resources') {
      this.libraryService.search({ authorId: this.userId(), page, size: 9 }).subscribe({
        next: response => {
          this.resources.update(current => page === 0 ? response.content : [...current, ...response.content]);
          this.hasMore.set(!response.last);
          loadingSignal.set(false);
        },
        error: () => this.finishWithError(loadingSignal),
      });
      return;
    }

    this.forumService.getThreadsByUser(this.userId(), page, 12).subscribe({
      next: response => {
        this.threads.update(current => page === 0 ? response.content : [...current, ...response.content]);
        this.hasMore.set(!response.last);
        loadingSignal.set(false);
      },
      error: () => this.finishWithError(loadingSignal),
    });
  }

  private finishWithError(loadingSignal: { set(value: boolean): void }): void {
    this.error.set('No se pudo cargar la actividad.');
    loadingSignal.set(false);
  }

  formatShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatSize(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }
}
