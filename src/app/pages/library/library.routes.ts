import { Routes } from '@angular/router';
import { ResourceList } from './resource-list/resource-list';
import { ResourceUpload } from './resource-upload/resource-upload';
import { ResourceDetail } from './resource-detail/resource-detail';

export const LIBRARY_ROUTES: Routes = [
  { path: '', component: ResourceList },
  { path: 'upload', component: ResourceUpload },
  { path: ':id', component: ResourceDetail },
];
