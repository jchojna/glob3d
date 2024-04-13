import { latLngToCell } from 'h3-js';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from './defaultOpts';
import Glob3d from './globe';
import { getHexBin, getNewGeoJson, getXYZCoordinates } from './helpers';
import Tooltip from './tooltip';

export default class BarGlob3d extends Glob3d {
  aggregatedData: HexData[];
  barColor: string;
  barOpacity: number;
  barActiveColor: string;
  barActiveOpacity: number;
  clickedHexId: string | null;
  clickedHexObject: HexResult | null;
  hexMaxValue: number;
  hexResults: HexResult[];
  hexResultsGroup: THREE.Object3D | THREE.Group;
  highestBar: number;
  hoveredHexId: string | null;
  hoveredHexObject: HexResult | null;
  raycaster: THREE.Raycaster;
  tooltips: TooltipProperties[] | null;
  tooltipsLimit: number | null;

  constructor(root: HTMLElement, options: BarGlobeOptions) {
    const {
      barColor = defaultOpts.barColor,
      barOpacity = defaultOpts.barOpacity,
      barActiveColor = defaultOpts.barActiveColor,
      barActiveOpacity = defaultOpts.barActiveOpacity,
      debugMode = defaultOpts.debugMode,
      globeColor = defaultOpts.globeColor,
      globeOpacity = defaultOpts.globeOpacity,
      globeRadius = defaultOpts.globeRadius,
      hexMargin = defaultOpts.hexMargin,
      hexRes = defaultOpts.hexRes,
      highestBar = defaultOpts.highestBar,
      tooltipsLimit = defaultOpts.tooltipsLimit,
    } = options;

    super(root, {
      debugMode,
      globeColor,
      globeOpacity,
      globeRadius,
      hexMargin,
      hexRes,
    });

    this.aggregatedData = [];
    this.barColor = barColor;
    this.barOpacity = barOpacity;
    this.barActiveColor = barActiveColor;
    this.barActiveOpacity = barActiveOpacity;
    this.clickedHexId = null;
    this.clickedHexObject = null;
    this.hexMaxValue = 1; // neutral value in the implementation
    this.hexResults = [];
    this.hexResultsGroup = new THREE.Group();
    this.highestBar = highestBar;
    this.hoveredHexId = null;
    this.hoveredHexObject = null;
    this.raycaster = new THREE.Raycaster();
    this.tooltips = null;
    this.tooltipsLimit = tooltipsLimit;
  }

  preProcessData(data: GlobeData[]) {
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

  aggregateData(data: GlobeData[]) {
    return this.preProcessData(data).reduce((acc: HexData[], curr: HexData) => {
      const idx = acc.findIndex(
        (elem: { h3Index: string }) => elem.h3Index === curr.h3Index
      );
      if (idx >= 0) {
        acc[idx].city += `, ${curr.city}`;
        acc[idx].value += curr.value;
        return acc;
      } else {
        return [...acc, curr];
      }
    }, []);
  }

  renderHexResultsGeometry(hex: HexData) {
    if (!this.hexMaxValue) return;
    const offset = this.getOffsetFromCenter(hex.value);
    return new ConicPolygonGeometry(
      [getNewGeoJson(hex, this.hexMargin)],
      this.globeRadius,
      offset,
      true,
      true,
      true,
      1
    );
  }

  visualizeResult(aggregatedData: HexData[]) {
    const hexResults = aggregatedData.map((hexData: HexData) => {
      return new THREE.Mesh(
        this.renderHexResultsGeometry(hexData),
        new THREE.MeshBasicMaterial({
          color: this.barColor,
          opacity: this.barOpacity,
          side: THREE.DoubleSide,
          transparent: true,
        })
      );
    });
    this.aggregatedData = this.aggregatedData.map((hexData: HexData, i) => ({
      ...hexData,
      id: hexResults[i].uuid,
    }));
    hexResults.forEach((hex: HexResult) => this.hexResultsGroup.add(hex));
    if (typeof this.tooltipsLimit != 'number')
      this.tooltipsLimit = hexResults.length;
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getOffsetFromCenter(value: number): number {
    return (
      this.globeRadius +
      (value / this.hexMaxValue) * this.globeRadius * 2 * this.highestBar
    );
  }

  // update tooltips reference points distances to the camera
  updateCameraForTooltips() {
    if (!this.tooltips) return;
    this.tooltips.forEach((tooltip) => tooltip.handleCameraUpdate(this.camera));
  }

  updateTooltipsOrder() {
    if (!this.tooltips) return;
    const sortedTooltips = this.tooltips.sort(
      (a, b) => a.distance - b.distance
    );
    const distances = sortedTooltips
      .map((tooltip) => tooltip.distance)
      .slice(0, this.tooltipsLimit || sortedTooltips.length);

    sortedTooltips.forEach((tooltip, i) => {
      if (
        tooltip.id === this.hoveredHexId ||
        tooltip.id === this.clickedHexId
      ) {
        tooltip.show(true);
      } else if (
        typeof this.tooltipsLimit === 'number' &&
        i < this.tooltipsLimit
      ) {
        tooltip.updateOrder(i, Math.min(...distances), Math.max(...distances));
        tooltip.show();
      } else {
        tooltip.hide();
      }
    });
  }

  createTooltips() {
    this.tooltips = this.aggregatedData.map(
      ({ id, center, country, city, value }: HexData) => {
        const offset = this.getOffsetFromCenter(value);
        const coordinates = getXYZCoordinates(center[0], center[1], offset);
        return new Tooltip(
          id,
          coordinates,
          this.sizes,
          this.tooltipsLimit || this.aggregateData.length,
          value,
          {
            tooltipActiveBackgroundColor: this.barActiveColor,
            tooltipActiveTextColor: '#fff',
            country,
            city,
            mask: this.globe,
          }
        );
      }
    );
    const tooltipsElements = this.tooltips.map((tooltip) => tooltip.element);
    this.root.append(...tooltipsElements);
  }

  highlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.barActiveColor);
    object.material.opacity = this.barActiveOpacity;
  }

  unhighlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.barColor);
    object.material.opacity = this.barOpacity;
  }

  barTick(): number {
    if (this.hexResults.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.updateCameraForTooltips();
      this.updateTooltipsOrder();

      const intersects = this.raycaster.intersectObjects([
        this.globe,
        ...this.hexResults,
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
        if (this.hoveredHexId !== hoveredHexId) {
          this.hoveredHexObject &&
            this.hoveredHexObject !== this.clickedHexObject &&
            this.unhighlightHex(this.hoveredHexObject);
          this.highlightHex(hoveredHexObject);

          this.hoveredHexObject = hoveredHexObject;
          this.hoveredHexId = hoveredHexId;
        }
      } else {
        this.hoveredHexObject &&
          this.hoveredHexObject !== this.clickedHexObject &&
          this.unhighlightHex(this.hoveredHexObject);
        this.hoveredHexObject = null;
        this.hoveredHexId = null;
      }
    }

    return window.requestAnimationFrame(() => this.barTick());
  }

  registerClickEvent() {
    window.addEventListener('click', () => {
      if (this.hoveredHexId) {
        this.clickedHexObject && this.unhighlightHex(this.clickedHexObject);
        this.clickedHexObject = this.hoveredHexObject;
        this.clickedHexId = this.hoveredHexId;
        this.highlightHex(this.clickedHexObject);
      } else {
        this.unhighlightHex(this.clickedHexObject);
        this.clickedHexObject = null;
        this.clickedHexId = null;
      }
    });
  }

  clean() {
    this.aggregatedData = [];
    this.hexResults = [];
    this.hexResultsGroup.clear();
  }

  update(data: GlobeData[]) {
    this.aggregatedData = this.aggregateData(data);
    this.hexResults = this.visualizeResult(this.aggregatedData);
  }

  initialize(data: GlobeData[]): void {
    super.init();
    this.barTick();
    this.aggregatedData = this.aggregateData(data);
    this.hexMaxValue = Math.max(...this.aggregatedData.map((obj) => obj.value));
    this.hexResults = this.visualizeResult(this.aggregatedData);
    this.createTooltips();
    this.registerClickEvent();
  }
}
