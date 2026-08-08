# GeoTools

Browser-based geographic utilities built with Angular, Bootstrap, Mapbox GL and Turf.

- [Live example](https://vasile.github.io/geo)
- [Source code](https://github.com/vasile/geotools)

## Features

### BBox

Create and edit a geographic bounding box on a map.

- Starts with the bounding box of Switzerland.
- Updates the rectangle while coordinates are typed.
- Draggable corner handles update the coordinates and URL.
- **Apply** fits the map to the rectangle with padding.
- The current map viewport can be used as the new bounding box.
- Copy the generated output to the clipboard.
- Output formats:
  - GeoJSON `FeatureCollection`
  - WKT
  - KML
  - BBox array
  - PostGIS SQL
  - CSV
  - GML
  - OJP Rectangle

BBox state is reflected in the URL:

```text
/bbox?bounds=west,south,east,north
/bbox?bounds=5.9559,45.8179,10.4921,47.8085&format=kml
```

The default GeoJSON format is omitted from the query string.

### GeoMask

Create an inverse world geometry by subtracting the supplied GeoJSON.

- Accepts a GeoJSON `Feature` or `FeatureCollection`.
- Supports `Point`, `LineString`, `Polygon` and `MultiPolygon` geometries.
- Buffers points and lines into polygons before subtraction.
- Configurable point and line buffer in metres; the default is `100`.
- Supports mixed feature collections.
- Preserves polygon holes and detached areas.
- Updates the map and inverse output while the input is edited.
- **Zoom to input** changes the viewport only when explicitly requested.
- Inverse GeoJSON coordinates are formatted to six decimal places.
- Copy the inverse GeoJSON to the clipboard.

#### Mask query parameters

Create a rectangular polygon from bounds:

```text
/mask?bounds=5.9559,45.8179,10.4921,47.8085
```

Create Point features from coordinate pairs:

```text
/mask?coords=7.4474,46.948,8.5417,47.3769&buffer=1000
```

Create one LineString:

```text
/mask?line=7.1,46.9,7.2,47,7.3,47.1&buffer=1000
```

Repeat `line` to create multiple LineStrings, and combine them with points:

```text
/mask?coords=7.4474,46.948,8.5417,47.3769&line=7.1,46.9,7.2,47&line=8.1,46.8,8.2,46.9&buffer=1000
```

Each `line` requires at least two coordinate pairs. When points or lines are present, they take precedence over `bounds`. The default `buffer=100` is omitted from the URL.

Navigating from BBox to GeoMask transfers the current `bounds` and creates a rectangular polygon in the Mask input.

## Local setup

Create `src/app/config/app-config.local.ts` with your Mapbox access token:

```ts
export const APP_CONFIG = {
  mapboxKey: 'YOUR_MAPBOX_ACCESS_TOKEN'
};
```

The local configuration file is ignored by Git.

Install dependencies and start the development server:

```bash
npm install
npx ng serve
```

Open [http://localhost:4200](http://localhost:4200).


