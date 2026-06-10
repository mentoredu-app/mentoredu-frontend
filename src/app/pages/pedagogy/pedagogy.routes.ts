import { Routes } from '@angular/router';
import { SolutionReview } from './solution-review/solution-review';
import { SolutionSubmit } from './solution-submit/solution-submit';
import { MySolution } from './my-solution/my-solution';
import { roleGuard } from '../../core/guards/role.guard';

export const PEDAGOGY_ROUTES: Routes = [
  { path: ':resourceId/submit', component: SolutionSubmit },
  { path: ':resourceId/my-solution', component: MySolution },
  {
    path: ':resourceId/review/:solutionId',
    component: SolutionReview,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
];
