import { Routes } from '@angular/router';

export const AI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./assistant/assistant').then(m => m.Assistant),
  },
];
