import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  signal,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import bbox from '@turf/bbox';
import buffer from '@turf/buffer';
import mask from '@turf/mask';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import * as mapgl from 'mapbox-gl';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { MapService } from '../../services/map.service';
import { MapHelpers } from '../../shared/helpers/map-helpers';

type MaskGeometry = Point | Polygon | MultiPolygon;
type MaskInput = Feature<MaskGeometry> | FeatureCollection<MaskGeometry>;
type MaskAreaInput = FeatureCollection<Polygon | MultiPolygon>;

const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [5.9559, 45.8179],
  [10.4921, 47.8085]
];
const DEFAULT_INPUT = MapHelpers.boundsToPolygonFeatureCollection([
  DEFAULT_BOUNDS[0][0],
  DEFAULT_BOUNDS[0][1],
  DEFAULT_BOUNDS[1][0],
  DEFAULT_BOUNDS[1][1]
]);
const INPUT_SOURCE_ID = 'mask-input';
const MASK_SOURCE_ID = 'mask-output';
const DEFAULT_POINT_BUFFER_METERS = 100;

@Component({
  selector: 'app-mask',
  imports: [ReactiveFormsModule],
  templateUrl: './mask.html',
  styleUrl: './mask.scss'
})
export class Mask implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;
  private currentInput: MaskInput = DEFAULT_INPUT;
  private copyStatusTimer?: ReturnType<typeof setTimeout>;

  protected readonly inputControl = new FormControl(JSON.stringify(DEFAULT_INPUT, null, 2), {
    nonNullable: true
  });
  protected readonly pointBufferControl = new FormControl(DEFAULT_POINT_BUFFER_METERS, {
    nonNullable: true
  });
  protected readonly errorMessage = signal('');
  protected readonly pointBufferError = signal('');
  protected readonly outputValue = signal(
    JSON.stringify(mask(this.toMaskAreaInput(DEFAULT_INPUT, DEFAULT_POINT_BUFFER_METERS)), null, 2)
  );
  protected readonly copyStatus = signal('');

  constructor(
    private readonly mapService: MapService,
    destroyRef: DestroyRef
  ) {
    this.inputControl.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.applyInput(value));

    this.pointBufferControl.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.applyPointBuffer(value));
  }

  async ngAfterViewInit(): Promise<void> {
    const map = await this.mapService.init(this.mapContainer, {
      bounds: DEFAULT_BOUNDS,
      fitBoundsOptions: {
        padding: 48
      }
    });

    const initialMask = mask(
      this.toMaskAreaInput(this.currentInput, DEFAULT_POINT_BUFFER_METERS)
    );

    map.addSource(MASK_SOURCE_ID, { type: 'geojson', data: initialMask });
    map.addLayer({
      id: 'mask-fill',
      type: 'fill',
      source: MASK_SOURCE_ID,
      paint: {
        'fill-color': '#0f172a',
        'fill-opacity': 0.32
      }
    });
    map.addSource(INPUT_SOURCE_ID, { type: 'geojson', data: this.currentInput });
    map.addLayer({
      id: 'mask-input-fill',
      type: 'fill',
      source: INPUT_SOURCE_ID,
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.08
      }
    });
    map.addLayer({
      id: 'mask-input-outline',
      type: 'line',
      source: INPUT_SOURCE_ID,
      paint: {
        'line-color': '#2563eb',
        'line-width': 2.5
      }
    });
    map.addLayer({
      id: 'mask-input-points',
      type: 'circle',
      source: INPUT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#2563eb',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.copyStatusTimer);
    this.mapService.destroy();
  }

  protected async copyOutput(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.outputValue());
      this.copyStatus.set('Copied');
    } catch {
      this.copyStatus.set('Copy failed');
    }

    clearTimeout(this.copyStatusTimer);
    this.copyStatusTimer = setTimeout(() => this.copyStatus.set(''), 2000);
  }

  protected zoomToInput(): void {
    const [west, south, east, north] = bbox(this.currentInput);

    this.mapService.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      { padding: 48, duration: 600, maxZoom: 16 }
    );
  }

  private applyInput(value: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      this.errorMessage.set('Enter valid JSON.');
      return;
    }

    if (!this.isMaskInput(parsed)) {
      this.errorMessage.set(
        'Use Point, Polygon, or MultiPolygon features in a Feature or FeatureCollection.'
      );
      return;
    }

    let inverseMask: Feature<Polygon>;

    try {
      inverseMask = mask(this.toMaskAreaInput(parsed, this.pointBufferControl.value));
    } catch {
      this.errorMessage.set('The polygon geometry could not be converted into a mask.');
      return;
    }

    this.errorMessage.set('');
    this.currentInput = parsed;
    this.outputValue.set(JSON.stringify(inverseMask, null, 2));
    this.mapService.updateGeoJSONSource(INPUT_SOURCE_ID, parsed);
    this.mapService.updateGeoJSONSource(MASK_SOURCE_ID, inverseMask);
  }

  private applyPointBuffer(value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      this.pointBufferError.set('Enter a distance greater than 0 metres.');
      return;
    }

    this.pointBufferError.set('');
    this.applyInput(this.inputControl.value);
  }

  private isMaskInput(value: unknown): value is MaskInput {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const geoJson = value as { type?: unknown; geometry?: { type?: unknown }; features?: unknown };

    if (geoJson.type === 'Feature') {
      return this.isMaskGeometryType(geoJson.geometry?.type);
    }

    if (geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
      return false;
    }

    return (
      geoJson.features.length > 0 &&
      geoJson.features.every((feature) => {
        if (!feature || typeof feature !== 'object') {
          return false;
        }

        const candidate = feature as { type?: unknown; geometry?: { type?: unknown } };
        return candidate.type === 'Feature' && this.isMaskGeometryType(candidate.geometry?.type);
      })
    );
  }

  private isMaskGeometryType(value: unknown): value is MaskGeometry['type'] {
    return value === 'Point' || value === 'Polygon' || value === 'MultiPolygon';
  }

  private toMaskAreaInput(input: MaskInput, pointBufferMeters: number): MaskAreaInput {
    const features = input.type === 'FeatureCollection' ? input.features : [input];
    const areaFeatures = features.map((feature): Feature<Polygon | MultiPolygon> => {
      if (feature.geometry.type !== 'Point') {
        return feature as Feature<Polygon | MultiPolygon>;
      }

      const buffered = buffer(feature as Feature<Point>, pointBufferMeters, {
        units: 'meters',
        steps: 32
      });

      if (!buffered) {
        throw new Error('Unable to buffer Point feature.');
      }

      return buffered;
    });

    return {
      type: 'FeatureCollection',
      features: areaFeatures
    };
  }
}
