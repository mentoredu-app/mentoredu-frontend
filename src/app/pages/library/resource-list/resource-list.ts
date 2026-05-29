import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { CatalogService } from '../../../services/catalog.service';
import { LibraryService } from '../../../services/library.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { University, Area } from '../../../models/catalog.model';

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

  // Filtros (bound con ngModel)
  searchQuery = '';
  selectedUniversityId = '';
  selectedAreaId = '';
  selectedType: ResourceType | '' = '';

  readonly typeLabels = RESOURCE_TYPE_LABELS;
  readonly resourceTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[];

  readonly canPublish = computed(() => {
    const r = this.authState.role();
    return r === 'TEACHER' || r === 'ACADEMY' || r === 'ADMIN';
  });

  private searchSubject = new Subject<void>();

  ngOnInit(): void {
    this.catalogService.getUniversities().subscribe({
      next: unis => this.universities.set(unis),
    });

    // Debounce para búsqueda por texto libre
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.resetAndSearch();
    });

    this.loadResources(0);
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onFilterChange(): void {
    this.resetAndSearch();
  }

  onUniversityChange(): void {
    this.selectedAreaId = '';
    this.areas.set([]);
    if (this.selectedUniversityId) {
      this.catalogService.getAreasByUniversity(this.selectedUniversityId).subscribe({
        next: a => this.areas.set(a),
      });
    }
    this.resetAndSearch();
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadResources(this.currentPage + 1);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedUniversityId = '';
    this.selectedAreaId = '';
    this.selectedType = '';
    this.areas.set([]);
    this.resetAndSearch();
  }

  readonly hasActiveFilters = computed(() =>
    !!(this.searchQuery || this.selectedUniversityId || this.selectedAreaId || this.selectedType)
  );

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

    const params: Record<string, string | number> = { page, size: 12 };
    if (this.searchQuery.trim())      params['q']            = this.searchQuery.trim();
    if (this.selectedUniversityId)    params['universityId'] = this.selectedUniversityId;
    if (this.selectedAreaId)          params['areaId']       = this.selectedAreaId;
    if (this.selectedType)            params['type']         = this.selectedType;

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
