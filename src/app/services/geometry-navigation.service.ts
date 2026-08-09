import { Injectable, signal } from '@angular/core';

import type { Bounds } from '../shared/helpers/map-helpers';

@Injectable({ providedIn: 'root' })
export class GeometryNavigationService {
  readonly maskInputBounds = signal<Bounds | undefined>(undefined);

  setMaskInputBounds(bounds: Bounds): void {
    this.maskInputBounds.set(bounds);
  }
}
