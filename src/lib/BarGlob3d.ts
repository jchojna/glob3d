import * as THREE from 'three';
// @ts-expect-error no types available
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import defaultOpts from '../utils/defaultOpts';
import { getNewGeoJson } from '../utils/helpers';
import DataManager from './DataManager';
import Glob3d from './Glob3d';
import LoaderManager from './LoaderManager';
import TooltipsManager from './TooltipsManager';

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
  #intersections: THREE.Intersection[];
  #loaderManager: LoaderManager;
  #pickableObjects: THREE.Object3D[];
  #projectedGlobePosition: THREE.Vector3;
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
    this.#clickedHexBar = null;
    this.#globePosition = { x: 0, y: 0 };
    this.#projectedGlobePosition = new THREE.Vector3();
    this.#updateGlobePosition();
    this.#hexBars = [];
    this.#hexBarsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredHexId = null;
    this.#hoveredHexBar = null;
    this.#intersections = [];
    this.#loaderManager = new LoaderManager(root);
    this.#pickableObjects = [this.globe];
    this.#raycaster = new THREE.Raycaster();
    this.#tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.#tooltipsLimit = tooltipsLimit;

    if (data !== null) this.#createHexBars(data);
    this.#tooltipsManager = new TooltipsManager(
      root,
      this.globe,
      this.camera,
      this.sizes,
      {
        tooltipActiveBackgroundColor: this.#tooltipActiveBackgroundColor,
        tooltipActiveTextColor,
        tooltipsLimit: this.#tooltipsLimit,
        tooltipValueSuffix,
      }
    );
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
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
    this.#pickableObjects.push(...hexBars);
    if (typeof this.#tooltipsLimit != 'number')
      this.#tooltipsLimit = hexBars.length;
    this.scene.add(this.#hexBarsGroup);
    return hexBars;
  }

  #updateGlobePosition() {
    this.#projectedGlobePosition.copy(this.globe.position).project(this.camera);
    this.#globePosition.x =
      ((this.#projectedGlobePosition.x + 1) / 2) * this.sizes.width;
    this.#globePosition.y =
      ((this.#projectedGlobePosition.y - 1) / 2) * this.sizes.height * -1;
  }

  #highlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barActiveColor);
    object.material.opacity = this.#barActiveOpacity;
    this.requestRender();
  }

  #unhighlightHex(object: HexResult | null) {
    if (!object) return;
    object.material.color.set(this.#barColor);
    object.material.opacity = this.#barOpacity;
    this.requestRender();
  }

  protected override onFrame({
    cameraChanged,
    layoutChanged,
    pointerChanged,
  }: {
    cameraChanged: boolean;
    layoutChanged: boolean;
    pointerChanged: boolean;
  }) {
    if ((cameraChanged || pointerChanged) && this.#hexBars.length > 0) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);
      this.#intersections.length = 0;
      this.#raycaster.intersectObjects(
        this.#pickableObjects,
        false,
        this.#intersections
      );
      const hoveredHexBar =
        this.#intersections.length > 0 &&
        (this.#intersections[0].object as HexResult);

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
          this.#tooltipsManager.hoveredHexId = hoveredHexId;
        }
      } else {
        this.#hoveredHexBar &&
          this.#hoveredHexBar !== this.#clickedHexBar &&
          this.#unhighlightHex(this.#hoveredHexBar);
        this.#hoveredHexBar = null;
        this.#hoveredHexId = null;
        this.#tooltipsManager.hoveredHexId = null;
      }
    }

    if (cameraChanged || layoutChanged) {
      this.#updateGlobePosition();
      this.#loaderManager.updateLoaderPosition(this.#globePosition);
    }
    this.#tooltipsManager.update({ cameraChanged, layoutChanged });
  }

  #registerClickEvent() {
    window.addEventListener('click', this.#handleClick);
  }

  #handleClick = () => {
    if (this.#hoveredHexId) {
      this.#clickedHexBar && this.#unhighlightHex(this.#clickedHexBar);
      this.#clickedHexBar = this.#hoveredHexBar;
      this.#tooltipsManager.clickedHexId = this.#hoveredHexId;
      this.#highlightHex(this.#clickedHexBar);
    } else {
      this.#unhighlightHex(this.#clickedHexBar);
      this.#clickedHexBar = null;
      this.#tooltipsManager.clickedHexId = null;
    }
    this.requestRender();
  };

  #removeHexBars() {
    this.#hexBars.forEach((hexBar) => {
      hexBar.geometry.dispose();
      hexBar.material.dispose();
    });
    this.#hexBarsGroup.clear();
    this.#hexBars = [];
    this.#pickableObjects.length = 1;
    this.#intersections.length = 0;
    this.#hoveredHexBar = null;
    this.#hoveredHexId = null;
    this.#clickedHexBar = null;
    this.requestRender();
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
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutHexes();
  }

  onUpdate(data: GlobeData[]) {
    this.#loaderManager.hideLoader();
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.#createHexBars(data);
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
    this.fadeInHexes();
  }

  onError() {
    this.#loaderManager.showError();
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutHexes();
  }

  protected override onDestroy() {
    window.removeEventListener('click', this.#handleClick);
    this.#removeHexBars();
    this.#tooltipsManager.destroy();
    this.#loaderManager.destroy();
  }
}
