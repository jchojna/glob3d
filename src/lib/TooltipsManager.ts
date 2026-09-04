import * as THREE from 'three';

import { getXYZCoordinates } from '../utils/helpers';
import { tooltipsStyles } from '../utils/styles';
import Tooltip from './TooltipElement';

type TooltipsOptions = {
  tooltipActiveBackgroundColor: string;
  tooltipActiveTextColor: string;
  tooltipValueSuffix: string;
  tooltipsLimit: number;
};

type TooltipColors = {
  backgroundColor: string;
  textColor: string;
};

export default class TooltipsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #options: TooltipsOptions;
  #sizes: { width: number; height: number };
  #tooltips: TooltipProperties[];
  #tooltipsContainer: HTMLElement | null;
  #clickedHexId: string | null;
  #dirty: boolean;
  #hoveredHexId: string | null;

  constructor(
    root: HTMLElement,
    globe: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    sizes: { width: number; height: number },
    options: TooltipsOptions
  ) {
    this.#root = root;
    this.#globe = globe;
    this.#camera = camera;
    this.#sizes = sizes;
    this.#options = options;
    this.#tooltips = [];
    this.#tooltipsContainer = null;
    this.#clickedHexId = null;
    this.#dirty = true;
    this.#hoveredHexId = null;
  }

  get tooltips(): TooltipProperties[] {
    return this.#tooltips;
  }

  set clickedHexId(id: string | null) {
    if (this.#clickedHexId === id) return;
    this.#clickedHexId = id;
    this.#dirty = true;
  }

  set hoveredHexId(id: string | null) {
    if (this.#hoveredHexId === id) return;
    this.#hoveredHexId = id;
    this.#dirty = true;
  }

  set activeTooltipColors({ backgroundColor, textColor }: TooltipColors) {
    this.#options = {
      ...this.#options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
    this.#dirty = true;
  }

  // TODO: refactor the method
  createTooltips(data: HexData[]): HTMLElement | undefined {
    if (!data.length) return;
    this.#tooltips = data.map(
      ({ id, center, country, city, value, offsetFromCenter }: HexData) => {
        const valueRank = this.#getValueRank(
          value,
          data.map((hex) => hex.value)
        );
        const coordinates = getXYZCoordinates(
          center[0],
          center[1],
          offsetFromCenter
        );
        return new Tooltip(
          id,
          coordinates,
          this.#sizes,
          this.#options.tooltipsLimit || data.length,
          value,
          {
            city,
            country,
            mask: this.#globe,
            tooltipActiveBackgroundColor:
              this.#options.tooltipActiveBackgroundColor,
            tooltipActiveTextColor: this.#options.tooltipActiveTextColor,
            tooltipValueSuffix: this.#options.tooltipValueSuffix,
            valueRank,
          }
        );
      }
    );
    const tooltipsElements = this.#tooltips.map((tooltip) => tooltip.element);
    const tooltipsContainer = document.createElement('div');
    tooltipsContainer.style.cssText = tooltipsStyles;
    tooltipsContainer.append(...tooltipsElements);
    this.#root.appendChild(tooltipsContainer);
    this.#tooltipsContainer = tooltipsContainer;
    this.#dirty = true;
  }

  removeTooltips() {
    this.#tooltipsContainer?.remove();
    this.#tooltipsContainer = null;
    this.#tooltips = [];
    this.#clickedHexId = null;
    this.#hoveredHexId = null;
    this.#dirty = false;
  }

  #getValueRank(value: number, values: number[]): number {
    return values.filter((val: number) => val > value).length + 1;
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
    const limit = this.#options.tooltipsLimit || sortedTooltips.length;
    let minDistance = Infinity;
    let maxDistance = -Infinity;
    for (let i = 0; i < Math.min(limit, sortedTooltips.length); i += 1) {
      minDistance = Math.min(minDistance, sortedTooltips[i].distance);
      maxDistance = Math.max(maxDistance, sortedTooltips[i].distance);
    }

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
        tooltip.updateOrder(i, minDistance, maxDistance);
        tooltip.show();
      } else {
        tooltip.hide();
      }
    });
  }

  #syncOverlaySize() {
    if (!this.#tooltipsContainer) return;
    this.#tooltipsContainer.style.width = `${this.#sizes.width}px`;
    this.#tooltipsContainer.style.height = `${this.#sizes.height}px`;
  }

  update({
    cameraChanged,
    layoutChanged,
  }: {
    cameraChanged: boolean;
    layoutChanged: boolean;
  }) {
    if (layoutChanged) this.#syncOverlaySize();
    if (cameraChanged || layoutChanged) {
      this.#updateCameraForTooltips();
      this.#dirty = true;
    }
    if (this.#dirty) {
      this.#updateTooltipsOrder();
      this.#dirty = false;
    }
  }

  destroy() {
    this.removeTooltips();
  }
}
