import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { LibraryService } from '../../../services/library.service';
import { ForumService } from '../../../services/forum.service';
import { PedagogyService } from '../../../services/pedagogy.service';
import { CommunityService } from '../../../services/community.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ProfileResponse, StudentProfileResponse } from '../../../models/profile.model';
import { ResourceResponse, RESOURCE_TYPE_LABELS } from '../../../models/resource.model';
import { ThreadResponse } from '../../../models/forum.model';
import { MySolutionSummaryResponse, ReceivedSolutionResponse } from '../../../models/pedagogy.model';
import { AssociationStatus } from '../../../models/association.model';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

type ProfileTab = 'resources' | 'threads' | 'solutions' | 'received';

@Component({
  selector: 'app-profile-view',
  imports: [LoadingSpinner, EmptyState, RouterLink],
  templateUrl: './profile-view.html',
  styleUrl: './profile-view.css',
})
export class ProfileView implements OnInit {
  private route            = inject(ActivatedRoute);
  private profileService   = inject(ProfileService);
  private libraryService   = inject(LibraryService);
  private forumService     = inject(ForumService);
  private pedagogyService  = inject(PedagogyService);
  private communityService = inject(CommunityService);
  private authState        = inject(AuthStateService);
  private toast            = inject(ToastService);

  // ── Profile ──────────────────────────────────────
  readonly isLoading    = signal(true);
  readonly profile      = signal<ProfileResponse | null>(null);
  readonly studentExtra = signal<StudentProfileResponse | null>(null);
  readonly notFound     = signal(false);
  readonly isFollowing        = signal(false);
  readonly isFollowLoading    = signal(false);
  readonly associationStatus  = signal<AssociationStatus | 'NONE' | 'LOADING'>('NONE');
  readonly isAssocLoading     = signal(false);

  // ── Tabs ─────────────────────────────────────────
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

  // ── Activity data ────────────────────────────────
  readonly tabResources  = signal<ResourceResponse[]>([]);
  readonly tabThreads    = signal<ThreadResponse[]>([]);
  readonly tabSolutions  = signal<MySolutionSummaryResponse[]>([]);
  readonly tabReceived   = signal<ReceivedSolutionResponse[]>([]);
  readonly isLoadingTab  = signal(false);
  readonly hasMore       = signal(false);
  private pages: Record<ProfileTab, number> = { resources: 0, threads: 0, solutions: 0, received: 0 };

  // ── Computed ─────────────────────────────────────
  readonly isOwnProfile = computed(() => {
    const user = this.authState.user();
    const p    = this.profile();
    return user && p ? user.id === p.userId : false;
  });

  readonly typeLabels = RESOURCE_TYPE_LABELS;

  readonly roleLabels: Record<string, string> = {
    STUDENT: 'Estudiante', TEACHER: 'Docente', ACADEMY: 'Academia',
    MODERATOR: 'Moderador', ADMIN: 'Administrador',
  };

  readonly gradeLevelLabels: Record<string, string> = {
    '1ro': '1° de secundaria', '2do': '2° de secundaria', '3ro': '3° de secundaria',
    '4to': '4° de secundaria', '5to': '5° de secundaria',
  };

  readonly statusLabels: Record<string, string> = {
    SUBMITTED: 'Enviada', REVIEWED: 'Revisada',
  };

  // ── Lifecycle ────────────────────────────────────
  ngOnInit(): void {
    const userId   = this.route.snapshot.paramMap.get('id') ?? '';
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as ProfileTab | null;

    this.profileService.getById(userId).subscribe({
      next: p => {
        this.profile.set(p);
        this.isFollowing.set(p.isFollowing);
        this.isLoading.set(false);

        if (p.profileType === 'STUDENT' && p.hasStudentProfile) {
          this.profileService.getStudentProfile(p.userId).subscribe({
            next: s => this.studentExtra.set(s),
            error: () => {},
          });
        }

        const defaultTab = this.resolveDefaultTab(p, tabParam);
        this.activeTab.set(defaultTab);
        this.loadTab(defaultTab, p.userId);
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

  // ── Tab switching ─────────────────────────────────
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

  // ── Association ───────────────────────────────────
  requestAssociation(): void {
    const profileId = this.profile()?.id;
    if (!profileId || this.isAssocLoading()) return;
    this.isAssocLoading.set(true);
    this.communityService.requestAssociation(profileId).subscribe({
      next: () => {
        this.associationStatus.set('PENDING');
        this.isAssocLoading.set(false);
        this.toast.success('Solicitud de asociación enviada');
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

  // ── Follow ────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' });
  }
  formatShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  formatSize(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }
}
