import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LibraryService } from '../../../services/library.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';

@Component({
  selector: 'app-resource-list',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.css',
})
export class ResourceList implements OnInit {
  private libraryService = inject(LibraryService);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly resources = signal<ResourceResponse[]>([]);

  readonly canPublish = computed(() => {
    const r = this.authState.role();
    return r === 'TEACHER' || r === 'ACADEMY' || r === 'ADMIN';
  });

  readonly typeLabels = RESOURCE_TYPE_LABELS;

  ngOnInit(): void {
    this.libraryService.search({ size: 20 }).subscribe({
      next: page => {
        this.resources.set(page.content);
        this.isLoading.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        this.loadError.set('No se pudo cargar la biblioteca. Intenta de nuevo.');
        this.isLoading.set(false);
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
}
