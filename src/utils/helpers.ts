import clsx from 'clsx';
import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';
import * as THREE from 'three';

import classes from '../styles/result.module.css';

// Get H3 indexes for all hexagons in Polygon or MultiPolygon
export const getH3Indexes = (
  features: GeojsonFeature[],
  resolution: number
) => {
  const indexes: string[] = [];
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
      console.warn(`Unsupported GeoJson geometry type: ${type}`);
    }
  });
  return indexes;
};

export const getHexBin = (h3Index: string) => {
  // Get center of a given hexagon - point as a [lat, lng] pair.
  const center = cellToLatLng(h3Index);
  // Get the vertices of a given hexagon as an array of [lng, lat] points.
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

// Compute new geojson with relative margin.
export const getNewGeoJson = (hex: HexBin, margin: number) => {
  const relNum = (st: number, end: number, rat: number) =>
    st - (st - end) * rat;
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

export const getXYZCoordinates = (
  lat: number,
  lng: number,
  globeRadius: number,
  relAltitude = 0
) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const r = globeRadius * (1 + relAltitude);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
};

export const getResultNode = (
  id: string,
  type: 'score' | 'tooltip',
  value: number,
  valueRank: number,
  valueSuffix: string,
  accentColor: string,
  country?: string | undefined,
  city?: string | undefined
) => {
  const node = document.createElement('div');
  node.className = clsx(classes.result, classes[type]);
  node.setAttribute('data-id', type);

  // delay transition to prevent initial animation
  setTimeout(() => {
    node.style.transition =
      'background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.1s';
  }, 10);

  node.innerHTML = `
    <p
      id="${type}-${id}"
      class=${classes.rank}
      style="border-color: ${accentColor}; color: ${accentColor}"
      data-id="${type}Rank"
    >
      ${valueRank}
    </p>
    <p class=${classes.value} data-id="${type}Value">
      ${new Intl.NumberFormat().format(value)} ${valueSuffix}
    </p>
  `;

  if (country) {
    node.innerHTML += `<p class=${classes.country} data-id="${type}Country">
      ${country}
    </p>`;
  }

  if (city) {
    node.innerHTML += `<p class=${classes.city} data-id="${type}City">
      ${city}
    </p>`;
  }

  return node;
};

export const getTooltipScale = (
  distance: number,
  minDistance: number,
  maxDistance: number
): number => {
  if (minDistance > maxDistance)
    throw new Error('minDistance cannot be greater than maxDistance');

  const croppedDistance = Math.min(
    Math.max(distance, minDistance),
    maxDistance
  );
  return maxDistance === minDistance
    ? 1
    : ((maxDistance - croppedDistance) / (maxDistance - minDistance)) * 0.5 +
        0.5;
};

// get pixel position from normalized device coordinates
export const getPixelPosition = (
  point: THREE.Vector3,
  width: number,
  height: number
) => {
  return {
    x: ((point.x + 1) / 2) * width,
    y: ((point.y - 1) / 2) * height * -1,
  };
};
