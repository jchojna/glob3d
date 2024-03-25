import {
  cellToBoundary,
  cellToLatLng,
  latLngToCell,
  polygonToCells,
} from 'h3-js';

// Get H3 indexes for all hexagons in Polygon or MultiPolygon
export const getH3Indexes = (features, resolution) => {
  const indexes = [];
  features.forEach(({ geometry }) => {
    const { type, coordinates } = geometry;
    if (type === 'Polygon') {
      polygonToCells(coordinates, resolution, true).forEach((idx) =>
        indexes.push(idx)
      );
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((coords) => {
        polygonToCells(coords, resolution, true).forEach((idx) =>
          indexes.push(idx)
        );
      });
    } else {
      console.warn(`Unsupported GeoJson geometry type (${type})`);
    }
  });
  return indexes;
};

export const getHexBin = (h3Index) => {
  // Get center of a given hexagon - point as a [lat, lng] pair.
  const center = cellToLatLng(h3Index);
  // Get the vertices of a given hexagon as an array of [lat, lng] points.
  const vertices = cellToBoundary(h3Index, true).reverse();
  // Split geometries at the anti-meridian.
  const centerLng = center[1];
  vertices.forEach((d) => {
    const edgeLng = d[0];
    if (Math.abs(centerLng - edgeLng) > 170) {
      d[0] += centerLng > edgeLng ? 360 : -360;
    }
  });
  return { h3Index, center, vertices };
};

export const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
};

// Compute new geojson with relative margin.
export const getNewGeoJson = (hex, margin) => {
  const relNum = (st, end, rat) => st - (st - end) * rat;
  const [clat, clng] = hex.center;
  return margin === 0
    ? hex.vertices
    : hex.vertices.map(([elng, elat]) =>
        [
          [elng, clng],
          [elat, clat],
        ].map(([st, end]) => relNum(st, end, margin))
      );
};

export const polar2Cartesian = (lat, lng, globeRadius, relAltitude = 0) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const r = globeRadius * (1 + relAltitude) + 0.1;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
};
