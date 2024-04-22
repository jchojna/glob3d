import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';

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
      console.warn(`Unsupported GeoJson geometry type (${type})`);
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

export const getTooltip = (
  id: string,
  value: number,
  valueRank: number,
  tooltipValueSuffix: string,
  accentColor: string,
  country?: string | undefined,
  city?: string | undefined
) => {
  const tooltip = document.createElement('div');
  tooltip.style.background = '#fff';
  tooltip.style.borderRadius = '10px';
  tooltip.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
  tooltip.style.color = '#000';
  tooltip.style.display = 'grid';
  tooltip.style.fontSize = '0.8rem';
  tooltip.style.columnGap = '15px';
  tooltip.style.gridTemplateColumns = 'repeat(3, auto)';
  tooltip.style.left = '10px';
  tooltip.style.padding = '10px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.position = 'absolute';
  tooltip.style.rowGap = '5px';
  tooltip.style.top = '10px';
  tooltip.style.transformOrigin = 'top left';
  tooltip.style.userSelect = 'none';
  // delay transition to prevent initial animation
  setTimeout(() => {
    tooltip.style.transition =
      'background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.1s';
  }, 10);

  if (id) tooltip.id = `tooltip-${id}`;

  const tooltipRank = document.createElement('p');
  tooltipRank.style.alignItems = 'center';
  tooltipRank.style.backgroundColor = '#fff';
  tooltipRank.style.border = `2px solid ${accentColor}`;
  tooltipRank.style.borderRadius = '50%';
  tooltipRank.style.color = accentColor;
  tooltipRank.style.display = 'flex';
  tooltipRank.style.fontWeight = 'bold';
  tooltipRank.style.gridRow = '1 / 3';
  tooltipRank.style.height = '30px';
  tooltipRank.style.justifyContent = 'center';
  tooltipRank.style.margin = '0';
  tooltipRank.style.width = '30px';
  tooltipRank.textContent = String(valueRank);
  tooltip.appendChild(tooltipRank);

  if (country) {
    const tooltipCountry = document.createElement('p');
    tooltipCountry.style.gridColumn = '2 / 3';
    tooltipCountry.style.margin = '0';
    tooltipCountry.textContent = country;
    tooltip.appendChild(tooltipCountry);
  }

  if (city) {
    const tooltipCity = document.createElement('p');
    tooltipCity.style.gridColumn = '3 / 4';
    tooltipCity.style.margin = '0';
    tooltipCity.textContent = city;
    tooltip.appendChild(tooltipCity);
  }

  const tooltipValue = document.createElement('p');
  tooltipValue.style.gridColumn = '2 / 4';
  tooltipValue.style.margin = '0';
  tooltipValue.textContent = `${new Intl.NumberFormat().format(
    value
  )} ${tooltipValueSuffix}`;
  tooltip.appendChild(tooltipValue);

  return tooltip;
};

export const getTooltipScale = (
  distance: number,
  minDistance: number,
  maxDistance: number
): number => {
  if (minDistance >= maxDistance)
    throw new Error('minDistance must be less than maxDistance');

  const croppedDistance = Math.min(
    Math.max(distance, minDistance),
    maxDistance
  );
  return (
    ((maxDistance - croppedDistance) / (maxDistance - minDistance)) * 0.5 + 0.5
  );
};
