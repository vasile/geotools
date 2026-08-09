# GeoTools

Browser-based geographic utilities built with Angular, Bootstrap, Mapbox GL and Turf.

- [Live example](https://vasile.github.io/geo)

## Features

### BBox

Create and edit a geographic bounding box on a map.

- Starts with the bounding box of Switzerland.
- Supports box coordinates, center/size and circle construction modes.
- Center-mode width and height are expressed in metres.
- Circle mode uses a center point and radius in metres.
- Drag the circle's center handle to move it or its eastern radius handle to resize it.
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

| Link | Description |
| --- | --- |
| [`/bbox?bounds=5.9559,45.8179,10.4921,47.8085`](https://vasile.github.io/geo/bbox?bounds=5.9559,45.8179,10.4921,47.8085) | Create the Switzerland bounding box with the default GeoJSON output. |
| [`/bbox?bounds=-73.2,59.7,-11.3,83.9&format=kml`](https://vasile.github.io/geo/bbox?bounds=-73.2,59.7,-11.3,83.9&format=kml) | Create a Greenland bounding box, clearly showing high-latitude Web Mercator distortion, and generate KML output. |
| [`/bbox?mode=center&coords=7.4474,46.948&w=10000&h=5000`](https://vasile.github.io/geo/bbox?mode=center&coords=7.4474,46.948&w=10000&h=5000) | Create a rectangle centered on Bern with a width of 10,000 metres and height of 5,000 metres. |
| [`/bbox?mode=circle&coords=7.4474,46.948&r=5000`](https://vasile.github.io/geo/bbox?mode=circle&coords=7.4474,46.948&r=5000) | Create a circle centered on Bern with a radius of 5,000 metres. |

Bounds mode and the default GeoJSON format are omitted from the query string. Center mode uses `mode=center`, `coords=longitude,latitude`, and positive `w` and `h` dimensions in metres. Circle mode uses `mode=circle`, `coords=longitude,latitude`, and a positive `r` radius in metres.

For circles, GeoJSON, WKT, KML and GML contain the approximated circle polygon. BBox array, PostGIS envelope, CSV and OJP Rectangle contain its enclosing bounds.

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

| Link | Description |
| --- | --- |
| [`/mask?bounds=5.9559,45.8179,10.4921,47.8085`](https://vasile.github.io/geo/mask?bounds=5.9559,45.8179,10.4921,47.8085) | Create one rectangular Polygon from the Switzerland bounds. |
| [`/mask?coords=7.4474,46.948,8.5417,47.3769`](https://vasile.github.io/geo/mask?coords=7.4474,46.948,8.5417,47.3769) | Create Point features for Bern and Zurich with the default 100-metre buffer. |
| [`/mask?coords=7.4474,46.948,8.5417,47.3769&buffer=1000`](https://vasile.github.io/geo/mask?coords=7.4474,46.948,8.5417,47.3769&buffer=1000) | Create Point features for Bern and Zurich with a 1,000-metre buffer. |
| [`/mask?line=7.1,46.9,7.2,47,7.3,47.1&buffer=1000`](https://vasile.github.io/geo/mask?line=7.1,46.9,7.2,47,7.3,47.1&buffer=1000) | Create and buffer one LineString. |
| [`/mask?line=7.1,46.9,7.2,47&line=8.1,46.8,8.2,46.9&buffer=1000`](https://vasile.github.io/geo/mask?line=7.1,46.9,7.2,47&line=8.1,46.8,8.2,46.9&buffer=1000) | Create two separately buffered LineString features. |
| [`/mask?coords=7.4474,46.948,8.5417,47.3769&line=7.1,46.9,7.2,47&buffer=1000`](https://vasile.github.io/geo/mask?coords=7.4474,46.948,8.5417,47.3769&line=7.1,46.9,7.2,47&buffer=1000) | Combine Point and LineString features in one input FeatureCollection. |

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

## License

Released under the [MIT License](LICENSE).
