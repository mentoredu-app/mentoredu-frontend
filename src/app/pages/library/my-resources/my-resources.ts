import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LibraryService } from '../../../services/library.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';

type ResourceGroupMode = 'none' | 'type' | 'resolution' | 'month';
type ResourceSortMode = 'recent' | 'oldest' | 'title' | 'size';
type ResolutionFilter = 'all' | 'accepting' | 'not_accepting' | 'practice';

interface ResourceGroup {
  key: string;
  label: string;
  count: number;
  resources: ResourceResponse[];
}

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
  readonly query = signal('');
  readonly selectedType = signal<ResourceType | 'ALL'>('ALL');
  readonly resolutionFilter = signal<ResolutionFilter>('all');
  readonly sortMode = signal<ResourceSortMode>('recent');
  readonly groupMode = signal<ResourceGroupMode>('none');
  readonly filtersOpen = signal(false);

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

  readonly filteredResources = computed(() => {
    const normalizedQuery = this.normalize(this.query());
    const selectedType = this.selectedType();
    const resolutionFilter = this.resolutionFilter();
    const sortMode = this.sortMode();

    return this.resources()
      .filter(resource => {
        if (selectedType !== 'ALL' && resource.resourceType !== selectedType) return false;
        if (resolutionFilter === 'accepting' && !resource.aceptaResoluciones) return false;
        if (resolutionFilter === 'not_accepting' && resource.aceptaResoluciones) return false;
        if (resolutionFilter === 'practice' && resource.resourceType !== 'PRACTICA') return false;
        if (!normalizedQuery) return true;

        const haystack = this.normalize([
          resource.title,
          resource.description ?? '',
          resource.fileName,
          this.typeLabel(resource.resourceType),
        ].join(' '));
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortMode === 'title') return a.title.localeCompare(b.title, 'es');
        if (sortMode === 'size') return b.sizeBytes - a.sizeBytes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  readonly groupedResources = computed<ResourceGroup[]>(() => {
    const list = this.filteredResources();
    const groupMode = this.groupMode();
    if (groupMode === 'none') {
      return [{ key: 'all', label: 'Todos los recursos', count: list.length, resources: list }];
    }

    const groups = new Map<string, ResourceGroup>();
    for (const resource of list) {
      const { key, label } = this.groupKey(resource, groupMode);
      const current = groups.get(key);
      if (current) {
        current.resources.push(resource);
        current.count += 1;
      } else {
        groups.set(key, { key, label, count: 1, resources: [resource] });
      }
    }

    return Array.from(groups.values());
  });

  readonly hasActiveFilters = computed(() =>
    this.query().trim().length > 0 ||
    this.selectedType() !== 'ALL' ||
    this.resolutionFilter() !== 'all'
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.query().trim()) count += 1;
    if (this.selectedType() !== 'ALL') count += 1;
    if (this.resolutionFilter() !== 'all') count += 1;
    return count;
  });

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

  setQuery(value: string): void {
    this.query.set(value);
  }

  setType(value: string): void {
    this.selectedType.set(value === 'ALL' ? 'ALL' : value as ResourceType);
  }

  setResolutionFilter(value: string): void {
    this.resolutionFilter.set(value as ResolutionFilter);
  }

  setSortMode(value: string): void {
    this.sortMode.set(value as ResourceSortMode);
  }

  setGroupMode(value: string): void {
    this.groupMode.set(value as ResourceGroupMode);
  }

  toggleFilters(): void {
    this.filtersOpen.update(open => !open);
  }

  clearFilters(): void {
    this.query.set('');
    this.selectedType.set('ALL');
    this.resolutionFilter.set('all');
  }

  private groupKey(resource: ResourceResponse, mode: ResourceGroupMode): { key: string; label: string } {
    if (mode === 'type') {
      return { key: resource.resourceType, label: this.typeLabel(resource.resourceType) };
    }

    if (mode === 'resolution') {
      if (resource.aceptaResoluciones) return { key: 'accepting', label: 'Aceptan resoluciones' };
      if (resource.resourceType === 'PRACTICA') return { key: 'practice-paused', label: 'Practicas sin resoluciones' };
      return { key: 'reference', label: 'Material de consulta' };
    }

    const date = new Date(resource.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return { key, label };
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
