import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LibraryService } from '../../../services/library.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';

@Component({
  selector: 'app-my-resources',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './my-resources.html',
  styleUrl: './my-resources.css',
})
export class MyResources implements OnInit {
  private libraryService = inject(LibraryService);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');
  readonly resources = signal<ResourceResponse[]>([]);
  readonly hasMore = signal(false);
  private currentPage = 0;

  readonly totalLabel = computed(() => {
    const count = this.resources().length;
    if (count === 0) return '';
    return this.hasMore() ? `${count}+` : `${count}`;
  });

  readonly typeLabels = RESOURCE_TYPE_LABELS;
  readonly resourceTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

  ngOnInit(): void {
    this.loadResources(0);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadResources(this.currentPage + 1);
  }

  private loadResources(page: number): void {
    if (page === 0) {
      this.isLoading.set(true);
      this.loadError.set('');
    } else {
      this.isLoadingMore.set(true);
    }

    this.libraryService.getMyResources(page, 12).subscribe({
      next: paged => {
        if (page === 0) {
          this.resources.set(paged.content);
        } else {
          this.resources.update(prev => [...prev, ...paged.content]);
        }
        this.currentPage = paged.page;
        this.hasMore.set(!paged.last);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar tus recursos. Intenta de nuevo.');
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  typeLabel(type: ResourceType | undefined): string {
    if (!type) return '';
    return this.typeLabels[type] ?? type;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
