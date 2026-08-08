import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  OnDestroy,
  signal,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as mapgl from 'mapbox-gl';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

import { MapService } from '../../services/map.service';
import { MapHelpers } from '../../shared/helpers/map-helpers';
import type { Bounds } from '../../shared/helpers/map-helpers';

type OutputFormat = 'geojson' | 'wkt' | 'kml' | 'bbox' | 'postgis' | 'csv' | 'gml';

const DEFAULT_BOUNDS: Bounds = [5.9559, 45.8179, 10.4921, 47.8085];
const BOUNDS_SOURCE_ID = 'bbox-polygon';
const BOUNDS_FILL_LAYER_ID = 'bbox-fill';
const BOUNDS_OUTLINE_LAYER_ID = 'bbox-outline';

@Component({
  selector: 'app-bbox',
  imports: [FormsModule],
  templateUrl: './bbox.html',
  styleUrl: './bbox.scss'
})
export class Bbox implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private map?: mapgl.Map;
  private currentBounds = DEFAULT_BOUNDS;
  private readonly bboxChanges = new Subject<string>();
  private copyStatusTimer?: ReturnType<typeof setTimeout>;

  protected bboxValue = DEFAULT_BOUNDS.join(',');
  protected errorMessage = '';
  protected outputFormat: OutputFormat = 'geojson';
  protected readonly copyStatus = signal('');

  protected get outputValue(): string {
    switch (this.outputFormat) {
      case 'wkt':
        return MapHelpers.boundsToWkt(this.currentBounds);
      case 'kml':
        return MapHelpers.boundsToKml(this.currentBounds);
      case 'bbox':
        return MapHelpers.boundsToJson(this.currentBounds);
      case 'postgis':
        return MapHelpers.boundsToPostgis(this.currentBounds);
      case 'csv':
        return MapHelpers.boundsToCsv(this.currentBounds);
      case 'gml':
        return MapHelpers.boundsToGml(this.currentBounds);
      default:
        return JSON.stringify(
          MapHelpers.boundsToPolygonFeatureCollection(this.currentBounds),
          null,
          2
        );
    }
  }

  constructor(
    private readonly mapService: MapService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    destroyRef: DestroyRef
  ) {
    const routeBounds = this.route.snapshot.queryParamMap.get('bounds');

    if (routeBounds) {
      this.bboxValue = routeBounds;
      const parsedBounds = this.parseBounds(routeBounds);

      if (parsedBounds) {
        this.currentBounds = parsedBounds;
        this.errorMessage = '';
      }
    }

    this.bboxChanges
      .pipe(debounceTime(75), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.applyBounds(false));
  }

  ngOnInit(): void {
    this.updateQueryParam(this.currentBounds);
  }

  async ngAfterViewInit(): Promise<void> {
    this.map = await this.mapService.init(this.mapContainer, {
      bounds: [
        [this.currentBounds[0], this.currentBounds[1]],
        [this.currentBounds[2], this.currentBounds[3]]
      ],
      fitBoundsOptions: {
        padding: 48
      }
    });

    this.addBoundsLayers();
    this.drawBounds(this.currentBounds);
  }

  protected applyBounds(fitMap = true): void {
    const bounds = this.parseBounds(this.bboxValue);

    if (!bounds) {
      return;
    }

    this.currentBounds = bounds;
    this.errorMessage = '';
    this.drawBounds(bounds);
    this.updateQueryParam(bounds);

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

  protected bboxValueChanged(value: string): void {
    this.bboxChanges.next(value);
  }

  protected async copyOutput(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.outputValue);
      this.copyStatus.set('Copied');
    } catch {
      this.copyStatus.set('Copy failed');
    }

    clearTimeout(this.copyStatusTimer);
    this.copyStatusTimer = setTimeout(() => this.copyStatus.set(''), 2000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.copyStatusTimer);
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

  private drawBounds(bounds: Bounds): void {
    const data = MapHelpers.boundsToPolygonFeatureCollection(bounds);

    this.mapService.updateGeoJSONSource(BOUNDS_SOURCE_ID, data);
  }

  private updateQueryParam(bounds: Bounds): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bounds: bounds.join(',') },
      queryParamsHandling: 'merge',
      replaceUrl: true
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
