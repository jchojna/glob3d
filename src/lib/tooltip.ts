import * as THREE from 'three';
import { getTooltip, getTooltipScale } from './helpers';

export default class Tooltip implements TooltipProperties {
  city: string | undefined;
  coordinates: THREE.Vector3;
  country: string | undefined;
  distance: number;
  element: HTMLElement;
  id: string;
  mask: THREE.Mesh | undefined;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipActiveBackgroundColor: string;
  tooltipActiveTextColor: string;
  tooltipsLimit: number;
  value: number;

  constructor(
    id: string,
    coordinates: { x: number; y: number; z: number },
    sizes: { width: number; height: number },
    tooltipsLimit: number,
    value: number,
    options: {
      tooltipActiveBackgroundColor: string;
      tooltipActiveTextColor: string;
      country?: string;
      city?: string;
      mask?: THREE.Mesh;
    }
  ) {
    const {
      tooltipActiveBackgroundColor,
      tooltipActiveTextColor,
      country,
      city,
      mask,
    } = options;
    const { x, y, z } = coordinates;
    this.city = city;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.country = country;
    this.distance = 0;
    this.element = getTooltip(id, value, country, city);
    this.id = id;
    this.mask = mask;
    this.point = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.sizes = sizes;
    this.tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.tooltipActiveTextColor = tooltipActiveTextColor;
    this.tooltipsLimit = tooltipsLimit;
    this.value = value;
  }

  // get pixel position from normalized device coordinates
  getPixelPosition(point: THREE.Vector3) {
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  updateOrder(index: number, minDistance: number, maxDistance: number) {
    this.element.style.zIndex = String(this.tooltipsLimit - index);
    if (!this.distance) return;
    const tooltipScale = getTooltipScale(
      this.distance,
      minDistance,
      maxDistance
    );
    this.element.style.transform = `
      ${this.element.style.transform} scale(${tooltipScale})
    `;
  }

  updateTooltipPosition() {
    const pxPosition = this.getPixelPosition(this.point);
    this.element.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
  }

  show(onTop = false) {
    this.element.classList.add('visible');
    this.element.style.backgroundColor = '#fff';
    this.element.style.color = '#000';
    if (onTop) {
      this.element.style.zIndex = String(this.tooltipsLimit + 1);
      this.element.style.backgroundColor = this.tooltipActiveBackgroundColor;
      this.element.style.color = this.tooltipActiveTextColor;
    }
  }

  hide() {
    this.element.classList.remove('visible');
    this.element.style.transform = `${this.element.style.transform} scale(0)`;
  }

  handleCameraUpdate(camera: THREE.Camera) {
    this.distance = this.coordinates.distanceTo(camera.position);
    this.point = this.coordinates.clone().project(camera);
    this.updateTooltipPosition();
    this.handleMasking(camera);
  }

  handleMasking(camera: THREE.Camera) {
    if (!this.mask) return;
    this.raycaster.setFromCamera(
      new THREE.Vector2(this.point.x, this.point.y),
      camera
    );
    const intersectObjects = this.raycaster.intersectObject(this.mask);
    const isBehindGlobe =
      intersectObjects.length > 0 &&
      intersectObjects[0].distance <
        this.coordinates.distanceTo(camera.position);

    if (isBehindGlobe) {
      this.hide();
    } else {
      this.show();
    }
  }
}
