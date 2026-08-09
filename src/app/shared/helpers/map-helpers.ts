import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

export type Bounds = [west: number, south: number, east: number, north: number];
export type BoundsCorner = 'sw' | 'se' | 'ne' | 'nw';
export type CenterCoordinate = [longitude: number, latitude: number];

const EARTH_RADIUS_METERS = 6_371_008.8;

export class MapHelpers {
  static centerSizeToBounds(
    [longitude, latitude]: CenterCoordinate,
    widthMeters: number,
    heightMeters: number
  ): Bounds | undefined {
    if (widthMeters <= 0 || heightMeters <= 0) {
      return undefined;
    }

    const latitudeRadians = (latitude * Math.PI) / 180;
    const longitudeScale = Math.cos(latitudeRadians);

    if (Math.abs(longitudeScale) < Number.EPSILON) {
      return undefined;
    }

    const latitudeDelta = ((heightMeters / 2) / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const longitudeDelta =
      ((widthMeters / 2) / (EARTH_RADIUS_METERS * longitudeScale)) * (180 / Math.PI);
    const bounds: Bounds = [
      longitude - longitudeDelta,
      latitude - latitudeDelta,
      longitude + longitudeDelta,
      latitude + latitudeDelta
    ];

    return bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -90 && bounds[3] <= 90
      ? bounds
      : undefined;
  }

  static boundsToCenterSize([west, south, east, north]: Bounds): {
    center: CenterCoordinate;
    widthMeters: number;
    heightMeters: number;
  } {
    const center: CenterCoordinate = [(west + east) / 2, (south + north) / 2];
    const latitudeRadians = (center[1] * Math.PI) / 180;

    return {
      center,
      widthMeters:
        ((east - west) * Math.PI * EARTH_RADIUS_METERS * Math.cos(latitudeRadians)) / 180,
      heightMeters: ((north - south) * Math.PI * EARTH_RADIUS_METERS) / 180
    };
  }

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

  static boundsToHandleFeatureCollection([
    west,
    south,
    east,
    north
  ]: Bounds): FeatureCollection<Point, { corner: BoundsCorner }> {
    return {
      type: 'FeatureCollection',
      features: [
        MapHelpers.pointFeature(west, south, 'sw'),
        MapHelpers.pointFeature(east, south, 'se'),
        MapHelpers.pointFeature(east, north, 'ne'),
        MapHelpers.pointFeature(west, north, 'nw')
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

  static boundsToOjpRectangle([west, south, east, north]: Bounds): string {
    return `<Rectangle
  xmlns="http://www.vdv.de/ojp"
  xmlns:siri="http://www.siri.org.uk/siri">
  <UpperLeft>
    <siri:Longitude>${west}</siri:Longitude>
    <siri:Latitude>${north}</siri:Latitude>
  </UpperLeft>
  <LowerRight>
    <siri:Longitude>${east}</siri:Longitude>
    <siri:Latitude>${south}</siri:Latitude>
  </LowerRight>
</Rectangle>`;
  }

  private static pointFeature(
    longitude: number,
    latitude: number,
    corner: BoundsCorner
  ): Feature<Point, { corner: BoundsCorner }> {
    return {
      type: 'Feature',
      properties: { corner },
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    };
  }
}
