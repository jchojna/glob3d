import { latLngToCell } from 'h3-js';
import { getHexBin } from '../utils/helpers';

export default class DataManager {
  #data: GlobeData[];
  #processedData: HexData[];
  #aggregatedData: HexData[];
  #hexResolution: number;
  #globeRadius: number;
  #highestBar: number;

  constructor(
    inputData: GlobeData[],
    hexResolution: number,
    globeRadius: number,
    highestBar: number
  ) {
    this.#hexResolution = hexResolution;
    this.#globeRadius = globeRadius;
    this.#highestBar = highestBar;
    this.#data = this.#addOffsets(inputData);
    this.#data = this.#addValueRanks(this.#data);
    this.#processedData = this.#processData(this.#data);
    this.#aggregatedData = this.#aggregateData(this.#processedData);
  }

  #addOffsets(data: GlobeData[]): GlobeData[] {
    const hexMaxValue = Math.max(...data.map((obj) => obj.value));
    return data.map((hex) => ({
      ...hex,
      offsetFromCenter:
        this.#globeRadius +
        (hex.value / hexMaxValue) * this.#globeRadius * 2 * this.#highestBar,
    }));
  }

  #addValueRanks(data: GlobeData[]) {
    const values = data.map((obj) => obj.value);
    return data.map((obj) => ({
      ...obj,
      valueRank: values.filter((val: number) => val > obj.value).length + 1,
    }));
  }

  #processData(data: GlobeData[]) {
    return data.map(
      ({
        city,
        country,
        coordinates,
        offsetFromCenter,
        value,
        valueRank,
      }): HexData => {
        const h3Index = latLngToCell(
          coordinates.lat,
          coordinates.lon,
          this.#hexResolution
        );
        const hexBin = getHexBin(h3Index);
        return {
          city,
          country,
          coordinates: [coordinates.lat, coordinates.lon],
          ...hexBin,
          id: '',
          offsetFromCenter: offsetFromCenter ?? 0,
          value,
          valueRank: valueRank ?? 0,
        };
      }
    );
  }

  #aggregateData(data: HexData[]) {
    return data.reduce((acc: HexData[], curr: HexData) => {
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
  }

  get data(): HexData[] {
    return this.#aggregatedData;
  }
}
