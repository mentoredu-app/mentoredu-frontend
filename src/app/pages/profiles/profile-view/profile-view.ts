import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { resolveFileUrl } from '../../../services/file-upload.service';
import { CatalogService } from '../../../services/catalog.service';
import { LibraryService } from '../../../services/library.service';
import { ForumService } from '../../../services/forum.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { CommunityService } from '../../../services/community.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { AcademyProfileResponse, ProfileResponse, StudentProfileResponse } from '../../../models/profile.model';
import { ResourceResponse, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { ThreadResponse } from '../../../models/forum.model';
import { MySolutionSummaryResponse, ReceivedSolutionResponse } from '../../../models/pedagogy.model';
import { AssociatedMemberResponse, AssociationStatus } from '../../../models/association.model';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  TeacherProfileDetails,
  hasTeacherProfileDetails,
  toTeacherProfileDetails,
} from '../teacher-profile-details';

type ProfileTab = 'resources' | 'threads' | 'solutions' | 'received';

@Component({
  selector: 'app-profile-view',
  imports: [LoadingSpinner, EmptyState, RouterLink],
  templateUrl: './profile-view.html',
  styleUrl: './profile-view.css',
})
export class ProfileView implements OnInit {
  private route            = inject(ActivatedRoute);
  private destroyRef       = inject(DestroyRef);
  private profileService   = inject(ProfileService);
  private catalogService   = inject(CatalogService);
  private libraryService   = inject(LibraryService);
  private forumService     = inject(ForumService);
  private pedagogyService  = inject(PedagogyService);
  private communityService = inject(CommunityService);
  private authState        = inject(AuthStateService);
  private toast            = inject(ToastService);

  // â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly isLoading    = signal(true);
  readonly profile      = signal<ProfileResponse | null>(null);
  readonly studentExtra = signal<StudentProfileResponse | null>(null);
  readonly academyDetails = signal<AcademyProfileResponse | null>(null);
  readonly teacherDetails = signal<TeacherProfileDetails | null>(null);
  readonly targetUniversityName = signal('');
  readonly targetAreaName = signal('');
  readonly targetCareerName = signal('');
  readonly notFound     = signal(false);
  readonly isFollowing        = signal(false);
  readonly isFollowLoading    = signal(false);
  readonly associationStatus  = signal<AssociationStatus | 'NONE' | 'LOADING'>('NONE');
  readonly isAssocLoading     = signal(false);

  // â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly activeTab = signal<ProfileTab>('threads');

  readonly showResourcesTab = computed(() => {
    const t = this.profile()?.profileType;
    return t === 'TEACHER' || t === 'ACADEMY';
  });
  readonly showSolutionsTab = computed(() =>
    this.isOwnProfile() && this.profile()?.profileType === 'STUDENT'
  );
  readonly showReceivedTab = computed(() =>
    this.isOwnProfile() &&
    (this.profile()?.profileType === 'TEACHER' || this.profile()?.profileType === 'ACADEMY')
  );

  readonly canRequestAssociation = computed(() => {
    const role = this.authState.user()?.role;
    return !this.isOwnProfile() &&
      this.profile()?.profileType === 'ACADEMY' &&
      role === 'TEACHER';
  });

  // â”€â”€ Activity data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly tabResources  = signal<ResourceResponse[]>([]);
  readonly tabThreads    = signal<ThreadResponse[]>([]);
  readonly tabSolutions  = signal<MySolutionSummaryResponse[]>([]);
  readonly tabReceived   = signal<ReceivedSolutionResponse[]>([]);
  readonly isLoadingTab  = signal(false);
  readonly hasMore       = signal(false);
  private pages: Record<ProfileTab, number> = { resources: 0, threads: 0, solutions: 0, received: 0 };

  // â”€â”€ Computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly isOwnProfile = computed(() => {
    const user = this.authState.user();
    const p    = this.profile();
    return user && p ? user.id === p.userId : false;
  });

  readonly isSystemProfile = computed(() => {
    const t = this.profile()?.profileType;
    return t === 'ADMIN' || t === 'MODERATOR';
  });

  readonly hasTeacherDetails = computed(() =>
    hasTeacherProfileDetails(this.teacherDetails())
  );

  // â”€â”€ Equipo docente / academias asociadas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly teamMembers      = signal<AssociatedMemberResponse[]>([]);
  readonly teamIsLoading    = signal(false);

  readonly typeLabels = RESOURCE_TYPE_LABELS;

  readonly roleLabels: Record<string, string> = {
    STUDENT: 'Estudiante', TEACHER: 'Docente', ACADEMY: 'Academia',
    MODERATOR: 'Moderador', ADMIN: 'Administrador',
  };

  readonly gradeLevelLabels: Record<string, string> = {
    '1ro': '1ro de secundaria',
    '2do': '2do de secundaria',
    '3ro': '3ro de secundaria',
    '4to': '4to de secundaria',
    '5to': '5to de secundaria',
  };

  readonly statusLabels: Record<string, string> = {
    SUBMITTED: 'Enviada', REVIEWED: 'Revisada',
  };

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const userId   = params.get('id') ?? '';
        const tabParam = this.route.snapshot.queryParamMap.get('tab') as ProfileTab | null;
        this.resetState();
        this.loadProfile(userId, tabParam);
      });
  }

  private resetState(): void {
    this.isLoading.set(true);
    this.profile.set(null);
    this.studentExtra.set(null);
    this.academyDetails.set(null);
    this.teacherDetails.set(null);
    this.targetUniversityName.set('');
    this.targetAreaName.set('');
    this.targetCareerName.set('');
    this.notFound.set(false);
    this.isFollowing.set(false);
    this.associationStatus.set('NONE');
    this.teamMembers.set([]);
    this.teamIsLoading.set(false);
    this.tabResources.set([]);
    this.tabThreads.set([]);
    this.tabSolutions.set([]);
    this.tabReceived.set([]);
    this.hasMore.set(false);
    this.pages = { resources: 0, threads: 0, solutions: 0, received: 0 };
  }

  private loadProfile(userId: string, tabParam: ProfileTab | null): void {
    this.profileService.getById(userId).subscribe({
      next: p => {
        this.profile.set(p);
        this.isFollowing.set(p.isFollowing);
        this.isLoading.set(false);

        if (p.profileType === 'STUDENT' && p.hasStudentProfile) {
          this.profileService.getStudentProfile(p.userId).subscribe({
            next: s => {
              this.studentExtra.set(s);
              this.resolveStudentCatalogNames(s);
            },
            error: () => {},
          });
        }

        if (p.profileType === 'ACADEMY') {
          const academyRequest = this.isOwnProfile()
            ? this.profileService.getMyAcademyProfile()
            : this.profileService.getAcademyProfile(p.userId);
          academyRequest.subscribe({
            next: academy => this.academyDetails.set(academy),
            error: () => {},
          });

          this.teamIsLoading.set(true);
          this.communityService.getTeachersOfAcademy(p.userId).subscribe({
            next: members => { this.teamMembers.set(members); this.teamIsLoading.set(false); },
            error: () => this.teamIsLoading.set(false),
          });

          // Si el visitante es TEACHER, verificar si ya existe una asociaciÃ³n con esta academia
          if (this.authState.role() === 'TEACHER' && !this.isOwnProfile()) {
            this.communityService.getMyAssociations().subscribe({
              next: associations => {
                const existing = associations.find(a => a.academyProfileId === p.id);
                if (existing) this.associationStatus.set(existing.status);
              },
              error: () => {},
            });
          }
        } else if (p.profileType === 'TEACHER') {
          this.profileService.getTeacherProfile(p.userId).subscribe({
            next: teacherProfile => {
              this.teacherDetails.set(toTeacherProfileDetails(teacherProfile));
            },
            error: () => {},
          });

          this.teamIsLoading.set(true);
          this.communityService.getAcademiesOfTeacher(p.userId).subscribe({
            next: members => { this.teamMembers.set(members); this.teamIsLoading.set(false); },
            error: () => this.teamIsLoading.set(false),
          });
        }

        const defaultTab = this.resolveDefaultTab(p, tabParam);
        this.activeTab.set(defaultTab);
      },
      error: err => {
        this.isLoading.set(false);
        if (err.status === 404) this.notFound.set(true);
      },
    });
  }

  private resolveDefaultTab(p: ProfileResponse, requested: ProfileTab | null): ProfileTab {
    const validTabs: ProfileTab[] = ['resources', 'threads', 'solutions', 'received'];
    if (requested && validTabs.includes(requested)) return requested;
    if (p.profileType === 'TEACHER' || p.profileType === 'ACADEMY') return 'resources';
    return 'threads';
  }

  private resolveStudentCatalogNames(student: StudentProfileResponse): void {
    if (!student.targetUniversityId) return;

    this.catalogService.getUniversities().subscribe({
      next: universities => {
        this.targetUniversityName.set(
          universities.find(university => university.id === student.targetUniversityId)?.name ?? ''
        );
      },
      error: () => {},
    });

    this.catalogService.getAreasByUniversity(student.targetUniversityId).subscribe({
      next: areas => {
        this.targetAreaName.set(
          areas.find(area => area.id === student.targetAreaId)?.name ?? ''
        );
      },
      error: () => {},
    });

    this.catalogService.getCareersByUniversity(student.targetUniversityId).subscribe({
      next: careers => {
        this.targetCareerName.set(
          careers.find(career => career.id === student.targetCareerId)?.name ?? ''
        );
      },
      error: () => {},
    });
  }

  // â”€â”€ Tab switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  switchTab(tab: ProfileTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    const userId = this.profile()?.userId;
    if (!userId) return;
    const isEmpty =
      tab === 'resources' ? this.tabResources().length === 0 :
      tab === 'threads'   ? this.tabThreads().length === 0   :
      tab === 'solutions' ? this.tabSolutions().length === 0 :
                            this.tabReceived().length === 0;
    if (isEmpty) {
      this.pages[tab] = 0;
      this.loadTab(tab, userId);
    }
  }

  private loadTab(tab: ProfileTab, userId: string): void {
    this.isLoadingTab.set(true);
    const page = this.pages[tab];

    if (tab === 'resources') {
      this.libraryService.search({ authorId: userId, page, size: 6 }).subscribe({
        next: r => {
          this.tabResources.update(c => page === 0 ? r.content : [...c, ...r.content]);
          this.hasMore.set(!r.last);
          this.isLoadingTab.set(false);
        },
        error: () => this.isLoadingTab.set(false),
      });
    } else if (tab === 'threads') {
      this.forumService.getThreadsByUser(userId, page, 10).subscribe({
        next: r => {
          this.tabThreads.update(c => page === 0 ? r.content : [...c, ...r.content]);
          this.hasMore.set(!r.last);
          this.isLoadingTab.set(false);
        },
        error: () => this.isLoadingTab.set(false),
      });
    } else if (tab === 'solutions') {
      this.pedagogyService.getMySolutions(page, 10).subscribe({
        next: r => {
          this.tabSolutions.update(c => page === 0 ? r.content : [...c, ...r.content]);
          this.hasMore.set(!r.last);
          this.isLoadingTab.set(false);
        },
        error: () => this.isLoadingTab.set(false),
      });
    } else {
      this.pedagogyService.getReceivedSolutions(page, 10).subscribe({
        next: r => {
          this.tabReceived.update(c => page === 0 ? r.content : [...c, ...r.content]);
          this.hasMore.set(!r.last);
          this.isLoadingTab.set(false);
        },
        error: () => this.isLoadingTab.set(false),
      });
    }
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingTab()) return;
    const tab = this.activeTab();
    this.pages[tab]++;
    this.loadTab(tab, this.profile()!.userId);
  }

  // â”€â”€ Association â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  requestAssociation(): void {
    const profileId = this.profile()?.id;
    if (!profileId || this.isAssocLoading()) return;
    this.isAssocLoading.set(true);
    this.communityService.requestAssociation(profileId).subscribe({
      next: () => {
        this.associationStatus.set('PENDING');
        this.isAssocLoading.set(false);
        this.toast.success('Solicitud de asociacion enviada');
      },
      error: (err) => {
        this.isAssocLoading.set(false);
        if (err.status === 409) {
          this.associationStatus.set('PENDING');
          this.toast.error('Ya tienes una solicitud pendiente con esta academia');
        } else {
          this.toast.error('No se pudo enviar la solicitud. Intenta de nuevo.');
        }
      },
    });
  }

  // â”€â”€ Follow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  toggleFollow(): void {
    const userId = this.profile()?.userId;
    if (!userId || this.isFollowLoading()) return;
    this.isFollowLoading.set(true);
    this.communityService.toggleFollow(userId).subscribe({
      next: res => {
        if (res.status === 201) {
          this.isFollowing.set(true);
          this.profile.update(p => p ? { ...p, followerCount: p.followerCount + 1 } : p);
          this.toast.success(`Ahora sigues a ${this.profile()!.displayName}`);
        } else {
          this.isFollowing.set(false);
          this.profile.update(p => p ? { ...p, followerCount: p.followerCount - 1 } : p);
          this.toast.success(`Dejaste de seguir a ${this.profile()!.displayName}`);
        }
        this.isFollowLoading.set(false);
      },
      error: () => {
        this.isFollowLoading.set(false);
        this.toast.error('No se pudo procesar la solicitud');
      },
    });
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly resolveUrl = resolveFileUrl;

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' });
  }
  formatShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  formatSize(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }
  splitTeacherList(value?: string): string[] {
    return (value ?? '')
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
}

