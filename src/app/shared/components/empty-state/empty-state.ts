import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  imports: [],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyState {
  @Input() message = 'No hay datos disponibles';
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Output() action = new EventEmitter<void>();
}
