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
  offsetFromCenter: number;
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

interface GlobeData {
  country: string;
  city: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  value: number;
}

interface GlobeDataWithOffsets extends GlobeData {
  offsetFromCenter: number;
}

type GlobeOptions = {
  globeColor?: string;
  globeRadius?: number;
  dotOpacity?: number;
  dotPadding?: number;
  dotRes?: number;
};

type BarGlobeOptions = {
  barColor?: string;
  barOpacity?: number;
  barActiveColor?: string;
  barActiveOpacity?: number;
  highestBar?: number;
  tooltipActiveBackgroundColor?: string;
  tooltipActiveTextColor?: string;
  tooltipsLimit?: number;
  tooltipValueSuffix?: string;
} & GlobeOptions;

type GlobePosition = {
  x: number;
  y: number;
};

interface TooltipProperties {
  id: string;
  coordinates: THREE.Vector3;
  distance: number;
  value: number;
  valueRank: number;
  city?: string;
  country?: string;
}
