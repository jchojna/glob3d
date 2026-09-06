import { latLngToCell } from 'h3-js';
import { getLandCell } from '../utils/helpers';

export default class DataManager {
  #dataWithOffsets: GlobeDataWithOffsets[];
  #processedData: BarData[];
  #aggregatedData: BarData[];
  #landCellResolution: number;
  #globeRadius: number;
  #highestBar: number;

  constructor(
    inputData: GlobeData[],
    landCellResolution: number,
    globeRadius: number,
    highestBar: number
  ) {
    this.#landCellResolution = landCellResolution;
    this.#globeRadius = globeRadius;
    this.#highestBar = highestBar;
    this.#dataWithOffsets = this.#addOffsets(inputData);
    this.#processedData = this.#processData(this.#dataWithOffsets);
    this.#aggregatedData = this.#aggregateData(this.#processedData);
  }

  #addOffsets(data: GlobeData[]): GlobeDataWithOffsets[] {
    const maxValue = Math.max(...data.map((obj) => obj.value));
    return data.map((item) => ({
      ...item,
      offsetFromCenter:
        this.#globeRadius +
        (item.value / maxValue) * this.#globeRadius * 2 * this.#highestBar,
    }));
  }

  #processData(data: GlobeDataWithOffsets[]) {
    return data.map(
      ({ city, country, coordinates, offsetFromCenter, value }): BarData => {
        const h3Index = latLngToCell(
          coordinates.lat,
          coordinates.lon,
          this.#landCellResolution
        );
        const landCell = getLandCell(h3Index);
        return {
          city,
          country,
          coordinates: [coordinates.lat, coordinates.lon],
          ...landCell,
          id: '',
          offsetFromCenter,
          value,
        };
      }
    );
  }

  #aggregateData(data: BarData[]) {
    return data.reduce((acc: BarData[], curr: BarData) => {
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

  get data(): BarData[] {
    return this.#aggregatedData;
  }
}
