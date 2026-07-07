import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LibraryService } from '../../../services/library.service';
import { CatalogService } from '../../../services/catalog.service';
import { CommunityService } from '../../../services/community.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AiService } from '../../../services/ai.service';
import { ReportInsight } from '../../../models/ai.model';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { ResourceResponse, ResourceType, RESOURCE_TYPE_LABELS, UpdateResourceRequest } from '../../../models/resource.model';
import { Area, Career, Course, University } from '../../../models/catalog.model';
import { resolveFileUrl } from '../../../services/file-upload.service';

@Component({
  selector: 'app-resource-detail',
  imports: [RouterLink, LoadingSpinner],
  templateUrl: './resource-detail.html',
  styleUrl: './resource-detail.css',
})
export class ResourceDetail implements OnInit, OnDestroy {
  private route             = inject(ActivatedRoute);
  private router            = inject(Router);
  private http              = inject(HttpClient);
  private libraryService    = inject(LibraryService);
  private catalogService    = inject(CatalogService);
  private communityService  = inject(CommunityService);
  private sanitizer         = inject(DomSanitizer);
  private aiService         = inject(AiService);
  readonly authState        = inject(AuthStateService);

  readonly isLoading            = signal(true);
  readonly loadError            = signal('');
  readonly resource             = signal<ResourceResponse | null>(null);
  readonly isAssociatedReviewer = signal(false);
  readonly isDownloading = signal(false);
  readonly isMutating    = signal(false);
  readonly isLoadingReport = signal(false);
  readonly report = signal<ReportInsight | null>(null);
  readonly reportError = signal('');

  // PDF preview — se carga vía HttpClient para incluir el token JWT
  readonly isPdfLoading  = signal(false);
  readonly pdfBlobUrl    = signal<SafeResourceUrl | null>(null);
  private blobUrlRef: string | null = null;

  readonly universityName = signal('');
  readonly areaName       = signal('');
  readonly careerName     = signal('');
  readonly courseName     = signal('');

  readonly typeLabels = RESOURCE_TYPE_LABELS;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.libraryService.getById(id).subscribe({
      next: (r) => {
        this.resource.set(r);
        this.isLoading.set(false);
        this.loadCatalogNames(r);
        this.loadPdfPreview(r.id);

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

  // Obtiene el contenido del archivo a través del backend (que proxea desde Cloudinary con credenciales)
  private fetchBlob(resourceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/resources/${resourceId}/content`, { responseType: 'blob' });
  }

  private loadPdfPreview(resourceId: string): void {
    this.isPdfLoading.set(true);
    this.fetchBlob(resourceId).subscribe({
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

    // 1. Registrar la descarga en el backend (log) y obtener fileName
    this.libraryService.download(r.id).subscribe({
      next: (dl) => {
        // 2. Obtener el contenido binario a través del proxy del backend
        this.fetchBlob(r.id).subscribe({
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

  authorAvatarUrl(resource: ResourceResponse): string | null {
    return resolveFileUrl(resource.authorAvatarUrl);
  }

  authorInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  typeLabel(type: ResourceType): string {
    return this.typeLabels[type] ?? type;
  }

  formatSize(bytes: number): string {
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  canSeeReport(): boolean {
    const role = this.authState.role();
    const r = this.resource();
    if (!r || !r.aceptaResoluciones) return false;
    return role === 'ADMIN'
      || r.authorId === this.authState.user()?.id
      || this.isAssociatedReviewer();
  }

  canManageResource(): boolean {
    const r = this.resource();
    const userId = this.authState.user()?.id;
    const role = this.authState.role();
    return !!r && (role === 'ADMIN' || r.authorId === userId);
  }

  editResource(): void {
    const r = this.resource();
    if (!r || !this.canManageResource() || this.isMutating()) return;

    const title = window.prompt('Titulo del recurso', r.title);
    if (title === null) return;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      window.alert('El titulo debe tener al menos 3 caracteres.');
      return;
    }

    const descriptionInput = window.prompt('Descripcion del recurso', r.description ?? '');
    if (descriptionInput === null) return;

    const yearInput = window.prompt('Ano del recurso. Deja vacio si es desconocido.', r.resourceYear?.toString() ?? '');
    if (yearInput === null) return;

    let resourceYear: number | null = null;
    const trimmedYear = yearInput.trim();
    if (trimmedYear) {
      const parsed = Number(trimmedYear);
      if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
        window.alert('El ano debe estar entre 1900 y 2100.');
        return;
      }
      resourceYear = parsed;
    }

    const request: UpdateResourceRequest = {
      title: cleanTitle,
      description: descriptionInput.trim() || null,
      resourceYear,
      aceptaResoluciones: r.aceptaResoluciones,
    };

    this.isMutating.set(true);
    this.libraryService.update(r.id, request).subscribe({
      next: updated => {
        this.resource.set(updated);
        this.loadCatalogNames(updated);
        this.isMutating.set(false);
      },
      error: () => {
        window.alert('No se pudo actualizar el recurso.');
        this.isMutating.set(false);
      },
    });
  }

  deleteResource(): void {
    const r = this.resource();
    if (!r || !this.canManageResource() || this.isMutating()) return;
    if (!window.confirm(`Eliminar "${r.title}"? Esta accion no se puede deshacer.`)) return;

    this.isMutating.set(true);
    this.libraryService.delete(r.id).subscribe({
      next: () => this.router.navigateByUrl('/library'),
      error: () => {
        window.alert('No se pudo eliminar el recurso.');
        this.isMutating.set(false);
      },
    });
  }

  generateReport(): void {
    const r = this.resource();
    if (!r || this.isLoadingReport()) return;
    this.isLoadingReport.set(true);
    this.report.set(null);
    this.reportError.set('');

    this.aiService.getReport(r.id).subscribe({
      next: res => {
        this.report.set(res.insight);
        this.isLoadingReport.set(false);
      },
      error: () => {
        this.reportError.set('No se pudo generar el análisis. Intenta de nuevo.');
        this.isLoadingReport.set(false);
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}
