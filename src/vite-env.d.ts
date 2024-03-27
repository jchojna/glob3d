/// <reference types="vite/client" />

type HexData = {
  center: [number, number];
  city: string;
  coordinates: [number, number];
  country: string;
  h3Index: string;
  value: number;
  vertices: [number, number][];
};

type GeojsonFeature = {
  geometry: {
    type: string;
    coordinates: [number, number][][];
  };
};
