import {
  AfterViewInit,
  ChangeDetectorRef,
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
import type { Bounds, BoundsCorner } from '../../shared/helpers/map-helpers';

type OutputFormat =
  | 'geojson'
  | 'wkt'
  | 'kml'
  | 'bbox'
  | 'postgis'
  | 'csv'
  | 'gml'
  | 'ojp-rectangle';

const OUTPUT_FORMATS: OutputFormat[] = [
  'geojson',
  'wkt',
  'kml',
  'bbox',
  'postgis',
  'csv',
  'gml',
  'ojp-rectangle'
];

function isOutputFormat(value: string | null): value is OutputFormat {
  return value !== null && OUTPUT_FORMATS.includes(value as OutputFormat);
}

const DEFAULT_BOUNDS: Bounds = [5.9559, 45.8179, 10.4921, 47.8085];
const BOUNDS_SOURCE_ID = 'bbox-polygon';
const BOUNDS_HANDLES_SOURCE_ID = 'bbox-handles';
const BOUNDS_FILL_LAYER_ID = 'bbox-fill';
const BOUNDS_OUTLINE_LAYER_ID = 'bbox-outline';
const BOUNDS_HANDLES_LAYER_ID = 'bbox-handles';
const MIN_BOUNDS_SPAN = 0.000001;

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
  private readonly draggedBoundsChanges = new Subject<Bounds>();
  private copyStatusTimer?: ReturnType<typeof setTimeout>;
  private activeCorner?: BoundsCorner;

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
      case 'ojp-rectangle':
        return MapHelpers.boundsToOjpRectangle(this.currentBounds);
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
    private readonly changeDetectorRef: ChangeDetectorRef,
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

    const routeFormat = this.route.snapshot.queryParamMap.get('format');

    if (isOutputFormat(routeFormat)) {
      this.outputFormat = routeFormat;
    }

    this.bboxChanges
      .pipe(debounceTime(75), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.applyBounds(false));
    this.draggedBoundsChanges
      .pipe(debounceTime(75), takeUntilDestroyed(destroyRef))
      .subscribe((bounds) => this.updateQueryParams(bounds));
  }

  ngOnInit(): void {
    this.updateQueryParams(this.currentBounds);
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
    this.updateQueryParams(bounds);

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

  protected useMapViewport(): void {
    const mapBounds = this.mapService.getBounds();

    if (!mapBounds) {
      return;
    }

    const southwest = mapBounds.getSouthWest();
    const northeast = mapBounds.getNorthEast();
    const bounds: Bounds = [
      this.roundCoordinate(southwest.lng),
      this.roundCoordinate(southwest.lat),
      this.roundCoordinate(northeast.lng),
      this.roundCoordinate(northeast.lat)
    ];

    this.bboxValue = bounds.join(',');
    this.currentBounds = bounds;
    this.errorMessage = '';
    this.drawBounds(bounds);
    this.updateQueryParams(bounds);
  }

  protected outputFormatChanged(format: OutputFormat): void {
    this.outputFormat = format;
    this.updateQueryParams(this.currentBounds);
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
    this.endHandleDrag();
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

  private roundCoordinate(value: number): number {
    return Number(value.toFixed(6));
  }

  private drawBounds(bounds: Bounds): void {
    this.mapService.updateGeoJSONSource(
      BOUNDS_SOURCE_ID,
      MapHelpers.boundsToPolygonFeatureCollection(bounds)
    );
    this.mapService.updateGeoJSONSource(
      BOUNDS_HANDLES_SOURCE_ID,
      MapHelpers.boundsToHandleFeatureCollection(bounds)
    );
  }

  private updateQueryParams(bounds: Bounds): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        bounds: bounds.join(','),
        format: this.outputFormat === 'geojson' ? null : this.outputFormat
      },
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
    this.map?.addSource(BOUNDS_HANDLES_SOURCE_ID, {
      type: 'geojson',
      data: MapHelpers.boundsToHandleFeatureCollection(this.currentBounds)
    });
    this.map?.addLayer({
      id: BOUNDS_HANDLES_LAYER_ID,
      type: 'circle',
      source: BOUNDS_HANDLES_SOURCE_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': '#2563eb',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });

    this.map?.on('mouseenter', BOUNDS_HANDLES_LAYER_ID, () => {
      if (this.map) {
        this.map.getCanvas().style.cursor = 'grab';
      }
    });
    this.map?.on('mouseleave', BOUNDS_HANDLES_LAYER_ID, () => {
      if (this.map && !this.activeCorner) {
        this.map.getCanvas().style.cursor = '';
      }
    });
    this.map?.on('mousedown', BOUNDS_HANDLES_LAYER_ID, (event) => {
      const corner = event.features?.[0]?.properties?.['corner'];

      if (!isBoundsCorner(corner)) {
        return;
      }

      event.preventDefault();
      this.activeCorner = corner;
      this.map?.dragPan.disable();
      this.map?.getCanvas().style.setProperty('cursor', 'grabbing');
      this.map?.on('mousemove', this.handleDrag);
      this.map?.once('mouseup', this.endHandleDrag);
    });
  }

  private readonly handleDrag = (event: mapgl.MapMouseEvent): void => {
    if (!this.activeCorner) {
      return;
    }

    const [west, south, east, north] = this.currentBounds;
    const longitude = this.roundCoordinate(event.lngLat.lng);
    const latitude = this.roundCoordinate(event.lngLat.lat);
    let bounds: Bounds;

    switch (this.activeCorner) {
      case 'sw':
        bounds = [
          Math.min(longitude, east - MIN_BOUNDS_SPAN),
          Math.min(latitude, north - MIN_BOUNDS_SPAN),
          east,
          north
        ];
        break;
      case 'se':
        bounds = [
          west,
          Math.min(latitude, north - MIN_BOUNDS_SPAN),
          Math.max(longitude, west + MIN_BOUNDS_SPAN),
          north
        ];
        break;
      case 'ne':
        bounds = [
          west,
          south,
          Math.max(longitude, west + MIN_BOUNDS_SPAN),
          Math.max(latitude, south + MIN_BOUNDS_SPAN)
        ];
        break;
      case 'nw':
        bounds = [
          Math.min(longitude, east - MIN_BOUNDS_SPAN),
          south,
          east,
          Math.max(latitude, south + MIN_BOUNDS_SPAN)
        ];
        break;
    }

    this.currentBounds = bounds;
    this.bboxValue = bounds.join(',');
    this.errorMessage = '';
    this.drawBounds(bounds);
    this.draggedBoundsChanges.next(bounds);
    this.changeDetectorRef.markForCheck();
  };

  private readonly endHandleDrag = (): void => {
    if (this.activeCorner) {
      this.updateQueryParams(this.currentBounds);
    }

    this.map?.off('mousemove', this.handleDrag);
    this.map?.dragPan.enable();

    if (this.map) {
      this.map.getCanvas().style.cursor = '';
    }

    this.activeCorner = undefined;
  };
}

function isBoundsCorner(value: unknown): value is BoundsCorner {
  return value === 'sw' || value === 'se' || value === 'ne' || value === 'nw';
}
