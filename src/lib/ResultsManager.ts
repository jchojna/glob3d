import * as THREE from 'three';

import classes from '../styles/results.module.css';
import { getXYZCoordinates } from '../utils/helpers';
import Result from './Result';
import Tooltip from './TooltipElement';

export default class ResultsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #options: ResultsOptions;
  #tooltips: TooltipProperties[];
  #tooltipsContainer: HTMLElement | null;
  #results: HTMLDivElement[];
  #hoveredHexId: string | null;
  #clickedHexId: string | null;

  constructor(
    root: HTMLElement,
    globe: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    options: ResultsOptions
  ) {
    this.#root = root;
    this.#globe = globe;
    this.#camera = camera;
    this.#options = options;
    this.#tooltips = [];
    this.#tooltipsContainer = null;
    this.#results = [];
    this.#hoveredHexId = null;
    this.#clickedHexId = null;
    this.#tick();
  }

  set clickedHexId(id: string | null) {
    this.#clickedHexId = id;
  }

  set hoveredHexId(id: string | null) {
    this.#hoveredHexId = id;
  }

  set activeColors({ backgroundColor, textColor }: ResultColors) {
    this.#options = {
      ...this.#options,
      activeBackgroundColor: backgroundColor,
      activeTextColor: textColor,
    };
  }

  onUpdate(data: HexData[]) {
    this.removeTooltips();
    this.createResults(data, this.#options);
    this.createTooltips(data);
    this.appendResults(this.#root);
  }

  protected createResults(data: HexData[], options: ResultsOptions) {
    this.#results = data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => {
        return new Result(hexData, options).result;
      });
  }

  protected appendResults(root: HTMLElement) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = classes.container;
    this.#results.forEach((result) => {
      if (result) resultsContainer.appendChild(result);
    });
    root.appendChild(resultsContainer);
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
            tooltipActiveBackgroundColor: this.#options.activeBackgroundColor,
            tooltipActiveTextColor: this.#options.activeTextColor,
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
