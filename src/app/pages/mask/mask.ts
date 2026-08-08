import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

import { MapService } from '../../services/map.service';

const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [5.9559, 45.8179],
  [10.4921, 47.8085]
];

@Component({
  selector: 'app-mask',
  templateUrl: './mask.html',
  styleUrl: './mask.scss'
})
export class Mask implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  constructor(private readonly mapService: MapService) {}

  async ngAfterViewInit(): Promise<void> {
    await this.mapService.init(this.mapContainer, {
      bounds: DEFAULT_BOUNDS,
      fitBoundsOptions: {
        padding: 48
      }
    });
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }
}
