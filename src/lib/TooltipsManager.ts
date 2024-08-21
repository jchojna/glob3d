import * as THREE from 'three';

import classes from '../styles/tooltips.module.css';
import { getXYZCoordinates } from '../utils/helpers';
import Tooltip from './TooltipElement';

type TooltipsOptions = {
  tooltipActiveBackgroundColor: string;
  tooltipActiveTextColor: string;
  valueSuffix: string;
  tooltipsLimit: number;
};

export default class TooltipsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #options: TooltipsOptions;
  #tooltips: TooltipProperties[];
  #tooltipsContainer: HTMLElement | null;
  #clickedHexId: string | null;
  #hoveredHexId: string | null;

  constructor(
    root: HTMLElement,
    globe: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    options: TooltipsOptions
  ) {
    this.#root = root;
    this.#globe = globe;
    this.#camera = camera;
    this.#options = options;
    this.#tooltips = [];
    this.#tooltipsContainer = null;
    this.#clickedHexId = null;
    this.#hoveredHexId = null;
    this.#tick();
  }

  get tooltips(): TooltipProperties[] {
    return this.#tooltips;
  }

  set clickedHexId(id: string | null) {
    this.#clickedHexId = id;
  }

  set hoveredHexId(id: string | null) {
    this.#hoveredHexId = id;
  }

  set activeTooltipColors({ backgroundColor, textColor }: ResultColors) {
    this.#options = {
      ...this.#options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
  }

  createTooltips(data: HexData[]): HTMLElement | undefined {
    if (!data.length) return;
    this.#tooltips = data.map(
      ({
        id,
        center,
        country,
        city,
        value,
        valueRank,
        offsetFromCenter,
      }: HexData) => {
        const coordinates = getXYZCoordinates(
          center[0],
          center[1],
          offsetFromCenter
        );
        return new Tooltip(
          id,
          coordinates,
          { width: this.#root.clientWidth, height: this.#root.clientHeight },
          this.#options.tooltipsLimit || data.length,
          value,
          {
            city,
            country,
            mask: this.#globe,
            tooltipActiveBackgroundColor:
              this.#options.tooltipActiveBackgroundColor,
            tooltipActiveTextColor: this.#options.tooltipActiveTextColor,
            valueSuffix: this.#options.valueSuffix,
            valueRank,
          }
        );
      }
    );
    const tooltipsElements = this.#tooltips.map((tooltip) => tooltip.element);
    const tooltipsContainer = document.createElement('div');
    tooltipsContainer.className = classes.tooltips;
    tooltipsContainer.append(...tooltipsElements);
    this.#root.style.position = 'relative';
    this.#root.appendChild(tooltipsContainer);
    this.#tooltipsContainer = tooltipsContainer;
  }

  removeTooltips() {
    if (this.#tooltipsContainer) {
      this.#root.removeChild(this.#tooltipsContainer);
      this.#tooltipsContainer = null;
    }
  }

  // update tooltips reference points distances to the camera
  #updateCameraForTooltips() {
    if (!this.#tooltips) return;
    this.#tooltips.forEach((tooltip) =>
      tooltip.handleCameraUpdate(this.#camera)
    );
  }

  #updateTooltipsOrder() {
    if (!this.#tooltips) return;
    const sortedTooltips = this.#tooltips.sort(
      (a, b) => a.distance - b.distance
    );
    const distances = sortedTooltips
      .map((tooltip) => tooltip.distance)
      .slice(0, this.#options.tooltipsLimit || sortedTooltips.length);

    sortedTooltips.forEach((tooltip, i) => {
      if (
        tooltip.id === this.#hoveredHexId ||
        tooltip.id === this.#clickedHexId
      ) {
        tooltip.show(true);
      } else if (
        typeof this.#options.tooltipsLimit === 'number' &&
        i < this.#options.tooltipsLimit
      ) {
        tooltip.updateOrder(i, Math.min(...distances), Math.max(...distances));
        tooltip.show();
      } else {
        tooltip.hide();
      }
    });
  }

  #tick() {
    this.#updateCameraForTooltips();
    this.#updateTooltipsOrder();

    requestAnimationFrame(() => this.#tick());
  }
}
