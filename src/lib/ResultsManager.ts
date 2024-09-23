import * as THREE from 'three';

import classes from '../styles/results.module.css';
import { getXYZCoordinates } from '../utils/helpers';
import Result from './Result';
import Tooltip from './Tooltip';

export default class ResultsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #options: ResultsOptions;
  #tooltips: TooltipProperties[];
  #tooltipsContainer: HTMLElement;
  #results: HTMLDivElement[];
  #resultsContainer: HTMLElement;
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
    this.#tooltipsContainer = document.createElement('div');
    this.#results = [];
    this.#resultsContainer = document.createElement('div');
    this.#hoveredHexId = null;
    this.#clickedHexId = null;
    this.#tick();
  }

  set clickedHexId(id: string | null) {
    this.#clickedHexId = id;
  }

  get clickedHexId() {
    return this.#clickedHexId;
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

  set results(elements: HTMLDivElement[]) {
    this.#results = elements;
  }

  #createResults(data: HexData[], options: ResultsOptions) {
    return data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => {
        return new Result(hexData, options).result;
      });
  }

  #appendResults(root: HTMLElement, results: HTMLDivElement[]) {
    this.#resultsContainer.className = classes.container;
    results.forEach((result) => {
      if (result) this.#resultsContainer.appendChild(result);
    });
    root.appendChild(this.#resultsContainer);
  }

  #createTooltips(data: HexData[]): TooltipProperties[] {
    return data.map(
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
  }

  #appendTooltips(root: HTMLElement, tooltips: TooltipProperties[]) {
    this.#tooltipsContainer.className = classes.tooltips;
    root.style.position = 'relative';
    root.style.overflow = 'hidden';
    tooltips.forEach((tooltip) => {
      if (tooltip) this.#tooltipsContainer.appendChild(tooltip.element);
    });
    root.appendChild(this.#tooltipsContainer);
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

  cleanContainers() {
    this.#resultsContainer.innerHTML = '';
    this.#tooltipsContainer.innerHTML = '';
  }

  onUpdate(data: HexData[]) {
    this.cleanContainers();
    this.#results = this.#createResults(data, this.#options);
    this.#appendResults(this.#root, this.#results);
    this.#tooltips = this.#createTooltips(data);
    this.#appendTooltips(this.#root, this.#tooltips);
  }

  #tick() {
    this.#updateCameraForTooltips();
    this.#updateTooltipsOrder();

    requestAnimationFrame(() => this.#tick());
  }
}
