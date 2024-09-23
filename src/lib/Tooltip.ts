import * as THREE from 'three';

import {
  getPixelPosition,
  getResultNode,
  getTooltipScale,
} from '../utils/helpers';

export default class Tooltip implements TooltipProperties {
  coordinates: THREE.Vector3;
  distance: number;
  element: HTMLElement;
  id: string;
  mask: THREE.Mesh | undefined;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  activeBackgroundColor: string | undefined;
  activeTextColor: string | undefined;
  tooltipsLimit: number;

  constructor(
    id: string,
    coordinates: { x: number; y: number; z: number },
    sizes: { width: number; height: number },
    tooltipsLimit: number,
    value: number,
    options: {
      activeBackgroundColor: string;
      activeTextColor: string;
      valueSuffix: string;
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
      activeBackgroundColor,
      activeTextColor,
      valueSuffix,
      valueRank,
    } = options;
    const { x, y, z } = coordinates;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.distance = 0;
    this.element = getResultNode(
      id,
      'tooltip',
      value,
      valueRank,
      valueSuffix,
      activeBackgroundColor,
      country,
      city
    );
    this.id = id;
    this.mask = mask;
    this.point = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.sizes = sizes;
    this.activeBackgroundColor = activeBackgroundColor;
    this.activeTextColor = activeTextColor;
    this.tooltipsLimit = tooltipsLimit;
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
    const pxPosition = getPixelPosition(
      this.point,
      this.sizes.width,
      this.sizes.height
    );
    this.element.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
  }

  show() {
    this.element.style.backgroundColor = '#fff';
    this.element.style.color = '#000';
    this.element.style.opacity = '1';
  }

  hide() {
    this.element.style.opacity = '0';
    this.element.style.transform = `${this.element.style.transform} scale(0)`;
  }

  makeActive() {
    this.element.style.zIndex = String(this.tooltipsLimit + 1);
    if (this.activeBackgroundColor) {
      this.element.style.backgroundColor = this.activeBackgroundColor;
    }
    if (this.activeTextColor) {
      this.element.style.color = this.activeTextColor;
    }
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
