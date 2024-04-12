import * as THREE from 'three';
import { getTooltip } from './helpers';

export default class Tooltip {
  id: string;
  country: string;
  city: string;
  value: number;
  distance: number | null;
  coordinates: THREE.Vector3;
  tooltipElement: HTMLElement;
  tooltipsRefPoint: TooltipRefPoint;

  constructor(
    id: string,
    country: string,
    city: string,
    value: number,
    coordinates: { x: number; y: number; z: number }
  ) {
    const { x, y, z } = coordinates;
    this.id = id;
    this.country = country;
    this.city = city;
    this.value = value;
    this.tooltipElement = getTooltip(
      this.id,
      this.country,
      this.city,
      this.value
    );
    this.tooltipsRefPoint;
    this.refPoint;
    this.distance = null;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.init();
  }

  tick() {
    // return window.requestAnimationFrame(() => this.tick());
  }

  setDistance(cameraPositionVector: THREE.Vector3) {
    this.distance = this.coordinates.distanceTo(cameraPositionVector);
  }

  init() {
    this.tick();
  }
}
