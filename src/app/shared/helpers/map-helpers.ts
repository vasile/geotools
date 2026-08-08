import type { FeatureCollection, Polygon } from 'geojson';

export type Bounds = [west: number, south: number, east: number, north: number];

export class MapHelpers {
  static boundsToPolygonFeatureCollection([
    west,
    south,
    east,
    north
  ]: Bounds): FeatureCollection<Polygon> {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south]
              ]
            ]
          }
        }
      ]
    };
  }
}
