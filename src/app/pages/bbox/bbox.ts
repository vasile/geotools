import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Map, NavigationControl, StyleSpecification } from 'maplibre-gl';

const LIGHT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    cartoLight: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 512,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  layers: [
    {
      id: 'carto-light',
      type: 'raster',
      source: 'cartoLight',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

@Component({
  selector: 'app-bbox',
  templateUrl: './bbox.html',
  styleUrl: './bbox.scss'
})
export class Bbox implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private map?: Map;

  ngAfterViewInit(): void {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: LIGHT_MAP_STYLE,
      center: [8.23, 46.82],
      zoom: 6.2
    });

    this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
