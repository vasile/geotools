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
});
