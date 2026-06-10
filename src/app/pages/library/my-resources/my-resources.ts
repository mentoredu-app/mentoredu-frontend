import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LibraryService } from '../../../services/library.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
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
  private toast = inject(ToastService);
  readonly authState = inject(AuthStateService);

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');
  readonly resources = signal<ResourceResponse[]>([]);
  readonly hasMore = signal(false);
  private currentPage = 0;
  readonly updatingIds = signal<Set<string>>(new Set());

  isUpdating(id: string): boolean {
    return this.updatingIds().has(id);
  }

  toggleSettings(resource: ResourceResponse, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isUpdating(resource.id)) return;

    this.updatingIds.update(s => new Set([...s, resource.id]));
    const newValue = !resource.aceptaResoluciones;

    this.libraryService.updateSettings(resource.id, { aceptaResoluciones: newValue }).subscribe({
      next: updated => {
        this.resources.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.updatingIds.update(s => { const ns = new Set(s); ns.delete(resource.id); return ns; });
        this.toast.success(newValue ? 'Ejercicio activado: ya acepta resoluciones' : 'Resoluciones desactivadas');
      },
      error: (err: HttpErrorResponse) => {
        this.updatingIds.update(s => { const ns = new Set(s); ns.delete(resource.id); return ns; });
        if (err.status === 400) {
          this.toast.error(err.error?.message ?? 'Solo los recursos de tipo PRACTICA aceptan resoluciones.');
        } else if (err.status === 403) {
          this.toast.error('No tienes permiso para modificar este recurso.');
        } else {
          this.toast.error('Error al actualizar la configuración. Intenta de nuevo.');
        }
      },
    });
  }

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
