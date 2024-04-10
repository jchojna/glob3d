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

interface Opts {
  barColor?: string;
  barColorHover?: string;
  debugMode?: boolean;
  globeColor?: string;
  globeOpacity?: number;
  globeRadius?: number;
  hexMargin?: number;
  hexRes?: number;
  highestBar?: number;
  tooltipsLimit?: number;
}

type TooltipRefPoint = {
  distance: number;
  id: string;
  vector: THREE.Vector3;
};

export default class BarGlob3d extends Glob3d {
  aggregatedData: HexData[];
  barColor: string;
  barColorHover: string;
  clickedHexObject: THREE.Mesh<any, any> | null;
  hexMaxValue: number;
  hexResults: any[];
  hexResultsGroup: THREE.Object3D | THREE.Group;
  highestBar: number;
  hoveredHexId: string | null;
  hoveredHexIndex: number | null;
  hoveredHexObject: THREE.Mesh<any, any> | null;
  raycaster: THREE.Raycaster;
  tooltips: HTMLElement[];
  tooltipsLimit: number | null;
  tooltipsRaycaster: THREE.Raycaster;
  tooltipsRefPoints: TooltipRefPoint[];

  constructor(root: HTMLElement, opts: Opts) {
    const {
      barColor = defaultOpts.barColor,
      barColorHover = defaultOpts.barColorHover,
      debugMode = defaultOpts.debugMode,
      globeColor = defaultOpts.globeColor,
      globeOpacity = defaultOpts.globeOpacity,
      globeRadius = defaultOpts.globeRadius,
      hexMargin = defaultOpts.hexMargin,
      hexRes = defaultOpts.hexRes,
      highestBar = defaultOpts.highestBar,
      tooltipsLimit = defaultOpts.tooltipsLimit,
    } = opts;
    super(
      root,
      globeColor,
      globeOpacity,
      globeRadius,
      hexRes,
      hexMargin,
      debugMode
    );

    this.aggregatedData = [];
    this.clickedHexObject = null;
    this.hexMaxValue = 1; // neutral value in the implementation
    this.hexResultsGroup = new THREE.Group();
    this.hexResults = [];
    this.highestBar = highestBar;
    this.hoveredHexObject = null;
    this.hoveredHexId = null;
    this.hoveredHexIndex = null;
    this.raycaster = new THREE.Raycaster();
    this.tooltipsRaycaster = new THREE.Raycaster();
    this.barColor = barColor;
    this.barColorHover = barColorHover;
    this.tooltips = [];
    this.tooltipsLimit = tooltipsLimit;
    this.tooltipsRefPoints = [];
  }

  preProcessData(data: GlobeData[]) {
    return data.map(({ city, country, coordinates, value }) => {
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
        value,
      };
    });
  }

  aggregateData(data: GlobeData[]) {
    const processedData = this.preProcessData(data);
    return processedData.reduce(
      (a: any[], b: { city: string; h3Index: any; value: number }) => {
        const idx = a.findIndex(
          (elem: { h3Index: any }) => elem.h3Index === b.h3Index
        );
        if (idx >= 0) {
          a[idx].city += `, ${b.city}`;
          a[idx].value += b.value;
          return a;
        } else {
          return [...a, b];
        }
      },
      []
    );
  }

  updateHexResultsGeometry(bin: HexData) {
    if (!this.hexMaxValue) return;
    return new ConicPolygonGeometry(
      [getNewGeoJson(bin, this.hexMargin)],
      this.globeRadius + 0.1,
      this.globeRadius +
        0.1 +
        (bin.value / this.hexMaxValue) * this.globeRadius * 2 * this.highestBar,
      true,
      true,
      true,
      1
    );
  }

  visualizeResult(aggregatedData: HexData[]) {
    const hexResults = aggregatedData.map((hexData: HexData) => {
      return new THREE.Mesh(
        this.updateHexResultsGeometry(hexData),
        new THREE.MeshBasicMaterial({
          color: this.barColor,
          opacity: 0.6,
          side: THREE.DoubleSide,
          transparent: true,
        })
      );
    });
    this.aggregatedData = this.aggregatedData.map((hexData: HexData, i) => ({
      ...hexData,
      id: hexResults[i].uuid,
    }));
    hexResults.forEach((hex: any) => this.hexResultsGroup.add(hex));
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getOffsetFromCenter(value: number) {
    return (
      this.globeRadius +
      0.1 +
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

  highlightHex(object: THREE.Mesh<any, any> | null) {
    if (!object) return;
    object.material.color.set(this.barColorHover);
    object.material.opacity = 0.9;
  }

  unhighlightHex(object: THREE.Mesh<any, any> | null) {
    if (!object) return;
    object.material.color.set(this.barColor);
    object.material.opacity = 0.6;
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
        )[0].object as THREE.Mesh<any, any>);

      if (hoveredHexObject && hoveredHexObject.uuid !== this.globe.uuid) {
        const hoveredHexId = hoveredHexObject.uuid;

        // on mouse over
        if (this.hoveredHexId !== hoveredHexId) {
          const hoveredHexIndex = this.hexResults.findIndex(
            (hex: any) => hex.uuid === hoveredHexId
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

  update(data: any) {
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