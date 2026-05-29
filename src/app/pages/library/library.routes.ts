import { Routes } from '@angular/router';
import { ResourceList } from './resource-list/resource-list';
import { ResourceUpload } from './resource-upload/resource-upload';

export const LIBRARY_ROUTES: Routes = [
  { path: '', component: ResourceList },
  { path: 'upload', component: ResourceUpload },
];
