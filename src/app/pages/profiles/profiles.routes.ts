import { Routes } from '@angular/router';
import { ProfileEdit } from './profile-edit/profile-edit';
import { ProfileView } from './profile-view/profile-view';
import { ProfileActivity } from './profile-activity/profile-activity';

export const PROFILES_ROUTES: Routes = [
  { path: 'edit', component: ProfileEdit },
  { path: ':id/resources', component: ProfileActivity, data: { kind: 'resources' } },
  { path: ':id/threads', component: ProfileActivity, data: { kind: 'threads' } },
  { path: ':id', component: ProfileView },
];
