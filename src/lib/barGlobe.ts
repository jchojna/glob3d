import { latLngToCell } from 'h3-js';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from './defaultOpts';
import Glob3d from './globe';
import {
  getHexBin,
  getNewGeoJson,
  getTooltip,
  getXYZCoordinates,
} from './helpers';

type TooltipRefPoint = {
  distance: number;
  id: string;
  vector: THREE.Vector3;
};

type HexResult = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export default class BarGlob3d extends Glob3d {
  aggregatedData: HexData[];
  barColor: string;
  barOpacity: number;
  barActiveColor: string;
  barActiveOpacity: number;
  clickedHexObject: HexResult | null;
  hexMaxValue: number;
  hexResults: HexResult[];
  hexResultsGroup: THREE.Object3D | THREE.Group;
  highestBar: number;
  hoveredHexId: string | null;
  hoveredHexIndex: number | null;
  hoveredHexObject: HexResult | null;
  raycaster: THREE.Raycaster;
  tooltips: HTMLElement[];
  tooltipsLimit: number | null;
  tooltipsRaycaster: THREE.Raycaster;
  tooltipsRefPoints: TooltipRefPoint[];

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
    this.clickedHexObject = null;
    this.hexMaxValue = 1; // neutral value in the implementation
    this.hexResults = [];
    this.hexResultsGroup = new THREE.Group();
    this.highestBar = highestBar;
    this.hoveredHexId = null;
    this.hoveredHexIndex = null;
    this.hoveredHexObject = null;
    this.raycaster = new THREE.Raycaster();
    this.tooltips = [];
    this.tooltipsLimit = tooltipsLimit;
    this.tooltipsRaycaster = new THREE.Raycaster();
    this.tooltipsRefPoints = [];
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
    const processedData = this.preProcessData(data);
    return processedData.reduce((a: HexData[], b: HexData) => {
      const idx = a.findIndex(
        (elem: { h3Index: string }) => elem.h3Index === b.h3Index
      );
      if (idx >= 0) {
        a[idx].city += `, ${b.city}`;
        a[idx].value += b.value;
        return a;
      } else {
        return [...a, b];
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
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getOffsetFromCenter(value: number) {
    return (
      this.globeRadius +
      (value / this.hexMaxValue) * this.globeRadius * 2 * this.highestBar
    );
  }

  getPixelPosition(point: { x: number; y: number }) {
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  // update z order of tooltips
  updateTooltipsDistances() {
    this.tooltipsRefPoints = this.tooltipsRefPoints.map((hex) => ({
      ...hex,
      distance: hex.vector.distanceTo(this.camera.position),
    }));
  }

  setTooltipsAnchors(data: HexData[]) {
    if (!data) return;
    this.tooltipsRefPoints = data.map((hexData: HexData) => {
      const polarCoordinates = hexData.center;
      const offset = this.getOffsetFromCenter(hexData.value);
      const { x, y, z } = getXYZCoordinates(
        polarCoordinates[0],
        polarCoordinates[1],
        offset
      );
      const vector = new THREE.Vector3(x, y, z);
      return {
        id: hexData.id,
        vector,
        distance: vector.distanceTo(this.camera.position),
      };
    });
  }

  getTooltipScale = (
    distance: number,
    minDistance: number,
    maxDistance: number
  ) => {
    return ((maxDistance - distance) / (maxDistance - minDistance)) * 0.5 + 0.5;
  };

  updateTooltipVisibility() {
    const totalTooltips = Math.min(10, this.tooltipsRefPoints.length);
    const sortedVectors = this.tooltipsRefPoints.sort(
      (a, b) => a.distance - b.distance
    );
    if (sortedVectors.length === 0) return;

    const minDistance = sortedVectors[0].distance;
    const maxDistance = sortedVectors[totalTooltips - 1].distance;

    this.tooltipsRefPoints.forEach((hex, i) => {
      const zIndex = this.tooltipsRefPoints.length - i;
      const tooltip = this.tooltips.find(
        (tooltip) => tooltip.id === `tooltip-${hex.id}`
      );
      if (!tooltip) return;
      if (i < totalTooltips) {
        const tooltipScale = this.getTooltipScale(
          hex.distance,
          minDistance,
          maxDistance
        );
        tooltip.classList.add('visible');
        if (hex.id !== this.hoveredHexId) {
          tooltip.style.transform = `${tooltip.style.transform} scale(${tooltipScale})`;
          // update z-index
        } else {
          tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
        }
      } else {
        tooltip.classList.remove('visible');
        if (hex.id !== this.hoveredHexId) {
          tooltip.style.transform = `${tooltip.style.transform} scale(0)`;
          // update z-index
        } else {
          tooltip.classList.add('visible');
          tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
        }
      }
      tooltip.style.zIndex = String(zIndex);
    });
  }

  createTooltips() {
    let data = this.aggregatedData.sort((a, b) => b.value - a.value);
    if (this.tooltipsLimit !== null) data = data.slice(0, this.tooltipsLimit);
    this.setTooltipsAnchors(data);
    this.tooltips = data.map(({ id, country, city, value }: HexData) => {
      const tooltip = getTooltip(id, country, city, value);
      this.root.appendChild(tooltip);
      return tooltip;
    });
  }

  handleTooltips() {
    this.tooltips.forEach((tooltip: HTMLElement, i: number) => {
      const hexData = this.aggregatedData[i];
      const polarCoordinates = hexData.center;
      const offset = this.getOffsetFromCenter(hexData.value);
      if (!offset) return;
      const { x, y, z } = getXYZCoordinates(
        polarCoordinates[0],
        polarCoordinates[1],
        offset
      );
      const point = new THREE.Vector3(x, y, z).project(this.camera);
      this.tooltipsRaycaster.setFromCamera(
        new THREE.Vector2(point.x, point.y),
        this.camera
      );

      const intersectObjects = this.tooltipsRaycaster.intersectObject(
        this.globe
      );
      const isBehindGlobe =
        intersectObjects.length > 0 &&
        intersectObjects[0].distance <
          new THREE.Vector3(x, y, z).distanceTo(this.camera.position);

      const pxPosition = this.getPixelPosition(point);
      tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
      if (isBehindGlobe) {
        tooltip.classList.remove('visible');
      } else {
        tooltip.classList.add('visible');
      }
    });
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
    // handle raycasting
    if (this.hexResults.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.handleTooltips();

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
          const hoveredHexIndex = this.hexResults.findIndex(
            (hex: HexResult) => hex.uuid === hoveredHexId
          );
          this.hoveredHexObject &&
            this.hoveredHexObject !== this.clickedHexObject &&
            this.unhighlightHex(this.hoveredHexObject);
          this.highlightHex(hoveredHexObject);

          this.hoveredHexObject = hoveredHexObject;
          this.hoveredHexId = hoveredHexId;
          this.hoveredHexIndex = hoveredHexIndex;
          this.tooltips
            .find((tooltip) => tooltip.id === `tooltip-${hoveredHexId}`)!
            .classList.add('visible');
        }
      } else {
        this.hoveredHexObject &&
          this.hoveredHexObject !== this.clickedHexObject &&
          this.unhighlightHex(this.hoveredHexObject);
        this.hoveredHexObject = null;
        this.hoveredHexId = null;
        this.hoveredHexIndex = null;
        // !this.clickedHexObject &&
        //   this.tooltip.classList.remove('tooltip--visible');
      }
    }
    this.updateTooltipsDistances();
    this.updateTooltipVisibility();

    return window.requestAnimationFrame(() => this.barTick());
  }

  clean() {
    this.aggregatedData = [];
    this.hexResults = [];
    this.hoveredHexIndex = null;
    this.hexResultsGroup.clear();
    // this.tooltip.classList.remove('tooltip--visible');
  }

  update(data: GlobeData[]) {
    console.log('UPDATE');
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

    window.addEventListener('click', () => {
      if (this.hoveredHexId) {
        this.clickedHexObject && this.unhighlightHex(this.clickedHexObject);
        this.clickedHexObject = this.hoveredHexObject;
        this.highlightHex(this.clickedHexObject);
      } else {
        this.unhighlightHex(this.clickedHexObject);
        this.clickedHexObject = null;
      }
    });
  }
}
