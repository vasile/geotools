import { MapHelpers } from './map-helpers';

describe('MapHelpers', () => {
  it('converts bounds to a closed polygon feature collection', () => {
    const result = MapHelpers.boundsToPolygonFeatureCollection([5, 45, 10, 48]);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual([
      [
        [5, 45],
        [10, 45],
        [10, 48],
        [5, 48],
        [5, 45]
      ]
    ]);
  });

  it('converts bounds to a closed KML polygon', () => {
    const result = MapHelpers.boundsToKml([5, 45, 10, 48]);

    expect(result).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(result).toContain('5,45,0');
    expect(result).toContain('10,48,0');
    expect(result.match(/5,45,0/g)).toHaveLength(2);
  });

  it('converts bounds to WKT', () => {
    expect(MapHelpers.boundsToWkt([5, 45, 10, 48])).toBe(
      'POLYGON((5 45, 10 45, 10 48, 5 48, 5 45))'
    );
  });

  it('converts bounds to a formatted JSON array', () => {
    expect(MapHelpers.boundsToJson([5, 45, 10, 48])).toBe('[\n  5,\n  45,\n  10,\n  48\n]');
  });

  it('converts bounds to PostGIS SQL', () => {
    expect(MapHelpers.boundsToPostgis([5, 45, 10, 48])).toBe(
      'ST_MakeEnvelope(5, 45, 10, 48, 4326)'
    );
  });

  it('converts bounds to CSV', () => {
    expect(MapHelpers.boundsToCsv([5, 45, 10, 48])).toBe(
      'west,south,east,north\n5,45,10,48'
    );
  });

  it('converts bounds to a closed GML polygon in longitude-latitude order', () => {
    const result = MapHelpers.boundsToGml([5, 45, 10, 48]);

    expect(result).toContain('srsName="urn:ogc:def:crs:OGC:1.3:CRS84"');
    expect(result).toContain('<gml:posList>5 45 10 45 10 48 5 48 5 45</gml:posList>');
  });
});
