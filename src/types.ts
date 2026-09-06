export type GlobeData = {
  country: string;
  city: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  value: number;
};

export type GlobeOptions = {
  globeColor?: string;
  globeRadius?: number;
  landCellPadding?: number;
  landCellRes?: number;
  autoRotate?: boolean;
};

export type BarGlobeOptions = {
  barColor?: string;
  barActiveColor?: string;
  highestBar?: number;
  tooltipsLimit?: number;
  tooltipValueSuffix?: string;
} & GlobeOptions;
