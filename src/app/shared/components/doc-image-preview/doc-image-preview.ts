import { Component, computed, input, signal } from '@angular/core';
import { resolveFileUrl } from '../../../services/file-upload.service';

@Component({
  selector: 'app-doc-image-preview',
  templateUrl: './doc-image-preview.html',
  styleUrl: './doc-image-preview.css',
})
export class DocImagePreview {
  readonly fileUrl = input.required<string>();
  readonly label   = input('Documento');

  readonly resolvedUrl = computed(() => resolveFileUrl(this.fileUrl()) ?? '');
  readonly imgLoaded   = signal(false);
  readonly imgError    = signal(false);

  onLoad():  void { this.imgLoaded.set(true); }
  onError(): void { this.imgError.set(true); this.imgLoaded.set(true); }

  openInNewTab(): void {
    window.open(this.resolvedUrl(), '_blank', 'noopener');
  }

  async download(): Promise<void> {
    const url      = this.resolvedUrl();
    const fileName = url.split('/').pop() ?? 'documento';
    try {
      const blob = await fetch(url).then(r => r.blob());
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* silently ignore */ }
  }
}
