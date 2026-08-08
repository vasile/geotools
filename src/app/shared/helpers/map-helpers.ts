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

  static boundsToWkt([west, south, east, north]: Bounds): string {
    return `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`;
  }

  static boundsToJson(bounds: Bounds): string {
    return JSON.stringify(bounds, null, 2);
  }

  static boundsToPostgis([west, south, east, north]: Bounds): string {
    return `ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`;
  }

  static boundsToCsv([west, south, east, north]: Bounds): string {
    return `west,south,east,north\n${west},${south},${east},${north}`;
  }

  static boundsToGml([west, south, east, north]: Bounds): string {
    const positions = [
      `${west} ${south}`,
      `${east} ${south}`,
      `${east} ${north}`,
      `${west} ${north}`,
      `${west} ${south}`
    ].join(' ');

    return `<gml:Polygon
  xmlns:gml="http://www.opengis.net/gml/3.2"
  srsName="urn:ogc:def:crs:OGC:1.3:CRS84">
  <gml:exterior>
    <gml:LinearRing>
      <gml:posList>${positions}</gml:posList>
    </gml:LinearRing>
  </gml:exterior>
</gml:Polygon>`;
  }
}
