import { Component, Input, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ModerationService } from '../../../services/moderation.service';
import { ToastService } from '../toast/toast.service';
import { ReportTargetType, REPORT_TARGET_LABELS } from '../../../models/moderation.model';

@Component({
  selector: 'app-report-button',
  imports: [FormsModule],
  templateUrl: './report-button.html',
  styleUrl: './report-button.css',
})
export class ReportButton {
  @Input({ required: true }) targetType!: ReportTargetType;
  @Input({ required: true }) targetId!: string;

  private moderationService = inject(ModerationService);
  private toast             = inject(ToastService);

  readonly isOpen       = signal(false);
  readonly isSubmitting = signal(false);
  readonly alreadySent  = signal(false);
  reason = '';

  readonly targetLabels = REPORT_TARGET_LABELS;

  get targetLabel(): string {
    return this.targetLabels[this.targetType] ?? this.targetType;
  }

  toggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.alreadySent()) return;
    this.isOpen.update(v => !v);
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.isOpen.set(false);
    this.reason = '';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen()) this.close();
  }

  submit(event: Event): void {
    event.stopPropagation();
    const trimmed = this.reason.trim();
    if (!trimmed || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.moderationService.report({
      targetType: this.targetType,
      targetId:   this.targetId,
      reason:     trimmed,
    }).subscribe({
      next: () => {
        this.toast.success('Contenido reportado. Lo revisaremos pronto.');
        this.alreadySent.set(true);
        this.isOpen.set(false);
        this.reason = '';
        this.isSubmitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 400) {
          this.toast.error(err.error?.message ?? 'Tipo de contenido no válido');
        } else {
          this.toast.error('No se pudo enviar el reporte. Intenta de nuevo.');
        }
      },
    });
  }

  @HostListener('click', ['$event'])
  onHostClick(e: Event): void { e.stopPropagation(); }
}
