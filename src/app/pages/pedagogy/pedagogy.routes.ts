import { Routes } from '@angular/router';
import { SolutionReview } from './solution-review/solution-review';
import { SolutionSubmit } from './solution-submit/solution-submit';

export const PEDAGOGY_ROUTES: Routes = [
  { path: ':resourceId/submit', component: SolutionSubmit },
  { path: ':resourceId/review', component: SolutionReview },
];
