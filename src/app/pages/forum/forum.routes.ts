import { Routes } from '@angular/router';
import { ThreadList } from './thread-list/thread-list';
import { ThreadDetail } from './thread-detail/thread-detail';
import { ThreadCreate } from './thread-create/thread-create';

export const FORUM_ROUTES: Routes = [
  { path: '',       component: ThreadList },
  { path: 'create', component: ThreadCreate },
  { path: ':id',    component: ThreadDetail },
];
