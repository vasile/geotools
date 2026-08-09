import circle from '@turf/circle';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

export type Bounds = [west: number, south: number, east: number, north: number];
export type BoundsCorner = 'sw' | 'se' | 'ne' | 'nw';
export type CenterCoordinate = [longitude: number, latitude: number];
export type CircleHandle = 'center' | 'radius';

const EARTH_RADIUS_METERS = 6_371_008.8;

export class MapHelpers {
  static centerRadiusToPolygonFeatureCollection(
    center: CenterCoordinate,
    radiusMeters: number
  ): FeatureCollection<Polygon> {
    const circleFeature = circle(center, radiusMeters, { units: 'meters', steps: 64 });
    circleFeature.geometry.coordinates = circleFeature.geometry.coordinates.map((ring) =>
      ring.map(([longitude, latitude]) => [
        Number(longitude.toFixed(6)),
        Number(latitude.toFixed(6))
      ])
    );

    return {
      type: 'FeatureCollection',
      features: [circleFeature]
    };
  }

  static circleToHandleFeatureCollection(
    center: CenterCoordinate,
    circlePolygon: FeatureCollection<Polygon>
  ): FeatureCollection<Point, { handle: CircleHandle }> {
    const ring = circlePolygon.features[0].geometry.coordinates[0];
    const radiusCoordinate = ring.reduce((eastmost, coordinate) =>
      coordinate[0] > eastmost[0] ? coordinate : eastmost
    );

    return {
      type: 'FeatureCollection',
      features: [
        MapHelpers.circleHandleFeature(center, 'center'),
        MapHelpers.circleHandleFeature(radiusCoordinate, 'radius')
      ]
    };
  }

  static polygonFeatureCollectionToBounds(
    polygon: FeatureCollection<Polygon>
  ): Bounds {
    const coordinates = polygon.features.flatMap((feature) => feature.geometry.coordinates.flat());
    const longitudes = coordinates.map((coordinate) => coordinate[0]);
    const latitudes = coordinates.map((coordinate) => coordinate[1]);

    return [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes)
    ];
  }

  static polygonFeatureCollectionToWkt(polygon: FeatureCollection<Polygon>): string {
    const rings = polygon.features[0].geometry.coordinates
      .map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`)
      .join(', ');
    return `POLYGON(${rings})`;
  }

  static polygonFeatureCollectionToKml(polygon: FeatureCollection<Polygon>): string {
    const coordinates = polygon.features[0].geometry.coordinates[0]
      .map(([x, y]) => `${x},${y},0`)
      .join('\n              ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Circle</name>
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

  static polygonFeatureCollectionToGml(polygon: FeatureCollection<Polygon>): string {
    const positions = polygon.features[0].geometry.coordinates[0]
      .map(([x, y]) => `${x} ${y}`)
      .join(' ');

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

  static centerRadiusToOjpCircle(
    [longitude, latitude]: CenterCoordinate,
    radiusMeters: number
  ): string {
    return `<Circle
  xmlns="http://www.vdv.de/ojp"
  xmlns:siri="http://www.siri.org.uk/siri">
  <Center>
    <siri:Longitude>${longitude}</siri:Longitude>
    <siri:Latitude>${latitude}</siri:Latitude>
  </Center>
  <Radius>${radiusMeters}</Radius>
</Circle>`;
  }

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

  private static circleHandleFeature(
    coordinates: number[],
    handle: CircleHandle
  ): Feature<Point, { handle: CircleHandle }> {
    return {
      type: 'Feature',
      properties: { handle },
      geometry: {
        type: 'Point',
        coordinates
      }
    };
  }
}
