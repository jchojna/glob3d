import { latLngToCell } from 'h3-js';
import * as THREE from 'three';
// @ts-expect-error no types available
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from './defaultOpts';
import Glob3d from './globe';
import {
  getHexBin,
  getNewGeoJson,
  getPixelPosition,
  getXYZCoordinates,
} from './helpers';
import { loaderStyles, tooltipsStyles } from './styles';
import Tooltip from './tooltip';

export default class BarGlob3d extends Glob3d {
  #aggregatedData: HexData[];
  #barColor: string;
  #barOpacity: number;
  #barActiveColor: string;
  #barActiveOpacity: number;
  #clickedHexId: string | null;
  #clickedHexObject: HexResult | null;
  #hexMaxValue: number;
  #hexResults: HexResult[];
  #hexResultsGroup: THREE.Object3D | THREE.Group;
  #highestBar: number;
  #hoveredHexId: string | null;
  #hoveredHexObject: HexResult | null;
  #loader: HTMLElement;
  #raycaster: THREE.Raycaster;
  #tooltips: TooltipProperties[] | null;
  #tooltipActiveBackgroundColor: string;
  #tooltipActiveTextColor: string;
  #tooltipsContainer: HTMLElement | null;
  #tooltipsLimit: number | null;
  #tooltipValueSuffix: string;

  constructor(
    root: HTMLElement,
    data: GlobeData[],
    options: BarGlobeOptions = {}
  ) {
    const {
      barColor = defaultOpts.barColor,
      barOpacity = defaultOpts.barOpacity,
      barActiveColor = defaultOpts.barActiveColor,
      barActiveOpacity = defaultOpts.barActiveOpacity,
      globeColor = defaultOpts.globeColor,
      globeOpacity = defaultOpts.globeOpacity,
      globeRadius = defaultOpts.globeRadius,
      hexPadding = defaultOpts.hexPadding,
      hexRes = defaultOpts.hexRes,
      highestBar = defaultOpts.highestBar,
      tooltipActiveBackgroundColor = defaultOpts.tooltipActiveBackgroundColor,
      tooltipActiveTextColor = defaultOpts.tooltipActiveTextColor,
      tooltipsLimit = defaultOpts.tooltipsLimit,
      tooltipValueSuffix = defaultOpts.tooltipValueSuffix,
    } = options;

    super(root, {
      globeColor,
      globeOpacity,
      globeRadius,
      hexPadding,
      hexRes,
    });

    this.#aggregatedData = [];
    this.#barColor = barColor;
    this.#barOpacity = barOpacity;
    this.#barActiveColor = barActiveColor;
    this.#barActiveOpacity = barActiveOpacity;
    this.#clickedHexId = null;
    this.#clickedHexObject = null;
    this.#hexMaxValue = 1; // neutral value in the implementation
    this.#hexResults = [];
    this.#hexResultsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredHexId = null;
    this.#hoveredHexObject = null;
    this.#loader = this.#getLoader();
    this.#raycaster = new THREE.Raycaster();
    this.#tooltips = null;
    this.#tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.#tooltipActiveTextColor = tooltipActiveTextColor;
    this.#tooltipsContainer = null;
    this.#tooltipsLimit = tooltipsLimit;
    this.#tooltipValueSuffix = tooltipValueSuffix;

    this.#barTick();
    if (data !== null) this.#createHexResults(data);
    this.#createTooltips();
    this.#registerClickEvent();
    this.#updateLoaderPosition();
  }

  #preProcessData(data: GlobeData[]) {
    return data.map(({ city, country, coordinates, value }): HexData => {
      const h3Index = latLngToCell(
        coordinates.lat,
        coordinates.lon,
        this.hexRes
      );
      const hexBin = getHexBin(h3Index);
      return {
        city,
        country,
        coordinates: [coordinates.lat, coordinates.lon],
        ...hexBin,
        id: '',
        value,
      };
    });
  }

  #aggregateData(data: GlobeData[]) {
    return this.#preProcessData(data).reduce(
      (acc: HexData[], curr: HexData) => {
        const idx = acc.findIndex(
          (elem: { h3Index: string }) => elem.h3Index === curr.h3Index
        );
        if (idx >= 0) {
          if (curr.city) acc[idx].city += `, ${curr.city}`;
          acc[idx].value += curr.value;
          return acc;
        } else {
          return [...acc, curr];
        }
      },
      []
    );
  }

  #createHexResults(data: GlobeData[]) {
    this.#aggregatedData = this.#aggregateData(data);
    this.#hexMaxValue = Math.max(
      ...this.#aggregatedData.map((obj) => obj.value)
    );
    this.#hexResults = this.#visualizeResult(this.#aggregatedData);
  }

  #getLoader() {
    const loader = document.createElement('div');
    loader.style.cssText = loaderStyles;
    this.root.appendChild(loader);
    return loader;
  }

  #showLoader(loader: HTMLElement) {
    this.#updateLoaderText(loader, 'Loading...');
    loader.style.visibility = 'visible';
  }

  #hideLoader(loader: HTMLElement) {
    loader.style.visibility = 'hidden';
  }

  #showError(loader: HTMLElement) {
    this.#updateLoaderText(loader, 'Error');
    loader.style.visibility = 'visible';
  }

  #updateLoaderPosition() {
    if (!this.#loader || this.#loader.style.visibility == 'hidden') return;
    const globePosition = getPixelPosition(
      this.globe.position.clone().project(this.camera),
      this.sizes.width,
      this.sizes.height
    );
    this.#loader.style.top = `${globePosition.y}px`;
    this.#loader.style.left = `${globePosition.x}px`;
  }

  #renderHexResultsGeometry(hex: HexData) {
    if (!this.#hexMaxValue) return;
    const offset = this.#getOffsetFromCenter(hex.value);
    return new ConicPolygonGeometry(
      [getNewGeoJson(hex, this.hexPadding)],
      this.globeRadius,
      offset,
      true,
      true,
      true,
      1
    );
  }

  #visualizeResult(aggregatedData: HexData[]) {
    const hexResults = aggregatedData.map((hexData: HexData) => {
      return new THREE.Mesh(
        this.#renderHexResultsGeometry(hexData),
        new THREE.MeshBasicMaterial({
          color: this.#barColor,
          opacity: this.#barOpacity,
          side: THREE.DoubleSide,
          transparent: true,
        })
      );
    });
    this.#aggregatedData = this.#aggregatedData.map((hexData: HexData, i) => ({
      ...hexData,
      id: hexResults[i].uuid,
    }));
    hexResults.forEach((hex: HexResult) => this.#hexResultsGroup.add(hex));
    if (typeof this.#tooltipsLimit != 'number')
      this.#tooltipsLimit = hexResults.length;
    this.scene.add(this.#hexResultsGroup);
    return hexResults;
  }

  #getOffsetFromCenter(value: number): number {
    return (
      this.globeRadius +
      (value / this.#hexMaxValue) * this.globeRadius * 2 * this.#highestBar
    );
  }

  // update tooltips reference points distances to the camera
  #updateCameraForTooltips() {
    if (!this.#tooltips) return;
    this.#tooltips.forEach((tooltip) =>
      tooltip.handleCameraUpdate(this.camera)
    );
  }

  #updateTooltipsOrder() {
    if (!this.#tooltips) return;
    const sortedTooltips = this.#tooltips.sort(
      (a, b) => a.distance - b.distance
    );
    const distances = sortedTooltips
      .map((tooltip) => tooltip.distance)
      .slice(0, this.#tooltipsLimit || sortedTooltips.length);

    sortedTooltips.forEach((tooltip, i) => {
      if (
        tooltip.id === this.#hoveredHexId ||
        tooltip.id === this.#clickedHexId
      ) {
        tooltip.show(true);
      } else if (
        typeof this.#tooltipsLimit === 'number' &&
        i < this.#tooltipsLimit
      ) {
        tooltip.updateOrder(i, Math.min(...distances), Math.max(...distances));
        tooltip.show();
      } else {
        tooltip.hide();
      }
    });
  }

  #getValueRank(value: number, values: number[]): number {
    return values.filter((val: number) => val > value).length + 1;
  }

  // TODO: refactor the method
  #createTooltips() {
    this.#tooltips = this.#aggregatedData.map(
      ({ id, center, country, city, value }: HexData) => {
        const offset = this.#getOffsetFromCenter(value);
        const valueRank = this.#getValueRank(
          value,
          this.#aggregatedData.map((hex) => hex.value)
        );
        const coordinates = getXYZCoordinates(center[0], center[1], offset);
        return new Tooltip(
          id,
          coordinates,
          this.sizes,
          this.#tooltipsLimit || this.#aggregateData.length,
          value,
          {
            city,
            country,
            mask: this.globe,
            tooltipActiveBackgroundColor: this.#tooltipActiveBackgroundColor,
            tooltipActiveTextColor: this.#tooltipActiveTextColor,
            tooltipValueSuffix: this.#tooltipValueSuffix,
            valueRank,
          }
        );
      }
    );
    const tooltipsElements = this.#tooltips.map((tooltip) => tooltip.element);
    const tooltips = document.createElement('div');
    tooltips.style.cssText = tooltipsStyles;
    tooltips.append(...tooltipsElements);
    this.#tooltipsContainer = tooltips;
    this.root.style.position = 'relative';
    this.root.appendChild(tooltips);
  }

  #highlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barActiveColor);
    object.material.opacity = this.#barActiveOpacity;
  }

  #unhighlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barColor);
    object.material.opacity = this.#barOpacity;
  }

  #updateLoaderText(loader: HTMLElement, text: string) {
    loader.innerHTML = text;
  }

  #barTick(): number {
    if (this.#hexResults.length > 0) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);
      this.#updateCameraForTooltips();
      this.#updateTooltipsOrder();

      const intersects = this.#raycaster.intersectObjects([
        this.globe,
        ...this.#hexResults,
      ]);
      const hoveredHexObject =
        intersects.length > 0 &&
        (intersects.sort(
          (a: { distance: number }, b: { distance: number }) =>
            a.distance - b.distance
        )[0].object as HexResult);

      if (hoveredHexObject && hoveredHexObject.uuid !== this.globe.uuid) {
        const hoveredHexId = hoveredHexObject.uuid;

        // on mouse over
        if (this.#hoveredHexId !== hoveredHexId) {
          this.#hoveredHexObject &&
            this.#hoveredHexObject !== this.#clickedHexObject &&
            this.#unhighlightHex(this.#hoveredHexObject);
          this.#highlightHex(hoveredHexObject);

          this.#hoveredHexObject = hoveredHexObject;
          this.#hoveredHexId = hoveredHexId;
        }
      } else {
        this.#hoveredHexObject &&
          this.#hoveredHexObject !== this.#clickedHexObject &&
          this.#unhighlightHex(this.#hoveredHexObject);
        this.#hoveredHexObject = null;
        this.#hoveredHexId = null;
      }
    }
    this.#updateLoaderPosition();

    return window.requestAnimationFrame(() => this.#barTick());
  }

  #registerClickEvent() {
    window.addEventListener('click', () => {
      if (this.#hoveredHexId) {
        this.#clickedHexObject && this.#unhighlightHex(this.#clickedHexObject);
        this.#clickedHexObject = this.#hoveredHexObject;
        this.#clickedHexId = this.#hoveredHexId;
        this.#highlightHex(this.#clickedHexObject);
      } else {
        this.#unhighlightHex(this.#clickedHexObject);
        this.#clickedHexObject = null;
        this.#clickedHexId = null;
      }
    });
  }

  #removeTooltips() {
    if (this.#tooltipsContainer) {
      this.root.removeChild(this.#tooltipsContainer);
      this.#tooltipsContainer = null;
    }
  }

  #removeHexResults() {
    this.#hexResultsGroup.clear();
    this.#hexResults = [];
  }

  onLoading() {
    this.#showLoader(this.#loader);
    this.#removeHexResults();
    this.#removeTooltips();
    this.fadeOutHexes();
  }

  onUpdate(data: GlobeData[]) {
    this.#hideLoader(this.#loader);
    this.#removeHexResults();
    this.#removeTooltips();
    this.#createHexResults(data);
    this.#createTooltips();
    this.fadeInHexes();
  }

  onError() {
    this.#showError(this.#loader);
    this.#removeHexResults();
    this.#removeTooltips();
    this.fadeOutHexes();
  }
}
