import * as THREE from 'three';

import classes from '../styles/results.module.css';
import { getXYZCoordinates } from '../utils/helpers';
import Result from './Result';
import Tooltip from './TooltipElement';

export default class ResultsManager {
  #globe: THREE.Mesh;
  #camera: THREE.PerspectiveCamera;
  #tooltips: TooltipProperties[];
  #tooltipsContainer: HTMLElement | null;
  protected _results: HTMLDivElement[];
  protected _hoveredHexId: string | null;
  protected _clickedHexId: string | null;

  constructor(
    protected _root: HTMLElement,
    globe: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    protected _options: ResultsOptions
  ) {
    this.#globe = globe;
    this.#camera = camera;
    this.#tooltips = [];
    this.#tooltipsContainer = null;
    this._results = [];
    this._hoveredHexId = null;
    this._clickedHexId = null;
    this.#tick();
  }

  get results(): HTMLDivElement[] {
    return this._results;
  }

  set clickedHexId(id: string | null) {
    this._clickedHexId = id;
  }

  set hoveredHexId(id: string | null) {
    this._hoveredHexId = id;
  }

  set activeResultColors({ backgroundColor, textColor }: ResultColors) {
    this._options = {
      ...this._options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
  }

  set activeTooltipColors({ backgroundColor, textColor }: ResultColors) {
    this._options = {
      ...this._options,
      tooltipActiveBackgroundColor: backgroundColor,
      tooltipActiveTextColor: textColor,
    };
  }

  onDataLoad(data: HexData[]) {
    this.createResults(data, this._options);
    this.appendResults(this._root);
  }

  protected createResults(data: HexData[], options: ResultsOptions) {
    this._results = data
      .sort((a, b) => a.valueRank - b.valueRank)
      .map((hexData: HexData) => {
        return new Result(hexData, options).result;
      });
  }

  protected appendResults(root: HTMLElement) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = classes.container;
    this._results.forEach((result) => {
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
          { width: this._root.clientWidth, height: this._root.clientHeight },
          this._options.tooltipsLimit || data.length,
          value,
          {
            city,
            country,
            mask: this.#globe,
            tooltipActiveBackgroundColor:
              this._options.tooltipActiveBackgroundColor,
            tooltipActiveTextColor: this._options.tooltipActiveTextColor,
            valueSuffix: this._options.valueSuffix,
            valueRank,
          }
        );
      }
    );
    const tooltipsElements = this.#tooltips.map((tooltip) => tooltip.element);
    const tooltipsContainer = document.createElement('div');
    tooltipsContainer.className = classes.tooltips;
    tooltipsContainer.append(...tooltipsElements);
    this._root.style.position = 'relative';
    this._root.appendChild(tooltipsContainer);
    this.#tooltipsContainer = tooltipsContainer;
  }

  removeTooltips() {
    if (this.#tooltipsContainer) {
      this._root.removeChild(this.#tooltipsContainer);
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
      .slice(0, this._options.tooltipsLimit || sortedTooltips.length);

    sortedTooltips.forEach((tooltip, i) => {
      if (
        tooltip.id === this._hoveredHexId ||
        tooltip.id === this._clickedHexId
      ) {
        tooltip.show(true);
      } else if (
        typeof this._options.tooltipsLimit === 'number' &&
        i < this._options.tooltipsLimit
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
