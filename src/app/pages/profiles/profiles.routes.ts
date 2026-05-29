import { Routes } from '@angular/router';
import { ProfileEdit } from './profile-edit/profile-edit';
import { ProfileView } from './profile-view/profile-view';

export const PROFILES_ROUTES: Routes = [
  { path: 'edit', component: ProfileEdit },
  { path: ':id', component: ProfileView },
];
