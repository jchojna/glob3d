import * as THREE from 'three';
import { getTooltip } from './helpers';

export default class Tooltip {
  city: string;
  coordinates: THREE.Vector3;
  country: string;
  distance: number | null;
  id: string;
  mask: THREE.Mesh;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipElement: HTMLElement;
  value: number;

  constructor(
    id: string,
    coordinates: { x: number; y: number; z: number },
    sizes: { width: number; height: number },
    value: number,
    options: { country: string; city: string; mask: THREE.Mesh }
  ) {
    const { country, city, mask } = options;
    const { x, y, z } = coordinates;
    this.city = city;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.country = country;
    this.distance = null;
    this.id = id;
    this.mask = mask;
    this.point = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.sizes = sizes;
    this.tooltipElement = getTooltip(id, country, city, value);
    this.value = value;
    this.init();
  }

  tick() {
    // return window.requestAnimationFrame(() => this.tick());
  }

  // get pixel position from normalized device coordinates
  getPixelPosition(point: THREE.Vector3) {
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  handleCameraUpdate(camera: THREE.Camera) {
    this.distance = this.coordinates.distanceTo(camera.position);
    this.point = this.coordinates.clone().project(camera);
    this.raycaster.setFromCamera(
      new THREE.Vector2(this.point.x, this.point.y),
      camera
    );

    const intersectObjects = this.raycaster.intersectObject(this.mask);

    const isBehindGlobe =
      intersectObjects.length > 0 &&
      intersectObjects[0].distance <
        this.coordinates.distanceTo(camera.position);

    const pxPosition = this.getPixelPosition(this.point);
    this.tooltipElement.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
    if (isBehindGlobe) {
      this.tooltipElement.classList.remove('visible');
    } else {
      this.tooltipElement.classList.add('visible');
    }
  }

  init() {
    this.tick();
  }
}
