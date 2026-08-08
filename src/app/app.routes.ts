import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'bbox',
    loadComponent: () => import('./pages/bbox/bbox').then((component) => component.Bbox),
    title: 'BBox · GeoTools'
  },
  {
    path: 'mask',
    loadComponent: () => import('./pages/mask/mask').then((component) => component.Mask),
    title: 'GeoJSON Mask · GeoTools'
  },
  { path: '', pathMatch: 'full', redirectTo: 'bbox' },
  { path: '**', redirectTo: 'bbox' }
];
