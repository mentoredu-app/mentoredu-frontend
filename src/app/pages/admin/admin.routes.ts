import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { CatalogAdmin } from './catalog-admin/catalog-admin';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'catalog',
    component: CatalogAdmin,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },
  },
];
