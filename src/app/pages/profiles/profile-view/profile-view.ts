import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProfileService } from '../../../services/profile.service';
import { ProfileResponse } from '../../../models/profile.model';
import { LoadingSpinner } from '../../../shared/components/loading-spinner/loading-spinner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-profile-view',
  imports: [LoadingSpinner, EmptyState],
  templateUrl: './profile-view.html',
  styleUrl: './profile-view.css',
})
export class ProfileView implements OnInit {
  private route = inject(ActivatedRoute);
  private profileService = inject(ProfileService);

  readonly isLoading = signal(true);
  readonly profile = signal<ProfileResponse | null>(null);
  readonly notFound = signal(false);

  readonly roleLabels: Record<string, string> = {
    STUDENT:   'Estudiante',
    TEACHER:   'Docente',
    ACADEMY:   'Academia',
    MODERATOR: 'Moderador',
    ADMIN:     'Administrador',
  };

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id') ?? '';
    this.profileService.getById(userId).subscribe({
      next: p => {
        this.profile.set(p);
        this.isLoading.set(false);
      },
      error: err => {
        this.isLoading.set(false);
        if (err.status === 404) this.notFound.set(true);
      },
    });
  }
}
