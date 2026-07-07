import { Routes } from '@angular/router';
import { SolutionReview } from './solution-review/solution-review';
import { SolutionSubmit } from './solution-submit/solution-submit';
import { MySolution } from './my-solution/my-solution';
import { SolutionInbox } from './solution-inbox/solution-inbox';
import { ResourceSolutions } from '../library/resource-solutions/resource-solutions';
import { roleGuard } from '../../core/guards/role.guard';

export const PEDAGOGY_ROUTES: Routes = [
  {
    path: 'my-solutions',
    component: SolutionInbox,
    canActivate: [roleGuard],
    data: { roles: ['STUDENT'], mode: 'mine' },
  },
  {
    path: 'received',
    component: SolutionInbox,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'], mode: 'received' },
  },
  {
    path: 'received/:resourceId/review/:solutionId',
    component: SolutionReview,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
  {
    path: 'received/:resourceId',
    component: ResourceSolutions,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
  { path: ':resourceId/submit', component: SolutionSubmit },
  { path: ':resourceId/my-solution', component: MySolution },
  {
    path: ':resourceId/review/:solutionId',
    component: SolutionReview,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
];
