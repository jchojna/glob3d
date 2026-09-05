import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';

import { ensureTooltipStyles } from './styles';

const tooltipNumberFormat = new Intl.NumberFormat();

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

type TooltipContent = {
  id: string;
  value: number;
  valueRank: number;
  tooltipValueSuffix: string;
  accentColor: string;
  country?: string;
  city?: string;
};

const upsertTooltipField = (
  tooltip: HTMLElement,
  dataId: string,
  className: string,
  text: string | undefined,
  insertBefore: HTMLElement
) => {
  let node = tooltip.querySelector<HTMLElement>(`[data-id="${dataId}"]`);
  if (!text) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement('p');
    node.className = className;
    node.setAttribute('data-id', dataId);
    tooltip.insertBefore(node, insertBefore);
  }
  if (node.textContent !== text) node.textContent = text;
};

export const createTooltipElement = () => {
  ensureTooltipStyles();
  const tooltip = document.createElement('div');
  tooltip.className = 'glob3d-tooltip';
  tooltip.setAttribute('data-id', 'tooltip');

  const tooltipRank = document.createElement('p');
  tooltipRank.className = 'glob3d-tooltip-rank';
  tooltipRank.setAttribute('data-id', 'tooltipRank');
  tooltip.appendChild(tooltipRank);

  const tooltipValue = document.createElement('p');
  tooltipValue.className = 'glob3d-tooltip-value';
  tooltipValue.setAttribute('data-id', 'tooltipValue');
  tooltip.appendChild(tooltipValue);

  return tooltip;
};

export const bindTooltipContent = (
  tooltip: HTMLElement,
  {
    id,
    value,
    valueRank,
    tooltipValueSuffix,
    accentColor,
    country,
    city,
  }: TooltipContent
) => {
  tooltip.id = id ? `tooltip-${id}` : '';
  if (tooltip.style.getPropertyValue('--tooltip-accent') !== accentColor) {
    tooltip.style.setProperty('--tooltip-accent', accentColor);
  }

  const tooltipRank = tooltip.querySelector<HTMLElement>(
    '[data-id="tooltipRank"]'
  );
  const tooltipValue = tooltip.querySelector<HTMLElement>(
    '[data-id="tooltipValue"]'
  );
  if (!tooltipRank || !tooltipValue) return;

  const rankText = String(valueRank);
  if (tooltipRank.textContent !== rankText) tooltipRank.textContent = rankText;

  upsertTooltipField(
    tooltip,
    'tooltipCountry',
    'glob3d-tooltip-country',
    country,
    tooltipValue
  );
  upsertTooltipField(
    tooltip,
    'tooltipCity',
    'glob3d-tooltip-city',
    city,
    tooltipValue
  );

  const valueText = `${tooltipNumberFormat.format(
    value
  )} ${tooltipValueSuffix}`;
  if (tooltipValue.textContent !== valueText) {
    tooltipValue.textContent = valueText;
  }
};

export const getTooltip = (
  id: string,
  value: number,
  valueRank: number,
  tooltipValueSuffix: string,
  accentColor: string,
  country?: string | undefined,
  city?: string | undefined
) => {
  const tooltip = createTooltipElement();
  bindTooltipContent(tooltip, {
    id,
    value,
    valueRank,
    tooltipValueSuffix,
    accentColor,
    country,
    city,
  });
  return tooltip;
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
