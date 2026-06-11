import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LibraryService } from '../../../services/library.service';
import { CatalogService } from '../../../services/catalog.service';
import { CommunityService } from '../../../services/community.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { Area, Career, Course, University } from '../../../models/catalog.model';

@Component({
  selector: 'app-resource-detail',
  imports: [RouterLink, LoadingSpinner],
  templateUrl: './resource-detail.html',
  styleUrl: './resource-detail.css',
})
export class ResourceDetail implements OnInit, OnDestroy {
  private route             = inject(ActivatedRoute);
  private http              = new HttpClient(inject(HttpBackend));
  private libraryService    = inject(LibraryService);
  private catalogService    = inject(CatalogService);
  private communityService  = inject(CommunityService);
  private sanitizer         = inject(DomSanitizer);
  readonly authState        = inject(AuthStateService);

  readonly isLoading            = signal(true);
  readonly loadError            = signal('');
  readonly resource             = signal<ResourceResponse | null>(null);
  readonly isAssociatedReviewer = signal(false);
  readonly isDownloading = signal(false);

  // PDF preview — se carga vía HttpClient para incluir el token JWT
  readonly isPdfLoading  = signal(false);
  readonly pdfBlobUrl    = signal<SafeResourceUrl | null>(null);
  private blobUrlRef: string | null = null;

  readonly universityName = signal('');
  readonly areaName       = signal('');
  readonly careerName     = signal('');
  readonly courseName     = signal('');

  readonly typeLabels = RESOURCE_TYPE_LABELS;

  private readonly serverUrl = environment.apiUrl.replace('/api/v1', '');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.libraryService.getById(id).subscribe({
      next: (r) => {
        this.resource.set(r);
        this.isLoading.set(false);
        this.loadCatalogNames(r);
        this.loadPdfPreview(r.fileUrl);

        // Docente asociado: verificar si tiene acceso de revisor a este recurso
        if (this.authState.role() === 'TEACHER' && r.authorId !== this.authState.user()?.id && r.aceptaResoluciones) {
          this.communityService.getAcademiesOfTeacher(this.authState.user()!.id).subscribe({
            next: academies => {
              this.isAssociatedReviewer.set(academies.some(a => a.userId === r.authorId));
            },
            error: () => {},
          });
        }
      },
      error: () => {
        this.loadError.set('No se encontró el recurso o no tienes acceso.');
        this.isLoading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.blobUrlRef) URL.revokeObjectURL(this.blobUrlRef);
  }

  // Resuelve rutas relativas (uploads/...) a URL absolutas del backend
  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${this.serverUrl}${path}`;
  }

  // Descarga el PDF como blob a través del HttpClient (lleva el JWT automáticamente)
  // y devuelve un observable. Reutilizado por preview y por la descarga.
  private fetchBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(this.resolveUrl(fileUrl), { responseType: 'blob' });
  }

  private loadPdfPreview(fileUrl: string): void {
    this.isPdfLoading.set(true);
    this.fetchBlob(fileUrl).subscribe({
      next: (blob) => {
        if (this.blobUrlRef) URL.revokeObjectURL(this.blobUrlRef);
        this.blobUrlRef = URL.createObjectURL(blob);
        this.pdfBlobUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrlRef));
        this.isPdfLoading.set(false);
      },
      error: () => this.isPdfLoading.set(false),
    });
  }

  private loadCatalogNames(r: ResourceResponse): void {
    const obs: { [key: string]: Observable<unknown> } = {
      universities: this.catalogService.getUniversities(),
      areas: this.catalogService.getAreasByUniversity(r.universityId),
    };
    if (r.careerId) obs['careers'] = this.catalogService.getCareersByUniversity(r.universityId);
    if (r.courseId) obs['courses'] = this.catalogService.getCoursesByArea(r.areaId);

    forkJoin(obs).subscribe({
      next: (results) => {
        const uni  = (results['universities'] as University[]).find(u => u.id === r.universityId);
        const area = (results['areas'] as Area[]).find(a => a.id === r.areaId);
        if (uni)  this.universityName.set(uni.name);
        if (area) this.areaName.set(area.name);
        if (r.careerId) {
          const career = (results['careers'] as Career[])?.find(c => c.id === r.careerId);
          if (career) this.careerName.set(career.name);
        }
        if (r.courseId) {
          const course = (results['courses'] as Course[])?.find(c => c.id === r.courseId);
          if (course) this.courseName.set(course.name);
        }
      },
    });
  }

  download(): void {
    const r = this.resource();
    if (!r || this.isDownloading()) return;
    this.isDownloading.set(true);

    // 1. Registrar la descarga en el backend (log) y obtener fileUrl
    this.libraryService.download(r.id).subscribe({
      next: (dl) => {
        // 2. Descargar el archivo como blob a través del HttpClient (con token JWT)
        this.fetchBlob(dl.fileUrl).subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = dl.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.isDownloading.set(false);
          },
          error: () => this.isDownloading.set(false),
        });
      },
      error: () => this.isDownloading.set(false),
    });
  }

  // Abre el blob ya cargado en una nueva pestaña (sin nueva petición HTTP)
  openInNewTab(): void {
    if (this.blobUrlRef) window.open(this.blobUrlRef, '_blank');
  }

  typeLabel(type: ResourceType): string {
    return this.typeLabels[type] ?? type;
  }

  formatSize(bytes: number): string {
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}
