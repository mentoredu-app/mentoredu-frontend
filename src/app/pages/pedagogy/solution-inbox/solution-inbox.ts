import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PedagogyService } from '../../../services/pedagogy.service';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { MySolutionSummaryResponse, ReceivedSolutionResponse } from '../../../models/pedagogy.model';

type InboxMode = 'mine' | 'received';
type SortMode = 'date_desc' | 'date_asc' | 'student_asc' | 'resource_asc';

interface ReceivedResourceGroup {
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  latestSubmittedAt: string;
  total: number;
  pending: number;
  reviewed: number;
  students: string[];
  items: ReceivedSolutionResponse[];
}

@Component({
  selector: 'app-solution-inbox',
  imports: [RouterLink, LoadingSpinner, EmptyState],
  templateUrl: './solution-inbox.html',
  styleUrl: './solution-inbox.css',
})
export class SolutionInbox implements OnInit {
  private route = inject(ActivatedRoute);
  private pedagogyService = inject(PedagogyService);

  readonly mode = signal<InboxMode>('mine');
  readonly sortMode = signal<SortMode>('date_desc');
  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly hasMore = signal(false);
  readonly mine = signal<MySolutionSummaryResponse[]>([]);
  readonly received = signal<ReceivedSolutionResponse[]>([]);

  readonly sortedReceived = computed(() => {
    const list = [...this.received()];
    const mode = this.sortMode();
    if (mode === 'resource_asc') {
      return list.sort((a, b) => a.resourceTitle.localeCompare(b.resourceTitle, 'es'));
    }
    if (mode === 'student_asc') {
      return list.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
    }
    if (mode === 'date_asc') {
      return list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  });

  readonly groupedReceived = computed<ReceivedResourceGroup[]>(() => {
    const groups = new Map<string, ReceivedResourceGroup>();

    for (const item of this.sortedReceived()) {
      const current = groups.get(item.resourceId);
      if (!current) {
        groups.set(item.resourceId, {
          resourceId: item.resourceId,
          resourceTitle: item.resourceTitle,
          resourceType: item.resourceType,
          latestSubmittedAt: item.submittedAt,
          total: 1,
          pending: item.status === 'SUBMITTED' ? 1 : 0,
          reviewed: item.status === 'REVIEWED' ? 1 : 0,
          students: [item.studentName],
          items: [item],
        });
        continue;
      }

      current.items.push(item);
      current.total += 1;
      current.pending += item.status === 'SUBMITTED' ? 1 : 0;
      current.reviewed += item.status === 'REVIEWED' ? 1 : 0;
      if (!current.students.includes(item.studentName)) current.students.push(item.studentName);
      if (new Date(item.submittedAt).getTime() > new Date(current.latestSubmittedAt).getTime()) {
        current.latestSubmittedAt = item.submittedAt;
      }
    }

    const result = [...groups.values()];
    const mode = this.sortMode();
    if (mode === 'resource_asc') {
      return result.sort((a, b) => a.resourceTitle.localeCompare(b.resourceTitle, 'es'));
    }
    if (mode === 'student_asc') {
      return result.sort((a, b) => a.students[0].localeCompare(b.students[0], 'es'));
    }
    if (mode === 'date_asc') {
      return result.sort((a, b) => new Date(a.latestSubmittedAt).getTime() - new Date(b.latestSubmittedAt).getTime());
    }
    return result.sort((a, b) => new Date(b.latestSubmittedAt).getTime() - new Date(a.latestSubmittedAt).getTime());
  });

  readonly sortedMine = computed(() => {
    const list = [...this.mine()];
    const mode = this.sortMode();
    if (mode === 'date_asc') {
      return list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  });

  private page = 0;

  ngOnInit(): void {
    this.mode.set((this.route.snapshot.data['mode'] as InboxMode | undefined) ?? 'mine');
    this.loadPage(0);
  }

  setSortMode(mode: SortMode): void {
    this.sortMode.set(mode);
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingMore()) return;
    this.loadPage(this.page + 1);
  }

  private loadPage(page: number): void {
    const loadingSignal = page === 0 ? this.isLoading : this.isLoadingMore;
    loadingSignal.set(true);
    this.page = page;

    if (this.mode() === 'received') {
      this.pedagogyService.getReceivedSolutions(page, 12).subscribe({
        next: response => {
          this.received.update(current => page === 0 ? response.content : [...current, ...response.content]);
          this.hasMore.set(!response.last);
          loadingSignal.set(false);
        },
        error: err => this.finishWithError(loadingSignal, err?.status),
      });
      return;
    }

    this.pedagogyService.getMySolutions(page, 12).subscribe({
      next: response => {
        this.mine.update(current => page === 0 ? response.content : [...current, ...response.content]);
        this.hasMore.set(!response.last);
        loadingSignal.set(false);
      },
      error: err => this.finishWithError(loadingSignal, err?.status),
    });
  }

  private finishWithError(loadingSignal: { set(value: boolean): void }, status?: number): void {
    if (status === 403) {
      this.error.set(
        this.mode() === 'received'
          ? 'Solo docentes, academias y administradores pueden ver resoluciones recibidas.'
          : 'Solo estudiantes pueden ver sus resoluciones enviadas.'
      );
    } else {
      this.error.set('No se pudieron cargar las resoluciones. Intenta de nuevo.');
    }
    loadingSignal.set(false);
  }

  formatShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  statusLabel(status: string): string {
    return status === 'REVIEWED' ? 'Revisada' : 'Enviada';
  }

  studentSummary(group: ReceivedResourceGroup): string {
    const names = group.students.slice(0, 3).join(', ');
    const remaining = group.students.length - 3;
    return remaining > 0 ? `${names} y ${remaining} mas` : names;
  }
}
