import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { LibraryService } from '../../../services/library.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { University, Area } from '../../../models/catalog.model';

interface SearchFilters {
  q: string;
  universityId: string;
  areaId: string;
  type: ResourceType | '';
}

@Component({
  selector: 'app-resource-list',
  imports: [RouterLink, FormsModule, LoadingSpinner, EmptyState],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.css',
})
export class ResourceList implements OnInit {
  private libraryService = inject(LibraryService);
  private catalogService = inject(CatalogService);
  readonly authState = inject(AuthStateService);
  private destroyRef = inject(DestroyRef);

  // Estado de datos
  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');
  readonly resources = signal<ResourceResponse[]>([]);
  readonly hasMore = signal(false);
  private currentPage = 0;

  // Catálogo
  readonly universities = signal<University[]>([]);
  readonly areas = signal<Area[]>([]);

  // Estado de filtros centralizado — única fuente de verdad
  filters: SearchFilters = { q: '', universityId: '', areaId: '', type: '' };

  readonly typeLabels = RESOURCE_TYPE_LABELS;
  readonly resourceTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

  readonly canPublish = computed(() => {
    const r = this.authState.role();
    return r === 'TEACHER' || r === 'ACADEMY' || r === 'ADMIN';
  });

  // Getter en lugar de computed para evitar problemas de reactividad zoneless con no-signals
  get hasActiveFilters(): boolean {
    return !!(this.filters.q || this.filters.universityId || this.filters.areaId || this.filters.type);
  }

  // Pipeline único para TODOS los cambios de filtros — sin distinctUntilChanged
  private readonly searchTrigger = new Subject<void>();

  ngOnInit(): void {
    this.catalogService.getUniversities().subscribe({
      next: unis => this.universities.set(unis),
    });

    this.searchTrigger.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.resetAndSearch());

    // Carga inicial
    this.searchTrigger.next();
  }

  // Un único método de disparo — cualquier cambio (texto o dropdown) lo llama
  triggerSearch(): void {
    this.searchTrigger.next();
  }

  onUniversityChange(): void {
    this.filters.areaId = '';
    this.areas.set([]);
    if (this.filters.universityId) {
      this.catalogService.getAreasByUniversity(this.filters.universityId).subscribe({
        next: a => this.areas.set(a),
      });
    }
    this.searchTrigger.next();
  }

  clearFilters(): void {
    this.filters = { q: '', universityId: '', areaId: '', type: '' };
    this.areas.set([]);
    this.searchTrigger.next();
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadResources(this.currentPage + 1);
  }

  private resetAndSearch(): void {
    this.currentPage = 0;
    this.resources.set([]);
    this.hasMore.set(false);
    this.loadResources(0);
  }

  private loadResources(page: number): void {
    if (page === 0) {
      this.isLoading.set(true);
      this.loadError.set('');
    } else {
      this.isLoadingMore.set(true);
    }

    // Solo se envían parámetros con valor — el backend ignora los que no llegan
    const params: Record<string, string | number> = { page, size: 12 };
    if (this.filters.q.trim())        params['q']            = this.filters.q.trim();
    if (this.filters.universityId)    params['universityId'] = this.filters.universityId;
    if (this.filters.areaId)          params['areaId']       = this.filters.areaId;
    if (this.filters.type)            params['type']         = this.filters.type;

    this.libraryService.search(params).subscribe({
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
        this.loadError.set('No se pudo cargar la biblioteca. Intenta de nuevo.');
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
