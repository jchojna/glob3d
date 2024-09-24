import * as THREE from 'three';

import classes from '../styles/results.module.css';
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

  set hoveredHexId(id: string | null) {
    this.#hoveredHexId = id;
  }

  get clickedHexId() {
    return this.#clickedHexId;
  }

  set activeColors({ backgroundColor, textColor }: ResultColors) {
    this.#options = {
      ...this.#options,
      activeBackgroundColor: backgroundColor,
      activeTextColor: textColor,
    };
  }

  #createResults(data: HexData[], options: ResultsOptions): Result[] {
    return data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => new Result(hexData, options, this));
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
      return new Tooltip(hexData, this.#options, this, {
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

  #updateHighlightedResults(objectTypes: (Result[] | Tooltip[])[]) {
    objectTypes.forEach((type) => {
      type.forEach((object) => {
        if (
          object.id === this.#hoveredHexId ||
          object.id === this.#clickedHexId
        ) {
          object.makeActive();
        } else {
          object.show();
        }
      });
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
    this.#updateHighlightedResults([this.#results, this.#tooltips]);

    requestAnimationFrame(() => this.#tick());
  }
}
