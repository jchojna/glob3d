/// <reference types="vite/client" />

type HexBin = {
  h3Index: string;
  center: [number, number];
  vertices: [number, number][];
};

type HexData = {
  center: [number, number];
  city: string;
  coordinates: [number, number];
  country: string;
  h3Index: string;
  id: string;
  value: number;
  vertices: [number, number][];
};

type GeojsonFeature = {
  type: string;
  properties: {
    [key: string]: string | number | null;
  };
  geometry: {
    type: string;
    coordinates: [number, number][][];
  };
};

type GlobeData = {
  country: string;
  city: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  value: number;
};

type GlobeOptions = {
  globeColor?: string;
  globeOpacity?: number;
  globeRadius?: number;
  hexRes?: number;
  hexMargin?: number;
  debugMode?: boolean;
};

type BarGlobeOptions = {
  barColor?: string;
  barColorHover?: string;
  highestBar?: number;
  tooltipsLimit?: number;
} & GlobeOptions;
