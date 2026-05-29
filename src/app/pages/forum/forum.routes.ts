import { Routes } from '@angular/router';
import { ThreadDetail } from './thread-detail/thread-detail';
import { ThreadList } from './thread-list/thread-list';

export const FORUM_ROUTES: Routes = [
  { path: '', component: ThreadList },
  { path: ':id', component: ThreadDetail },
];
