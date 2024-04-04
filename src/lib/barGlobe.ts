import { latLngToCell } from 'h3-js';
import * as THREE from 'three';
import Glob3d from './globe';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import { getHexBin, getNewGeoJson, polar2Cartesian } from './helpers';

interface Opts {
  globeRadius: number;
  hexRes: number;
  hexMargin: number;
  debugMode: boolean;
  highestBar: number;
  barColor?: string;
  barColorHover?: string;
}

export default class BarGlob3d extends Glob3d {
  aggregatedData: HexData[];
  hexMaxValue: number;
  hexResults: any[];
  hexResultsGroup: THREE.Object3D | THREE.Group;
  highestBar: number;
  hoveredHexId: string | null;
  hoveredHexIndex: number;
  hoveredHexObject: THREE.Mesh<any, any> | null;
  raycaster: THREE.Raycaster;
  barColor: string;
  barColorHover: string;
  tooltip: HTMLElement;
  tooltipCity: HTMLElement;
  tooltipCountry: HTMLElement;
  tooltipValue: HTMLElement;

  constructor(root: HTMLElement, opts: Opts) {
    const {
      globeRadius,
      hexRes,
      hexMargin,
      highestBar,
      barColor = '#b6c4fb',
      barColorHover = 'purple',
    } = opts;
    super(root, globeRadius, hexRes, hexMargin);

    this.aggregatedData = [];
    this.hexMaxValue = NaN;
    this.hexResultsGroup = new THREE.Group();
    this.hexResults = [];
    this.highestBar = highestBar;
    this.hoveredHexObject = null;
    this.hoveredHexId = null;
    this.hoveredHexIndex = NaN;
    this.raycaster = new THREE.Raycaster();
    this.barColor = barColor;
    this.barColorHover = barColorHover;
    this.tooltip = this.createTooltip(root);
    this.tooltipCountry = document.querySelector('.tooltip > .country')!;
    this.tooltipCity = document.querySelector('.tooltip > .city')!;
    this.tooltipValue = document.querySelector('.tooltip > .value')!;
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

  visualizeResult(aggregatedData: any[]) {
    const hexResults = aggregatedData.map((bin: any) => {
      return new THREE.Mesh(
        this.updateHexResultsGeometry(bin),
        new THREE.MeshBasicMaterial({
          color: this.barColor,
          opacity: 0.6,
          side: THREE.DoubleSide,
          transparent: true,
        })
      );
    });
    hexResults.forEach((hex: any) => this.hexResultsGroup.add(hex));
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getPixelPositionFromPolarCoords(polarCoordinates: any[]) {
    const { x, y, z } = polar2Cartesian(
      polarCoordinates[0],
      polarCoordinates[1],
      this.globeRadius
    );
    const point = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  createTooltip(root: HTMLElement) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    this.tooltipCountry = document.createElement('p');
    this.tooltipCountry.classList.add('country');
    this.tooltipCity = document.createElement('p');
    this.tooltipCity.classList.add('city');
    this.tooltipValue = document.createElement('p');
    this.tooltipValue.classList.add('value');
    tooltip.appendChild(this.tooltipCountry);
    tooltip.appendChild(this.tooltipCity);
    tooltip.appendChild(this.tooltipValue);
    root.appendChild(tooltip);
    return tooltip;
  }

  handleTooltip() {
    const hoveredHexData = this.aggregatedData[this.hoveredHexIndex];
    const polarCoordinates = hoveredHexData.center;
    const pxPosition = this.getPixelPositionFromPolarCoords(polarCoordinates);
    this.tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
    this.tooltipCountry.textContent = hoveredHexData.country;
    this.tooltipCity.textContent = hoveredHexData.city;
    this.tooltipValue.textContent = `${hoveredHexData.value} people`;
  }

  barTick(): number {
    // handle raycasting
    if (this.hexResults.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);

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

        if (this.hoveredHexId !== hoveredHexId) {
          const hoveredHexIndex = this.hexResults.findIndex(
            (hex: any) => hex.uuid === hoveredHexId
          );
          this.hoveredHexObject &&
            this.hoveredHexObject.material.color.set(this.barColor);
          hoveredHexObject.material.color.set(this.barColorHover);
          hoveredHexObject.material.opacity = 0.9;

          this.hoveredHexObject = hoveredHexObject;
          this.hoveredHexId = hoveredHexId;
          this.hoveredHexIndex = hoveredHexIndex;
          this.tooltip.classList.add('tooltip--visible');

          if (!Number.isNaN(this.hoveredHexIndex)) {
            this.handleTooltip();
          }
        }
      } else {
        this.hoveredHexObject &&
          this.hoveredHexObject.material.color.set(this.barColor);
        this.hoveredHexObject = null;
        this.hoveredHexId = null;
        this.hoveredHexIndex = NaN;
        this.tooltip.classList.remove('tooltip--visible');
      }
    }

    return window.requestAnimationFrame(() => this.barTick());
  }

  clean() {
    this.aggregatedData = [];
    this.hexResults = [];
    this.hoveredHexIndex = NaN;
    this.hexResultsGroup.clear();
    this.tooltip.classList.remove('tooltip--visible');
  }

  update(data: any) {
    console.log('UPDATE');
    this.aggregatedData = this.aggregateData(data);
    this.hexResults = this.visualizeResult(this.aggregatedData);
  }

  initialize(data: any): void {
    super.init();
    this.barTick();
    this.aggregatedData = this.aggregateData(data);
    this.hexMaxValue = Math.max(...this.aggregatedData.map((obj) => obj.value));
    this.hexResults = this.visualizeResult(this.aggregatedData);
  }
}
