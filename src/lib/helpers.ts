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

export const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
};

// Compute new geojson with relative margin.
export const getNewGeoJson = (hex: HexData, margin: number) => {
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
  country: string,
  city: string,
  value: number
) => {
  const tooltip = document.createElement('div');
  tooltip.classList.add('tooltip');

  if (id) tooltip.id = `tooltip-${id}`;

  if (country) {
    const tooltipCountry = document.createElement('p');
    tooltipCountry.classList.add('country');
    tooltipCountry.textContent = country;
    tooltip.appendChild(tooltipCountry);
  }

  if (city) {
    const tooltipCity = document.createElement('p');
    tooltipCity.classList.add('city');
    tooltipCity.textContent = city;
    tooltip.appendChild(tooltipCity);
  }

  if (value) {
    const tooltipValue = document.createElement('p');
    tooltipValue.classList.add('value');
    tooltipValue.textContent = `${value} people`;
    tooltip.appendChild(tooltipValue);
  }

  return tooltip;
};
