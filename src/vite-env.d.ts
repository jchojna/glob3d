/// <reference types="vite/client" />

type LandCell = {
  h3Index: string;
  center: [number, number];
  vertices: [number, number][];
};

type BarData = LandCell & {
  city: string;
  coordinates: [number, number];
  country: string;
  id: string;
  offsetFromCenter: number;
  value: number;
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
