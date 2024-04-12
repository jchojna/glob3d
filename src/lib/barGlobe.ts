import { latLngToCell } from 'h3-js';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from './defaultOpts';
import Glob3d from './globe';
import {
  getHexBin,
  getNewGeoJson,
  getTooltipScale,
  getXYZCoordinates,
} from './helpers';
import Tooltip from './tooltip';

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
  tooltips;
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
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getOffsetFromCenter(value: number) {
    return (
      this.globeRadius +
      (value / this.hexMaxValue) * this.globeRadius * 2 * this.highestBar
    );
  }

  // get pixel position from normalized device coordinates
  getPixelPosition(point: { x: number; y: number }) {
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  // update tooltips reference points distances to the camera
  updateTooltipsDistances() {
    this.tooltips.forEach((tooltip) =>
      tooltip.setDistance(this.camera.position)
    );
  }

  createTooltips() {
    let data = this.aggregatedData.sort((a, b) => b.value - a.value);
    if (this.tooltipsLimit !== null) data = data.slice(0, this.tooltipsLimit);
    this.tooltips = data.map(
      ({ id, center, country, city, value }: HexData) => {
        const offset = this.getOffsetFromCenter(value);
        if (!offset) return;
        const coordinates = getXYZCoordinates(center[0], center[1], offset);
        return new Tooltip(id, country, city, value, coordinates);
      }
    );
    const tooltipsElements = this.tooltips.map(
      (tooltip) => tooltip.tooltipElement
    );
    this.root.append(...tooltipsElements);
  }

  handleTooltips() {
    this.tooltips.forEach((tooltip) => {
      const point = tooltip.coordinates.clone().project(this.camera);
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
          tooltip.coordinates.distanceTo(this.camera.position);

      const pxPosition = this.getPixelPosition(point);
      tooltip.tooltipElement.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
      if (isBehindGlobe) {
        tooltip.tooltipElement.classList.remove('visible');
      } else {
        tooltip.tooltipElement.classList.add('visible');
      }
    });
  }

  updateTooltipVisibility() {
    const totalTooltips = Math.min(10, this.tooltipsRefPoints.length);
    const sortedVectors = this.tooltipsRefPoints.sort(
      (a, b) => a.distance - b.distance
    );
    if (sortedVectors.length === 0) return;

    const minDistance = sortedVectors[0].distance;
    const maxDistance = sortedVectors[totalTooltips - 1].distance;

    // this.tooltipsRefPoints.forEach((hex, i) => {
    //   const zIndex = this.tooltipsRefPoints.length - i;
    //   const tooltip = this.tooltips.find(
    //     (tooltip) => tooltip.id === `tooltip-${hex.id}`
    //   );
    //   if (!tooltip) return;
    //   if (i < totalTooltips) {
    //     const tooltipScale = getTooltipScale(
    //       hex.distance,
    //       minDistance,
    //       maxDistance
    //     );
    //     tooltip.classList.add('visible');
    //     if (hex.id !== this.hoveredHexId) {
    //       tooltip.style.transform = `${tooltip.style.transform} scale(${tooltipScale})`;
    //       // update z-index
    //     } else {
    //       tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
    //     }
    //   } else {
    //     tooltip.classList.remove('visible');
    //     if (hex.id !== this.hoveredHexId) {
    //       tooltip.style.transform = `${tooltip.style.transform} scale(0)`;
    //       // update z-index
    //     } else {
    //       tooltip.classList.add('visible');
    //       tooltip.style.transform = `${tooltip.style.transform} scale(1)`;
    //     }
    //   }
    //   tooltip.style.zIndex = String(zIndex);
    // });
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
      this.updateTooltipsDistances();
      this.handleTooltips();
      // this.updateTooltipVisibility();

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
          // this.tooltips
          //   .find((tooltip) => tooltip.id === `tooltip-${hoveredHexId}`)!
          //   .classList.add('visible');
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

    return window.requestAnimationFrame(() => this.barTick());
  }

  registerClickEvent() {
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
    this.registerClickEvent();
  }
}
