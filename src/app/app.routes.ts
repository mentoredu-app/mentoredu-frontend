import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { MainLayout } from './layouts/main-layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: '',
        loadChildren: () => import('./pages/auth/auth.routes').then(m => m.AUTH_ROUTES),
      },
    ],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'library', pathMatch: 'full' },
      { path: 'library', loadChildren: () => import('./pages/library/library.routes').then(m => m.LIBRARY_ROUTES) },
      { path: 'forum', loadChildren: () => import('./pages/forum/forum.routes').then(m => m.FORUM_ROUTES) },
      { path: 'profiles', loadChildren: () => import('./pages/profiles/profiles.routes').then(m => m.PROFILES_ROUTES) },
      { path: 'pedagogy', loadChildren: () => import('./pages/pedagogy/pedagogy.routes').then(m => m.PEDAGOGY_ROUTES) },
      { path: 'notifications', loadChildren: () => import('./pages/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES) },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
