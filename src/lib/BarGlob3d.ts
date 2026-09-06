import * as THREE from 'three';

import defaultOpts from '../utils/defaultOpts';
import { getNewGeoJson, getXYZCoordinates } from '../utils/helpers';
import DataManager from './DataManager';
import Glob3d from './Glob3d';
import LoaderManager from './LoaderManager';
import TooltipsManager from './TooltipsManager';

const _center = new THREE.Vector3();
const _color = new THREE.Color();
const _localX = new THREE.Vector3();
const _localY = new THREE.Vector3();
const _localZ = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _vertex = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _nearColor = new THREE.Color(0xffffff);

export default class BarGlob3d extends Glob3d {
  #aggregatedData: BarData[];
  #barBasePositions: Float32Array | null;
  #barFarColor: THREE.Color;
  #barActiveColor: string;
  #clickedBarIndex: number | null;
  #globePosition: GlobePosition;
  #bars: THREE.InstancedMesh | null;
  #barsGroup: THREE.Group;
  #highestBar: number;
  #hoveredBarId: string | null;
  #hoveredBarIndex: number | null;
  #intersections: THREE.Intersection[];
  #loaderManager: LoaderManager;
  #pickableObjects: THREE.Object3D[];
  #projectedGlobePosition: THREE.Vector3;
  #raycaster: THREE.Raycaster;
  #tooltipsManager: TooltipsManager;
  #tooltipsLimit: number | null;

  constructor(
    root: HTMLElement,
    data: GlobeData[],
    options: BarGlobeOptions = {}
  ) {
    const {
      barActiveColor,
      globeColor,
      globeRadius,
      landCellPadding,
      landCellRes,
      highestBar,
      tooltipsLimit,
      tooltipValueSuffix,
    } = { ...defaultOpts, ...options };

    super(root, {
      globeColor,
      globeRadius,
      landCellPadding,
      landCellRes,
    });

    this.#aggregatedData = [];
    this.#barBasePositions = null;
    this.#barFarColor = new THREE.Color(globeColor);
    this.#barActiveColor = barActiveColor;
    this.#clickedBarIndex = null;
    this.#globePosition = { x: 0, y: 0 };
    this.#projectedGlobePosition = new THREE.Vector3();
    this.#updateGlobePosition();
    this.#bars = null;
    this.#barsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredBarId = null;
    this.#hoveredBarIndex = null;
    this.#intersections = [];
    this.#loaderManager = new LoaderManager(root);
    this.#pickableObjects = [this.globe];
    this.#raycaster = new THREE.Raycaster();
    this.#tooltipsLimit = tooltipsLimit;

    if (data !== null) this.#createBars(data);
    this.#tooltipsManager = new TooltipsManager(
      root,
      this.globeRadius,
      this.camera,
      this.sizes,
      {
        accentColor: this.#barActiveColor,
        globeColor,
        tooltipsLimit: this.#tooltipsLimit,
        tooltipValueSuffix,
      }
    );
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
    this.#registerClickEvent();
    this.#loaderManager.updateLoaderPosition(this.#globePosition);
  }

  #createBars(data: GlobeData[]) {
    if (!data.length) return;
    this.#aggregatedData = new DataManager(
      data,
      this.landCellRes,
      this.globeRadius,
      this.#highestBar
    ).data;
    this.#visualizeResult(this.#aggregatedData);
  }

  #createBarGeometry() {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
    geometry.translate(0, 0.5, 0);
    return geometry;
  }

  #createBarMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
  }

  #updateBarDepthColors() {
    if (!this.#bars || !this.#barBasePositions) return;

    const positions = this.#barBasePositions;
    const cameraPos = this.camera.position;
    const minDist = cameraPos.length() - this.globeRadius;
    const maxDist = Math.max(this.globeRadius * 1.5, 0.0001);

    for (let index = 0; index < positions.length / 3; index += 1) {
      const isActive =
        index === this.#hoveredBarIndex || index === this.#clickedBarIndex;

      if (isActive) {
        _color.set(this.#barActiveColor);
      } else {
        _vertex.fromArray(positions, index * 3);
        const depth = THREE.MathUtils.clamp(
          (_vertex.distanceTo(cameraPos) - minDist) / maxDist,
          0,
          1
        );
        _color.copy(_nearColor).lerp(this.#barFarColor, depth * (2 - depth));
      }
      this.#bars.setColorAt(index, _color);
    }

    if (this.#bars.instanceColor) {
      this.#bars.instanceColor.needsUpdate = true;
    }
  }

  #setBarMatrix(bar: BarData) {
    const center = getXYZCoordinates(
      bar.center[0],
      bar.center[1],
      this.globeRadius
    );
    _center.set(center.x, center.y, center.z);
    _localY.copy(_center).normalize();

    const paddedVertices = getNewGeoJson(bar, this.landCellPadding);
    const [firstLng, firstLat] = paddedVertices[0];
    const firstVertex = getXYZCoordinates(firstLat, firstLng, this.globeRadius);
    _localZ.set(firstVertex.x, firstVertex.y, firstVertex.z).sub(_center);
    _localZ.addScaledVector(_localY, -_localZ.dot(_localY));

    let radius = 0;
    for (let i = 0; i < paddedVertices.length; i += 1) {
      const [lng, lat] = paddedVertices[i];
      const vertex = getXYZCoordinates(lat, lng, this.globeRadius);
      _vertex.set(vertex.x, vertex.y, vertex.z).sub(_center);
      _vertex.addScaledVector(_localY, -_vertex.dot(_localY));
      radius += _vertex.length();
    }
    radius = paddedVertices.length > 0 ? radius / paddedVertices.length : 0;
    if (radius < 1e-4) radius = 1e-4;
    if (_localZ.lengthSq() < 1e-8) {
      _localZ.crossVectors(_localY, _worldUp);
      if (_localZ.lengthSq() < 1e-8) _localZ.set(1, 0, 0);
    }
    _localZ.normalize();
    _localX.crossVectors(_localY, _localZ).normalize();

    const height = Math.max(bar.offsetFromCenter - this.globeRadius, 1e-4);
    _matrix.makeBasis(_localX, _localY, _localZ);
    _matrix.scale(_vertex.set(radius, height, radius));
    _matrix.setPosition(_center);
    return _matrix;
  }

  #visualizeResult(aggregatedData: BarData[]) {
    const count = aggregatedData.length;
    const bars = new THREE.InstancedMesh(
      this.#createBarGeometry(),
      this.#createBarMaterial(),
      count
    );
    const barBasePositions = new Float32Array(count * 3);
    aggregatedData.forEach((barData, index) => {
      const matrix = this.#setBarMatrix(barData);
      bars.setMatrixAt(index, matrix);
      const offset = index * 3;
      barBasePositions[offset] = matrix.elements[12];
      barBasePositions[offset + 1] = matrix.elements[13];
      barBasePositions[offset + 2] = matrix.elements[14];
    });
    bars.instanceMatrix.needsUpdate = true;
    bars.computeBoundingSphere();

    this.#aggregatedData = aggregatedData.map((barData, index) => ({
      ...barData,
      id: String(index),
    }));
    this.#bars = bars;
    this.#barBasePositions = barBasePositions;
    this.#updateBarDepthColors();
    this.#barsGroup.add(bars);
    this.#pickableObjects.push(bars);
    if (typeof this.#tooltipsLimit != 'number') this.#tooltipsLimit = count;
    this.scene.add(this.#barsGroup);
  }

  #updateGlobePosition() {
    this.#projectedGlobePosition.copy(this.globe.position).project(this.camera);
    this.#globePosition.x =
      ((this.#projectedGlobePosition.x + 1) / 2) * this.sizes.width;
    this.#globePosition.y =
      ((this.#projectedGlobePosition.y - 1) / 2) * this.sizes.height * -1;
  }

  #refreshBarAppearance() {
    if (!this.#bars) return;
    this.#updateBarDepthColors();
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
    if ((cameraChanged || pointerChanged) && this.#bars) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);
      this.#intersections.length = 0;
      this.#raycaster.intersectObjects(
        this.#pickableObjects,
        false,
        this.#intersections
      );
      const hit = this.#intersections[0];
      const hoveredBarIndex =
        hit && hit.object !== this.globe && hit.instanceId !== undefined
          ? hit.instanceId
          : null;

      if (hoveredBarIndex !== null) {
        const hoveredBarId = String(hoveredBarIndex);

        if (this.#hoveredBarId !== hoveredBarId) {
          this.#hoveredBarIndex = hoveredBarIndex;
          this.#hoveredBarId = hoveredBarId;
          this.#tooltipsManager.hoveredBarId = hoveredBarId;
          this.#refreshBarAppearance();
        }
      } else if (this.#hoveredBarIndex !== null) {
        const previousHoveredIndex = this.#hoveredBarIndex;
        this.#hoveredBarIndex = null;
        this.#hoveredBarId = null;
        this.#tooltipsManager.hoveredBarId = null;
        if (previousHoveredIndex !== this.#clickedBarIndex) {
          this.#refreshBarAppearance();
        }
      }
    }

    if (cameraChanged) this.#updateBarDepthColors();
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
    if (this.#hoveredBarId !== null && this.#hoveredBarIndex !== null) {
      this.#clickedBarIndex = this.#hoveredBarIndex;
      this.#tooltipsManager.clickedBarId = this.#hoveredBarId;
    } else {
      this.#clickedBarIndex = null;
      this.#tooltipsManager.clickedBarId = null;
    }
    this.#refreshBarAppearance();
  };

  #removeBars() {
    this.#barsGroup.clear();
    if (this.#bars) {
      this.#bars.geometry.dispose();
      (this.#bars.material as THREE.Material).dispose();
      this.#bars.dispose();
      this.#bars = null;
    }
    this.#barBasePositions = null;
    this.#pickableObjects.length = 1;
    this.#intersections.length = 0;
    this.#hoveredBarIndex = null;
    this.#hoveredBarId = null;
    this.#clickedBarIndex = null;
    this.requestRender();
  }

  override setGlobeColor(color: string) {
    super.setGlobeColor(color);
    this.#barFarColor.set(color);
    this.#tooltipsManager.globeColor = color;
    this.#updateBarDepthColors();
  }

  setActiveColor(color: string) {
    this.#barActiveColor = color;
    this.#tooltipsManager.accentColor = color;
    this.#updateBarDepthColors();
    this.requestRender();
  }

  onLoading() {
    this.#loaderManager.showLoader();
    this.#removeBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutLandCells();
  }

  onUpdate(data: GlobeData[]) {
    this.#loaderManager.hideLoader();
    this.#removeBars();
    this.#tooltipsManager.removeTooltips();
    this.#createBars(data);
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
    this.fadeInLandCells();
  }

  onError() {
    this.#loaderManager.showError();
    this.#removeBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutLandCells();
  }

  protected override onDestroy() {
    window.removeEventListener('click', this.#handleClick);
    this.#removeBars();
    this.#tooltipsManager.destroy();
    this.#loaderManager.destroy();
  }
}
