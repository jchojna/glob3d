import * as THREE from 'three';
// @ts-expect-error no types available
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import { aggregateData } from '../utils/dataHandlers';
import defaultOpts from '../utils/defaultOpts';
import { getNewGeoJson, getPixelPosition } from '../utils/helpers';
import Glob3d from './Glob3d';
import LoaderManager from './LoaderManager';
import TooltipsManager from './TooltipsManager';

export default class BarGlob3d extends Glob3d {
  #aggregatedData: HexData[];
  #barColor: string;
  #barOpacity: number;
  #barActiveColor: string;
  #barActiveOpacity: number;
  #clickedHexObject: HexResult | null;
  #globePosition: GlobePosition;
  #hexResults: HexResult[];
  #hexResultsGroup: THREE.Object3D | THREE.Group;
  #highestBar: number;
  #hoveredHexId: string | null;
  #hoveredHexObject: HexResult | null;
  #loaderManager: LoaderManager;
  #raycaster: THREE.Raycaster;
  #tooltipsManager: TooltipsManager;
  #tooltipActiveBackgroundColor: string;
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
      tooltipValueSuffix,
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
    this.#clickedHexObject = null;
    this.#globePosition = this.#getGlobePosition();
    this.#hexResults = [];
    this.#hexResultsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredHexId = null;
    this.#hoveredHexObject = null;
    this.#loaderManager = new LoaderManager(root);
    this.#raycaster = new THREE.Raycaster();
    this.#tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.#tooltipsLimit = tooltipsLimit;

    this.#barTick();
    if (data !== null) this.#createHexResults(data);
    this.#tooltipsManager = new TooltipsManager(root, this.globe, this.camera, {
      tooltipActiveBackgroundColor: this.#tooltipActiveBackgroundColor,
      tooltipActiveTextColor,
      tooltipsLimit: this.#tooltipsLimit,
      tooltipValueSuffix,
    });
    this.#registerClickEvent();
    this.#loaderManager.updateLoaderPosition(this.#globePosition);
  }

  #createHexResults(data: GlobeData[]) {
    if (!data.length) return;
    this.#aggregatedData = aggregateData(
      data,
      this.hexRes,
      this.globeRadius,
      this.#highestBar
    );
    this.#hexResults = this.#visualizeResult(this.#aggregatedData);
  }

  #renderHexResultsGeometry(hex: HexData) {
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
    if (this.#hexResults.length > 0) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);

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
          this.#tooltipsManager.hoveredHexId = hoveredHexId;
        }
      } else {
        this.#hoveredHexObject &&
          this.#hoveredHexObject !== this.#clickedHexObject &&
          this.#unhighlightHex(this.#hoveredHexObject);
        this.#hoveredHexObject = null;
        this.#hoveredHexId = null;
        this.#tooltipsManager.hoveredHexId = null;
      }
    }
    this.#globePosition = this.#getGlobePosition();
    this.#loaderManager.updateLoaderPosition(this.#globePosition);

    return window.requestAnimationFrame(() => this.#barTick());
  }

  #registerClickEvent() {
    window.addEventListener('click', () => {
      if (this.#hoveredHexId) {
        this.#clickedHexObject && this.#unhighlightHex(this.#clickedHexObject);
        this.#clickedHexObject = this.#hoveredHexObject;
        this.#tooltipsManager.clickedHexId = this.#hoveredHexId;
        this.#highlightHex(this.#clickedHexObject);
      } else {
        this.#unhighlightHex(this.#clickedHexObject);
        this.#clickedHexObject = null;
        this.#tooltipsManager.clickedHexId = null;
      }
    });
  }

  #removeHexResults() {
    this.#hexResultsGroup.clear();
    this.#hexResults = [];
  }

  setActiveColor(color: string) {
    this.#barActiveColor = color;
    this.#tooltipsManager.activeTooltipColors = {
      backgroundColor: color,
      textColor: '#fff',
    };
    this.#tooltipsManager.removeTooltips();
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
  }

  onLoading() {
    this.#loaderManager.showLoader();
    this.#removeHexResults();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutHexes();
  }

  onUpdate(data: GlobeData[]) {
    this.#loaderManager.hideLoader();
    this.#removeHexResults();
    this.#tooltipsManager.removeTooltips();
    this.#createHexResults(data);
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
    this.fadeInHexes();
  }

  onError() {
    this.#loaderManager.showError();
    this.#removeHexResults();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutHexes();
  }
}
