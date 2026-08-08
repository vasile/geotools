import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as mapgl from 'mapbox-gl';

import { MapService } from '../../services/map.service';
import { Bounds, MapHelpers } from '../../shared/helpers/map-helpers';

const SWITZERLAND_BOUNDS: Bounds = [5.9559, 45.8179, 10.4921, 47.8085];
const BOUNDS_SOURCE_ID = 'bbox-polygon';
const BOUNDS_FILL_LAYER_ID = 'bbox-fill';
const BOUNDS_OUTLINE_LAYER_ID = 'bbox-outline';

@Component({
  selector: 'app-bbox',
  imports: [FormsModule],
  templateUrl: './bbox.html',
  styleUrl: './bbox.scss'
})
export class Bbox implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private map?: mapgl.Map;
  private currentBounds = SWITZERLAND_BOUNDS;

  protected bboxValue = SWITZERLAND_BOUNDS.join(',');
  protected errorMessage = '';

  constructor(private readonly mapService: MapService) {}

  async ngAfterViewInit(): Promise<void> {
    this.map = await this.mapService.init(this.mapContainer, {
      bounds: [
        [SWITZERLAND_BOUNDS[0], SWITZERLAND_BOUNDS[1]],
        [SWITZERLAND_BOUNDS[2], SWITZERLAND_BOUNDS[3]]
      ]
    });

    this.addBoundsLayers();
    this.drawBounds(this.currentBounds, false);
  }

  protected applyBounds(fitMap = true): void {
    const bounds = this.parseBounds(this.bboxValue);

    if (!bounds) {
      return;
    }

    this.currentBounds = bounds;
    this.errorMessage = '';
    this.drawBounds(bounds);

    if (fitMap) {
      this.mapService.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]]
        ],
        { padding: 48, duration: 600 }
      );
    }
  }
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  private parseBounds(value: string): Bounds | undefined {
    const parts = value.split(',').map((part) => Number(part.trim()));

    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      this.errorMessage = 'Enter four numeric coordinates separated by commas.';
      return undefined;
    }

    const [west, south, east, north] = parts;

    if (west < -180 || east > 180 || south < -90 || north > 90) {
      this.errorMessage = 'Longitude must be between −180 and 180; latitude between −90 and 90.';
      return undefined;
    }

    if (west >= east || south >= north) {
      this.errorMessage = 'Southwest coordinates must be smaller than northeast coordinates.';
      return undefined;
    }

    return [west, south, east, north];
  }

  private drawBounds([west, south, east, north]: Bounds, animate: boolean): void {
    const data = MapHelpers.boundsToPolygonFeatureCollection([west, south, east, north]);

    if (!this.mapService.updateGeoJSONSource(BOUNDS_SOURCE_ID, data)) {
      return;
    }

    this.mapService.fitBounds([west, south, east, north], {
      padding: 48,
      duration: animate ? 600 : 0
    });
  }

  private addBoundsLayers(): void {
    this.map?.addSource(BOUNDS_SOURCE_ID, {
      type: 'geojson',
      data: MapHelpers.boundsToPolygonFeatureCollection(this.currentBounds)
    });
    this.map?.addLayer({
      id: BOUNDS_FILL_LAYER_ID,
      type: 'fill',
      source: BOUNDS_SOURCE_ID,
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.18
      }
    });
    this.map?.addLayer({
      id: BOUNDS_OUTLINE_LAYER_ID,
      type: 'line',
      source: BOUNDS_SOURCE_ID,
      paint: {
        'line-color': '#1d4ed8',
        'line-width': 3
      }
    });
  }
}
