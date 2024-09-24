import * as THREE from 'three';
// @ts-expect-error no types available
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from '../utils/defaultOpts';
import { getNewGeoJson, getPixelPosition } from '../utils/helpers';
import DataManager from './DataManager';
import Glob3d from './Glob3d';
import LoaderManager from './LoaderManager';
import ResultsManager from './ResultsManager';

export default class BarGlob3d extends Glob3d {
  #aggregatedData: HexData[];
  #barColor: string;
  #barOpacity: number;
  #barActiveColor: string;
  #barActiveOpacity: number;
  #clickedHexBar: HexResult | null;
  #globePosition: GlobePosition;
  #hexBars: HexResult[];
  #hexBarsGroup: THREE.Object3D | THREE.Group;
  #highestBar: number;
  #hoveredHexId: string | null;
  #hoveredHexBar: HexResult | null;
  #loaderManager: LoaderManager;
  #raycaster: THREE.Raycaster;
  #resultsManager: ResultsManager;
  #tooltipActiveBackgroundColor: string;
  #tooltipActiveTextColor: string;
  #valueSuffix: string;
  #tooltipsLimit: number | null;

  constructor(
    root: HTMLElement,
    data: GlobeData[],
    options: BarGlobeOptions = {}
  ) {
    const {
      barColor,
      barOpacity,
      barActiveColor,
      barActiveOpacity,
      globeColor,
      globeOpacity,
      globeRadius,
      hexPadding,
      hexRes,
      highestBar,
      tooltipActiveBackgroundColor,
      tooltipActiveTextColor,
      tooltipsLimit,
      valueSuffix,
    } = { ...defaultOpts, ...options };

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
    this.#clickedHexBar = null;
    this.#globePosition = this.#getGlobePosition();
    this.#hexBars = [];
    this.#hexBarsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredHexId = null;
    this.#hoveredHexBar = null;
    this.#loaderManager = new LoaderManager(root);
    this.#raycaster = new THREE.Raycaster();
    this.#tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.#tooltipActiveTextColor = tooltipActiveTextColor;
    this.#valueSuffix = valueSuffix;
    this.#tooltipsLimit = tooltipsLimit;

    this.#barTick();
    if (data !== null) this.#createHexBars(data);
    this.#resultsManager = new ResultsManager(root, this.globe, this.camera, {
      activeBackgroundColor: this.#tooltipActiveBackgroundColor,
      activeTextColor: this.#tooltipActiveTextColor,
      tooltipsLimit: this.#tooltipsLimit,
      valueSuffix: this.#valueSuffix,
    });
    this.#registerClickEvent();
    this.#loaderManager.updateLoaderPosition(this.#globePosition);
  }

  #createHexBars(data: GlobeData[]) {
    if (!data.length) return;
    this.#aggregatedData = new DataManager(
      data,
      this.hexRes,
      this.globeRadius,
      this.#highestBar
    ).data;
    this.#hexBars = this.#visualizeResult(this.#aggregatedData);
  }

  #renderHexBarsGeometry(hex: HexData) {
    return new ConicPolygonGeometry(
      [getNewGeoJson(hex, this.hexPadding)],
      this.globeRadius,
      hex.offsetFromCenter,
      true,
      true,
      true,
      1
    );
  }

  #visualizeResult(aggregatedData: HexData[]) {
    const hexBars = aggregatedData.map((hexData: HexData) => {
      return new THREE.Mesh(
        this.#renderHexBarsGeometry(hexData),
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
      id: hexBars[i].uuid,
    }));
    hexBars.forEach((hex: HexResult) => this.#hexBarsGroup.add(hex));
    if (typeof this.#tooltipsLimit != 'number')
      this.#tooltipsLimit = hexBars.length;
    this.scene.add(this.#hexBarsGroup);
    return hexBars;
  }

  #getGlobePosition() {
    return getPixelPosition(
      this.globe.position.clone().project(this.camera),
      this.sizes.width,
      this.sizes.height
    );
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

  #barTick(): number {
    if (this.#hexBars.length > 0) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.#raycaster.intersectObjects([
        this.globe,
        ...this.#hexBars,
      ]);
      const hoveredHexBar =
        intersects.length > 0 &&
        (intersects.sort(
          (a: { distance: number }, b: { distance: number }) =>
            a.distance - b.distance
        )[0].object as HexResult);

      if (hoveredHexBar && hoveredHexBar.uuid !== this.globe.uuid) {
        const hoveredHexId = hoveredHexBar.uuid;

        // on mouse over
        if (this.#hoveredHexId !== hoveredHexId) {
          this.#hoveredHexBar &&
            this.#hoveredHexBar !== this.#clickedHexBar &&
            this.#unhighlightHex(this.#hoveredHexBar);
          this.#highlightHex(hoveredHexBar);

          this.#hoveredHexBar = hoveredHexBar;
          this.#hoveredHexId = hoveredHexId;
          this.#resultsManager.hoveredHexId = hoveredHexId;
        }
      } else {
        this.#hoveredHexBar &&
          this.#hoveredHexBar !== this.#clickedHexBar &&
          this.#unhighlightHex(this.#hoveredHexBar);
        this.#hoveredHexBar = null;
        this.#hoveredHexId = null;
        this.#resultsManager.hoveredHexId = null;
      }
    }
    this.#globePosition = this.#getGlobePosition();
    this.#loaderManager.updateLoaderPosition(this.#globePosition);

    return window.requestAnimationFrame(() => this.#barTick());
  }

  #registerClickEvent() {
    this._canvas.addEventListener('click', () => {
      if (this.#hoveredHexId) {
        this.#clickedHexBar && this.#unhighlightHex(this.#clickedHexBar);
        this.#clickedHexBar = this.#hoveredHexBar;
        this.#resultsManager.clickedHexId = this.#hoveredHexId;
        this.#highlightHex(this.#clickedHexBar);
      } else {
        this.#unhighlightHex(this.#clickedHexBar);
        this.#clickedHexBar = null;
        this.#resultsManager.clickedHexId = null;
      }
    });
  }

  #removeHexBars() {
    this.#hexBarsGroup.clear();
    this.#hexBars = [];
  }

  setActiveColor(color: string) {
    this.#barActiveColor = color;
    this.#resultsManager.activeColors = {
      backgroundColor: color,
      textColor: '#fff',
    };
    this.#resultsManager.onUpdate(this.#aggregatedData);
  }

  onLoading() {
    this.#loaderManager.showLoader();
    this.#removeHexBars();
    this.#resultsManager.cleanContainers();
    this.fadeOutHexes();
  }

  onUpdate(data: GlobeData[]) {
    this.#loaderManager.hideLoader();
    this.#removeHexBars();
    this.#createHexBars(data);
    this.#resultsManager.onUpdate(this.#aggregatedData);
    this.fadeInHexes();
  }

  onError() {
    this.#loaderManager.showError();
    this.#removeHexBars();
    this.#resultsManager.cleanContainers();
    this.fadeOutHexes();
  }
}
