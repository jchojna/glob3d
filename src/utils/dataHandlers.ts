import { latLngToCell } from 'h3-js';
import { getHexBin } from './helpers';

const preProcessData = (data: GlobeData[], hexResolution: number) => {
  return data.map(({ city, country, coordinates, value }): HexData => {
    const h3Index = latLngToCell(
      coordinates.lat,
      coordinates.lon,
      hexResolution
    );
    const hexBin = getHexBin(h3Index);
    return {
      city,
      country,
      coordinates: [coordinates.lat, coordinates.lon],
      ...hexBin,
      id: '',
      value,
    };
  });
};

const addOffsets = (
  data: GlobeData[],
  globeRadius: number,
  highestBar: number
) => {
  const hexMaxValue = Math.max(...data.map((obj) => obj.value));
  return data.map((hex) => ({
    ...hex,
    offsetFromCenter:
      globeRadius + (hex.value / hexMaxValue) * globeRadius * 2 * highestBar,
  }));
};

export const aggregateData = (
  data: GlobeData[],
  hexResolution: number,
  globeRadius: number,
  highestBar: number
) => {
  return addOffsets(
    preProcessData(data, hexResolution),
    globeRadius,
    highestBar
  ).reduce((acc: HexData[], curr: HexData) => {
    const idx = acc.findIndex(
      (elem: { h3Index: string }) => elem.h3Index === curr.h3Index
    );
    if (idx >= 0) {
      if (curr.city) acc[idx].city += `, ${curr.city}`;
      acc[idx].value += curr.value;
      return acc;
    } else {
      return [...acc, curr];
    }
  }, []);
};
