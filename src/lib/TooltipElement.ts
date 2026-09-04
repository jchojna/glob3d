import * as THREE from 'three';

import { getTooltip, getTooltipScale } from '../utils/helpers';

export default class Tooltip implements TooltipProperties {
  coordinates: THREE.Vector3;
  distance: number;
  element: HTMLElement;
  id: string;
  isVisible = false;
  mask: THREE.Mesh | undefined;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipActiveBackgroundColor: string | undefined;
  tooltipActiveTextColor: string | undefined;
  tooltipsLimit: number;
  #posX = 0;
  #posY = 0;
  #scale = 1;
  #intersections: THREE.Intersection[] = [];
  #raycastPoint = new THREE.Vector2();

  constructor(
    id: string,
    coordinates: { x: number; y: number; z: number },
    sizes: { width: number; height: number },
    tooltipsLimit: number,
    value: number,
    options: {
      tooltipActiveBackgroundColor: string;
      tooltipActiveTextColor: string;
      tooltipValueSuffix: string;
      valueRank: number;
      city?: string;
      country?: string;
      mask?: THREE.Mesh;
    }
  ) {
    const {
      city,
      country,
      mask,
      tooltipActiveBackgroundColor,
      tooltipActiveTextColor,
      tooltipValueSuffix,
      valueRank,
    } = options;
    const { x, y, z } = coordinates;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.distance = 0;
    this.element = getTooltip(
      id,
      value,
      valueRank,
      tooltipValueSuffix,
      tooltipActiveBackgroundColor,
      country,
      city
    );
    this.id = id;
    this.mask = mask;
    this.point = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.sizes = sizes;
    this.tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.tooltipActiveTextColor = tooltipActiveTextColor;
    this.tooltipsLimit = tooltipsLimit;
    this.#applyVisibility();
  }

  #applyTransform() {
    this.element.style.transform = `translate(${this.#posX}px, ${
      this.#posY
    }px) scale(${this.#scale})`;
  }

  #applyVisibility() {
    this.element.style.opacity = this.isVisible ? '1' : '0';
    if (!this.isVisible) {
      this.#scale = 0;
    }
  }

  updateOrder(index: number, minDistance: number, maxDistance: number) {
    this.element.style.zIndex = String(this.tooltipsLimit - index);
    if (!this.distance) return;
    this.#scale = getTooltipScale(this.distance, minDistance, maxDistance);
    this.#applyTransform();
  }

  updateTooltipPosition() {
    this.#posX = ((this.point.x + 1) / 2) * this.sizes.width;
    this.#posY = ((this.point.y - 1) / 2) * this.sizes.height * -1;
    this.#applyTransform();
  }

  show(onTop = false) {
    this.isVisible = true;
    this.element.style.backgroundColor = '#fff';
    this.element.style.color = '#000';
    this.#applyVisibility();

    if (onTop) {
      this.element.style.zIndex = String(this.tooltipsLimit + 1);
      if (this.tooltipActiveBackgroundColor) {
        this.element.style.backgroundColor = this.tooltipActiveBackgroundColor;
      }
      if (this.tooltipActiveTextColor) {
        this.element.style.color = this.tooltipActiveTextColor;
      }
    }
  }

  hide() {
    this.isVisible = false;
    this.#applyVisibility();
  }

  handleCameraUpdate(camera: THREE.Camera) {
    this.distance = this.coordinates.distanceTo(camera.position);
    this.point.copy(this.coordinates).project(camera);
    this.updateTooltipPosition();
    this.handleMasking(camera);
  }

  handleMasking(camera: THREE.Camera) {
    if (!this.mask) return;
    this.#raycastPoint.set(this.point.x, this.point.y);
    this.raycaster.setFromCamera(this.#raycastPoint, camera);
    this.#intersections.length = 0;
    this.raycaster.intersectObject(this.mask, false, this.#intersections);
    const isBehindGlobe =
      this.#intersections.length > 0 &&
      this.#intersections[0].distance < this.distance;

    this.isVisible = !isBehindGlobe;
    this.#applyVisibility();
  }
}
