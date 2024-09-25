import * as THREE from 'three';

import classes from '../styles/results.module.css';
import EventsManager from './EventsManager';
import Result from './Result';
import Tooltip from './Tooltip';

export default class ResultsManager {
  #root: HTMLElement;
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #options: ResultsOptions;
  #tooltips: Tooltip[];
  #tooltipsContainer: HTMLElement;
  #results: Result[];
  #resultsContainer: HTMLElement;

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
    this.#tick();
  }

  #createResults(data: HexData[], options: ResultsOptions): Result[] {
    return data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => new Result(hexData, options));
  }

  #appendResults(root: HTMLElement, results: Result[]) {
    this.#resultsContainer.className = classes.container;
    results.forEach((result) => {
      if (result) this.#resultsContainer.appendChild(result.resultElement);
    });
    root.appendChild(this.#resultsContainer);
  }

  #createTooltips(data: HexData[]): Tooltip[] {
    return data.map((hexData: HexData) => {
      return new Tooltip(hexData, this.#options, {
        mask: this.#globe,
        sizes: {
          width: this.#root.clientWidth,
          height: this.#root.clientHeight,
        },
        tooltipsLimit: this.#options.tooltipsLimit || data.length,
      });
    });
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
        typeof this.#options.tooltipsLimit === 'number' &&
        i < this.#options.tooltipsLimit
      ) {
        tooltip.updateOrder(i, Math.min(...distances), Math.max(...distances));
      } else {
        tooltip.hide();
      }
    });
  }

  cleanContainers() {
    this.#resultsContainer.innerHTML = '';
    this.#tooltipsContainer.innerHTML = '';
  }

  onUpdate(data: HexData[], eventsManager: EventsManager) {
    this.cleanContainers();

    this.#options = {
      ...this.#options,
      activeBackgroundColor: eventsManager.activeBackgroundColor,
      activeTextColor: eventsManager.activeTextColor,
    };

    this.#results = this.#createResults(data, this.#options);
    this.#appendResults(this.#root, this.#results);
    this.#tooltips = this.#createTooltips(data);
    this.#appendTooltips(this.#root, this.#tooltips);

    eventsManager.results = this.#results;
    eventsManager.tooltips = this.#tooltips;
  }

  #tick() {
    this.#updateCameraForTooltips();
    this.#updateTooltipsOrder();

    requestAnimationFrame(() => this.#tick());
  }
}
