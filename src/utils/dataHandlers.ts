import { latLngToCell } from 'h3-js';
import { getHexBin } from './helpers';

export const preProcessData = (data: GlobeData[], hexResolution: number) => {
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

export const aggregateData = (data: GlobeData[], hexResolution: number) => {
  return preProcessData(data, hexResolution).reduce(
    (acc: HexData[], curr: HexData) => {
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
    },
    []
  );
};
