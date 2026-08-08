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
});
