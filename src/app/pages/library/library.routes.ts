import { Routes } from '@angular/router';
import { ResourceList } from './resource-list/resource-list';
import { ResourceUpload } from './resource-upload/resource-upload';
import { ResourceDetail } from './resource-detail/resource-detail';
import { MyResources } from './my-resources/my-resources';
import { ResourceSolutions } from './resource-solutions/resource-solutions';
import { roleGuard } from '../../core/guards/role.guard';

export const LIBRARY_ROUTES: Routes = [
  { path: '', component: ResourceList },
  { path: 'upload', component: ResourceUpload },
  {
    path: 'my-resources',
    component: MyResources,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
  {
    path: ':id/solutions',
    component: ResourceSolutions,
    canActivate: [roleGuard],
    data: { roles: ['TEACHER', 'ACADEMY', 'ADMIN'] },
  },
  { path: ':id', component: ResourceDetail },
];
