import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'bbox',
    loadComponent: () => import('./pages/bbox/bbox').then((component) => component.Bbox),
    title: 'BBox · GeoTools'
  },
  { path: '', pathMatch: 'full', redirectTo: 'bbox' },
  { path: '**', redirectTo: 'bbox' }
];
