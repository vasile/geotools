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
import type { FeatureCollection, Polygon } from 'geojson';
import * as mapgl from 'mapbox-gl';
import { debounceTime, Subject } from 'rxjs';

import { MapService } from '../../services/map.service';
import { MapHelpers } from '../../shared/helpers/map-helpers';
import type {
  Bounds,
  BoundsCorner,
  CircleHandle,
  CenterCoordinate
} from '../../shared/helpers/map-helpers';

type RectangleMode = 'bounds' | 'center' | 'circle';
type MapHandle = BoundsCorner | CircleHandle;

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
const DEFAULT_CENTER_SIZE = MapHelpers.boundsToCenterSize(DEFAULT_BOUNDS);
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
  private currentPolygon: FeatureCollection<Polygon> =
    MapHelpers.boundsToPolygonFeatureCollection(DEFAULT_BOUNDS);
  private readonly rectangleChanges = new Subject<void>();
  private readonly draggedBoundsChanges = new Subject<Bounds>();
  private copyStatusTimer?: ReturnType<typeof setTimeout>;
  private activeHandle?: MapHandle;

  protected rectangleMode: RectangleMode = 'bounds';
  protected bboxValue = DEFAULT_BOUNDS.join(',');
  protected centerValue = DEFAULT_CENTER_SIZE.center.join(',');
  protected widthValue = this.roundDistance(DEFAULT_CENTER_SIZE.widthMeters);
  protected heightValue = this.roundDistance(DEFAULT_CENTER_SIZE.heightMeters);
  protected radiusValue = this.roundDistance(
    Math.min(DEFAULT_CENTER_SIZE.widthMeters, DEFAULT_CENTER_SIZE.heightMeters) / 2
  );
  protected errorMessage = '';
  protected outputFormat: OutputFormat = 'geojson';
  protected readonly copyStatus = signal('');

  protected get outputDescription(): string {
    return this.rectangleMode === 'circle'
      ? 'Circle geometry, or its enclosing bounds for rectangle-only formats.'
      : 'Formatted polygon for the current bounding box.';
  }

  protected get outputValue(): string {
    if (this.rectangleMode === 'circle') {
      switch (this.outputFormat) {
        case 'wkt':
          return MapHelpers.polygonFeatureCollectionToWkt(this.currentPolygon);
        case 'kml':
          return MapHelpers.polygonFeatureCollectionToKml(this.currentPolygon);
        case 'gml':
          return MapHelpers.polygonFeatureCollectionToGml(this.currentPolygon);
        case 'ojp-rectangle':
          return MapHelpers.centerRadiusToOjpCircle(
            this.parseCenter(this.centerValue)!,
            this.radiusValue
          );
        case 'geojson':
          return JSON.stringify(this.currentPolygon, null, 2);
      }
    }

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
    const routeMode = this.route.snapshot.queryParamMap.get('mode');
    const routeBounds = this.route.snapshot.queryParamMap.get('bounds');

    if (routeMode === 'circle') {
      const center = this.parseCenter(this.route.snapshot.queryParamMap.get('coords') ?? '');
      const radius = this.parseDimension(this.route.snapshot.queryParamMap.get('r'));

      if (center && radius) {
        this.rectangleMode = 'circle';
        this.centerValue = center.join(',');
        this.radiusValue = radius;
        this.setCircleGeometry(center, radius);
        this.errorMessage = '';
      }
    } else if (routeMode === 'center') {
      const center = this.parseCenter(this.route.snapshot.queryParamMap.get('coords') ?? '');
      const width = this.parseDimension(this.route.snapshot.queryParamMap.get('w'));
      const height = this.parseDimension(this.route.snapshot.queryParamMap.get('h'));
      const bounds = center && width && height
        ? MapHelpers.centerSizeToBounds(center, width, height)
        : undefined;

      if (center && width && height && bounds) {
        this.rectangleMode = 'center';
        this.centerValue = center.join(',');
        this.widthValue = width;
        this.heightValue = height;
        this.currentBounds = this.roundBounds(bounds);
        this.bboxValue = this.currentBounds.join(',');
        this.errorMessage = '';
      }
    }

    if (this.rectangleMode === 'bounds' && routeBounds) {
      this.bboxValue = routeBounds;
      const parsedBounds = this.parseBounds(routeBounds);

      if (parsedBounds) {
        this.currentBounds = parsedBounds;
        this.errorMessage = '';
      }
    }

    if (this.rectangleMode !== 'circle') {
      this.currentPolygon = MapHelpers.boundsToPolygonFeatureCollection(this.currentBounds);
    }

    const routeFormat = this.route.snapshot.queryParamMap.get('format');

    if (isOutputFormat(routeFormat)) {
      this.outputFormat = routeFormat;
    }

    this.rectangleChanges
      .pipe(debounceTime(75), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.applyRectangle(false));
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

  protected applyRectangle(fitMap = true): void {
    if (this.rectangleMode === 'circle') {
      this.applyCircle(fitMap);
      return;
    }

    if (this.rectangleMode === 'center') {
      this.applyCenterSize(fitMap);
      return;
    }

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

  protected rectangleValueChanged(): void {
    this.rectangleChanges.next();
  }

  protected rectangleModeChanged(mode: RectangleMode): void {
    this.rectangleMode = mode;
    this.syncInputsFromBounds(this.currentBounds);

    if (mode === 'circle') {
      const center = this.parseCenter(this.centerValue);

      if (center) {
        this.setCircleGeometry(center, this.radiusValue);
        this.drawBounds(this.currentBounds);
      }
    } else {
      this.currentPolygon = MapHelpers.boundsToPolygonFeatureCollection(this.currentBounds);
      this.drawBounds(this.currentBounds);
    }

    this.errorMessage = '';
    this.updateQueryParams(this.currentBounds);
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

    if (this.rectangleMode === 'circle') {
      const center: CenterCoordinate = [
        this.roundCoordinate((bounds[0] + bounds[2]) / 2),
        this.roundCoordinate((bounds[1] + bounds[3]) / 2)
      ];
      const radius = new mapgl.LngLat(center[0], center[1]).distanceTo(
        new mapgl.LngLat(bounds[2], bounds[3])
      );
      this.centerValue = center.join(',');
      this.radiusValue = this.roundDistance(radius);
      this.setCircleGeometry(center, this.radiusValue);
      this.errorMessage = '';
      this.drawBounds(this.currentBounds);
      this.updateQueryParams(this.currentBounds);
      return;
    }

    this.currentBounds = bounds;
    this.syncInputsFromBounds(bounds);
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

  private applyCircle(fitMap: boolean): void {
    const center = this.parseCenter(this.centerValue);
    const radius = this.parseDimension(this.radiusValue);

    if (!center || !radius) {
      if (center && !radius) {
        this.errorMessage = 'Radius must be greater than 0 metres.';
      }
      return;
    }

    this.centerValue = center.join(',');
    this.radiusValue = radius;
    this.setCircleGeometry(center, radius);
    this.errorMessage = '';
    this.drawBounds(this.currentBounds);
    this.updateQueryParams(this.currentBounds);

    if (fitMap) {
      this.fitBounds(this.currentBounds);
    }
  }

  private setCircleGeometry(center: CenterCoordinate, radiusMeters: number): void {
    this.currentPolygon = MapHelpers.centerRadiusToPolygonFeatureCollection(
      center,
      radiusMeters
    );
    this.currentBounds = this.roundBounds(
      MapHelpers.polygonFeatureCollectionToBounds(this.currentPolygon)
    );
    this.bboxValue = this.currentBounds.join(',');
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

  private parseCenter(value: string): CenterCoordinate | undefined {
    const parts = value.split(',').map((part) => Number(part.trim()));

    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
      this.errorMessage = 'Enter a longitude and latitude separated by a comma.';
      return undefined;
    }

    const [longitude, latitude] = parts;

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      this.errorMessage = 'Longitude must be between −180 and 180; latitude between −90 and 90.';
      return undefined;
    }

    return [longitude, latitude];
  }

  private parseDimension(value: unknown): number | undefined {
    const dimension = Math.round(Number(value));
    return Number.isFinite(dimension) && dimension >= 1 ? dimension : undefined;
  }

  private applyCenterSize(fitMap: boolean): void {
    const center = this.parseCenter(this.centerValue);
    const width = this.parseDimension(this.widthValue);
    const height = this.parseDimension(this.heightValue);

    if (!center || !width || !height) {
      if (center && (!width || !height)) {
        this.errorMessage = 'Width and height must be greater than 0 metres.';
      }
      return;
    }

    const bounds = MapHelpers.centerSizeToBounds(center, width, height);

    if (!bounds) {
      this.errorMessage = 'The rectangle extends beyond the supported longitude or latitude range.';
      return;
    }

    this.centerValue = center.join(',');
    this.widthValue = width;
    this.heightValue = height;
    this.currentBounds = this.roundBounds(bounds);
    this.bboxValue = this.currentBounds.join(',');
    this.errorMessage = '';
    this.drawBounds(this.currentBounds);
    this.updateQueryParams(this.currentBounds);

    if (fitMap) {
      this.fitBounds(this.currentBounds);
    }
  }

  private roundCoordinate(value: number): number {
    return Number(value.toFixed(6));
  }

  private roundDistance(value: number): number {
    return Math.round(value);
  }

  private roundBounds(bounds: Bounds): Bounds {
    return bounds.map((coordinate) => this.roundCoordinate(coordinate)) as Bounds;
  }

  private syncInputsFromBounds(bounds: Bounds): void {
    this.bboxValue = bounds.join(',');
    const centerSize = MapHelpers.boundsToCenterSize(bounds);
    this.centerValue = centerSize.center.map((coordinate) => this.roundCoordinate(coordinate)).join(',');
    this.widthValue = this.roundDistance(centerSize.widthMeters);
    this.heightValue = this.roundDistance(centerSize.heightMeters);
    this.radiusValue = this.roundDistance(
      Math.min(centerSize.widthMeters, centerSize.heightMeters) / 2
    );
  }

  private fitBounds(bounds: Bounds): void {
    this.mapService.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ],
      { padding: 48, duration: 600 }
    );
  }

  private drawBounds(bounds: Bounds): void {
    if (this.rectangleMode !== 'circle') {
      this.currentPolygon = MapHelpers.boundsToPolygonFeatureCollection(bounds);
    }

    this.mapService.updateGeoJSONSource(BOUNDS_SOURCE_ID, this.currentPolygon);
    this.mapService.updateGeoJSONSource(
      BOUNDS_HANDLES_SOURCE_ID,
      this.rectangleMode === 'circle'
        ? MapHelpers.circleToHandleFeatureCollection(
            this.parseCenter(this.centerValue)!,
            this.currentPolygon
          )
        : MapHelpers.boundsToHandleFeatureCollection(bounds)
    );
  }

  private updateQueryParams(bounds: Bounds): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mode: this.rectangleMode === 'bounds' ? null : this.rectangleMode,
        bounds: this.rectangleMode === 'bounds' ? bounds.join(',') : null,
        w: this.rectangleMode === 'center' ? this.widthValue : null,
        h: this.rectangleMode === 'center' ? this.heightValue : null,
        coords: this.rectangleMode !== 'bounds' ? this.centerValue : null,
        r: this.rectangleMode === 'circle' ? this.radiusValue : null,
        format: this.outputFormat === 'geojson' ? null : this.outputFormat
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private addBoundsLayers(): void {
    this.map?.addSource(BOUNDS_SOURCE_ID, {
      type: 'geojson',
      data: this.currentPolygon
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
      data:
        this.rectangleMode === 'circle'
          ? MapHelpers.circleToHandleFeatureCollection(
              this.parseCenter(this.centerValue)!,
              this.currentPolygon
            )
          : MapHelpers.boundsToHandleFeatureCollection(this.currentBounds)
    });
    this.map?.addLayer({
      id: BOUNDS_HANDLES_LAYER_ID,
      type: 'circle',
      source: BOUNDS_HANDLES_SOURCE_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': [
          'case',
          ['==', ['get', 'handle'], 'radius'],
          '#f59e0b',
          '#2563eb'
        ],
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
      if (this.map && !this.activeHandle) {
        this.map.getCanvas().style.cursor = '';
      }
    });
    this.map?.on('mousedown', BOUNDS_HANDLES_LAYER_ID, (event) => {
      const properties = event.features?.[0]?.properties;
      const handle = properties?.['handle'] ?? properties?.['corner'];

      if (!isMapHandle(handle)) {
        return;
      }

      event.preventDefault();
      this.activeHandle = handle;
      this.map?.dragPan.disable();
      this.map?.getCanvas().style.setProperty('cursor', 'grabbing');
      this.map?.on('mousemove', this.handleDrag);
      this.map?.once('mouseup', this.endHandleDrag);
    });
  }

  private readonly handleDrag = (event: mapgl.MapMouseEvent): void => {
    if (!this.activeHandle) {
      return;
    }

    if (this.activeHandle === 'center' || this.activeHandle === 'radius') {
      const currentCenter = this.parseCenter(this.centerValue);

      if (!currentCenter) {
        return;
      }

      const center: CenterCoordinate =
        this.activeHandle === 'center'
          ? [this.roundCoordinate(event.lngLat.lng), this.roundCoordinate(event.lngLat.lat)]
          : currentCenter;
      const radius =
        this.activeHandle === 'radius'
          ? this.roundDistance(
              new mapgl.LngLat(center[0], center[1]).distanceTo(event.lngLat)
            )
          : this.radiusValue;

      this.centerValue = center.join(',');
      this.radiusValue = Math.max(radius, 1);
      this.setCircleGeometry(center, this.radiusValue);
      this.errorMessage = '';
      this.drawBounds(this.currentBounds);
      this.draggedBoundsChanges.next(this.currentBounds);
      this.changeDetectorRef.markForCheck();
      return;
    }

    const [west, south, east, north] = this.currentBounds;
    const longitude = this.roundCoordinate(event.lngLat.lng);
    const latitude = this.roundCoordinate(event.lngLat.lat);
    let bounds: Bounds;

    switch (this.activeHandle) {
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
    this.syncInputsFromBounds(bounds);
    this.errorMessage = '';
    this.drawBounds(bounds);
    this.draggedBoundsChanges.next(bounds);
    this.changeDetectorRef.markForCheck();
  };

  private readonly endHandleDrag = (): void => {
    if (this.activeHandle) {
      this.updateQueryParams(this.currentBounds);
    }

    this.map?.off('mousemove', this.handleDrag);
    this.map?.dragPan.enable();

    if (this.map) {
      this.map.getCanvas().style.cursor = '';
    }

    this.activeHandle = undefined;
  };
}

function isBoundsCorner(value: unknown): value is BoundsCorner {
  return value === 'sw' || value === 'se' || value === 'ne' || value === 'nw';
}

function isMapHandle(value: unknown): value is MapHandle {
  return isBoundsCorner(value) || value === 'center' || value === 'radius';
}
