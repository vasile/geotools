import { ElementRef, Injectable } from '@angular/core';
import type { GeoJSON } from 'geojson';
import * as mapgl from 'mapbox-gl';

import { APP_CONFIG } from '../config/app-config';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map?: mapgl.Map;

  async init(
    container: string | HTMLElement | ElementRef<HTMLElement>,
    options: Partial<mapgl.MapOptions> = {}
  ): Promise<mapgl.Map> {
    this.destroy();

    const map = new mapgl.Map({
      accessToken: APP_CONFIG.mapboxKey,
      container: container instanceof ElementRef ? container.nativeElement : container,
      style: 'mapbox://styles/mapbox/light-v11',
      ...options
    });

    map.addControl(new mapgl.NavigationControl({ showCompass: false }), 'top-right');
    this.map = map;

    await new Promise<void>((resolve) => map.once('load', () => resolve()));

    return map;
  }

  updateGeoJSONSource(sourceId: string, data: GeoJSON): boolean {
    const source = this.map?.getSource(sourceId) as mapgl.GeoJSONSource | undefined;

    if (!source) {
      return false;
    }

    source.setData(data);
    return true;
  }

  fitBounds(bounds: mapgl.LngLatBoundsLike, options?: mapgl.FitBoundsOptions): void {
    this.map?.fitBounds(bounds, options);
  }

  getBounds(): mapgl.LngLatBounds | undefined {
    return this.map?.getBounds() ?? undefined;
  }

  destroy(): void {
    this.map?.remove();
    this.map = undefined;
  }
}
