import type {
  InstancedMesh,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector2,
} from 'three';

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

export declare class Glob3d {
  camera: PerspectiveCamera;
  globe: Mesh;
  globeColor: string;
  globeRadius: number;
  landCellGlobe: InstancedMesh | null;
  landCellPadding: number;
  landCellRes: number;
  mouse: Vector2;
  root: HTMLElement;
  scene: Scene;
  sizes: { width: number; height: number };

  constructor(root: HTMLElement, options?: GlobeOptions);

  fadeOutLandCells(): void;
  fadeInLandCells(): void;
  setGlobeColor(color: string): void;
  setAutoRotate(autoRotate: boolean): void;
  getRendererInfo(): {
    memory: {
      geometries: number;
      textures: number;
    };
    render: {
      calls: number;
      triangles: number;
      lines: number;
      points: number;
    };
  };
  destroy(): void;
}

export declare class BarGlob3d extends Glob3d {
  constructor(root: HTMLElement, data: GlobeData[], options?: BarGlobeOptions);

  setBarColor(color: string): void;
  setBarActiveColor(color: string): void;
  onLoading(): void;
  onUpdate(data: GlobeData[]): void;
  onError(): void;
}
