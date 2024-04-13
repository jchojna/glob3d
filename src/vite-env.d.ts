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
  barOpacity?: number;
  barActiveColor?: string;
  barActiveOpacity?: number;
  highestBar?: number;
  tooltipsLimit?: number;
} & GlobeOptions;

interface TooltipProperties {
  city: string;
  coordinates: THREE.Vector3;
  country: string;
  distance: number;
  element: HTMLElement;
  id: string;
  mask: THREE.Mesh;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipsLimit: number;
  value: number;
  handleCameraUpdate: (camera: THREE.Camera) => void;
  show: (onTop?: boolean) => void;
  hide: () => void;
  updateOrder: (
    index: number,
    minDistance: number,
    maxDistance: number
  ) => void;
}
