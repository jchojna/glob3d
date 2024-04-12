import * as THREE from 'three';
import { getTooltip, getTooltipScale } from './helpers';

export default class Tooltip {
  city: string;
  coordinates: THREE.Vector3;
  country: string;
  distance: number | null;
  element: HTMLElement;
  id: string;
  mask: THREE.Mesh;
  point: THREE.Vector3;
  raycaster: THREE.Raycaster;
  sizes: { width: number; height: number };
  tooltipsLimit: number | null;
  value: number;

  constructor(
    id: string,
    coordinates: { x: number; y: number; z: number },
    sizes: { width: number; height: number },
    value: number,
    options: {
      country: string;
      city: string;
      mask: THREE.Mesh;
      tooltipsLimit: number | null;
    }
  ) {
    const { country, city, mask, tooltipsLimit } = options;
    const { x, y, z } = coordinates;
    this.city = city;
    this.coordinates = new THREE.Vector3(x, y, z);
    this.country = country;
    this.distance = null;
    this.element = getTooltip(id, country, city, value);
    this.id = id;
    this.mask = mask;
    this.point = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.sizes = sizes;
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

  // updateTooltipVisibility() {
  //   this.tooltipsRefPoints.forEach((hex, i) => {
  //     const zIndex = this.tooltipsRefPoints.length - i;
  //     const tooltip = this.tooltips.find(
  //       (tooltip) => tooltip.id === `tooltip-${hex.id}`
  //     );
  //     if (!tooltip) return;
  //     if (i < totalTooltips) {
  //       const tooltipScale = getTooltipScale(
  //         hex.distance,
  //         minDistance,
  //         maxDistance
  //       );
  //       tooltip.classList.add('visible');
  //       if (hex.id !== this.hoveredHexId) {
  //         tooltip.style.transform = `${tooltip.style.transform} scale(${tooltipScale})`;
  //         // update z-index
  //       } else {
  //         tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
  //       }
  //     } else {
  //       tooltip.classList.remove('visible');
  //       if (hex.id !== this.hoveredHexId) {
  //         tooltip.style.transform = `${tooltip.style.transform} scale(0)`;
  //         // update z-index
  //       } else {
  //         tooltip.classList.add('visible');
  //         tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
  //       }
  //     }
  //   });
  // }

  updateOrder(index: number, minDistance: number, maxDistance: number) {
    this.element.style.zIndex = String(this.tooltipsLimit - index);
    if (!this.distance) return;
    const tooltipScale = getTooltipScale(
      this.distance,
      minDistance,
      maxDistance
    );
    this.element.style.transform = `${this.element.style.transform} scale(${tooltipScale})`;
  }

  show() {
    this.element.classList.add('visible');
  }

  hide() {
    this.element.classList.remove('visible');
    this.element.style.transform = `${this.element.style.transform} scale(0)`;
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
    this.element.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
    if (isBehindGlobe) {
      this.element.classList.remove('visible');
      this.element.style.transform = `${this.element.style.transform} scale(0)`;
    } else {
      this.element.classList.add('visible');
    }
  }
}
