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

  static boundsToKml([west, south, east, north]: Bounds): string {
    const coordinates = [
      `${west},${south},0`,
      `${east},${south},0`,
      `${east},${north},0`,
      `${west},${north},0`,
      `${west},${south},0`
    ].join('\n              ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Bounding box</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${coordinates}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
  }
}
