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

interface TooltipProperties {
  coordinates: THREE.Vector3;
  distance: number;
  element: HTMLElement;
  id: string;
  mask: THREE.Mesh | undefined;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipActiveBackgroundColor: string | undefined;
  tooltipActiveTextColor: string | undefined;
  tooltipsLimit: number;
  getPixelPosition: (point: THREE.Vector3) => { x: number; y: number };
  handleCameraUpdate: (camera: THREE.Camera) => void;
  handleMasking: (camera: THREE.Camera) => void;
  hide: () => void;
  show: (onTop?: boolean) => void;
  updateOrder: (
    index: number,
    minDistance: number,
    maxDistance: number
  ) => void;
  updateTooltipPosition: () => void;
}

type HexResult = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
