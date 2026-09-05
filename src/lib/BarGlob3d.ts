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
  #aggregatedData: HexData[];
  #barBasePositions: Float32Array | null;
  #barFarColor: THREE.Color;
  #barOpacity: number;
  #barActiveColor: string;
  #barActiveOpacity: number;
  #clickedHexIndex: number | null;
  #globePosition: GlobePosition;
  #hexBars: THREE.InstancedMesh | null;
  #hexBarsGroup: THREE.Group;
  #highestBar: number;
  #hoveredHexId: string | null;
  #hoveredHexIndex: number | null;
  #instanceOpacities: THREE.InstancedBufferAttribute | null;
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
      barOpacity,
      barActiveColor,
      barActiveOpacity,
      globeColor,
      globeRadius,
      dotPadding,
      dotRes,
      highestBar,
      tooltipActiveBackgroundColor,
      tooltipActiveTextColor,
      tooltipsLimit,
      tooltipValueSuffix,
    } = { ...defaultOpts, ...options };

    super(root, {
      globeColor,
      globeRadius,
      dotPadding,
      dotRes,
    });

    this.#aggregatedData = [];
    this.#barBasePositions = null;
    this.#barFarColor = new THREE.Color(globeColor);
    this.#barOpacity = barOpacity;
    this.#barActiveColor = barActiveColor;
    this.#barActiveOpacity = barActiveOpacity;
    this.#clickedHexIndex = null;
    this.#globePosition = { x: 0, y: 0 };
    this.#projectedGlobePosition = new THREE.Vector3();
    this.#updateGlobePosition();
    this.#hexBars = null;
    this.#hexBarsGroup = new THREE.Group();
    this.#highestBar = highestBar;
    this.#hoveredHexId = null;
    this.#hoveredHexIndex = null;
    this.#instanceOpacities = null;
    this.#intersections = [];
    this.#loaderManager = new LoaderManager(root);
    this.#pickableObjects = [this.globe];
    this.#raycaster = new THREE.Raycaster();
    this.#tooltipActiveBackgroundColor = tooltipActiveBackgroundColor;
    this.#tooltipsLimit = tooltipsLimit;

    if (data !== null) this.#createHexBars(data);
    this.#tooltipsManager = new TooltipsManager(
      root,
      this.globeRadius,
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
      this.dotRes,
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
    if (!this.#hexBars || !this.#barBasePositions) return;

    const positions = this.#barBasePositions;
    const cameraPos = this.camera.position;
    const minDist = cameraPos.length() - this.globeRadius;
    const maxDist = Math.max(this.globeRadius * 1.5, 0.0001);

    for (let index = 0; index < positions.length / 3; index += 1) {
      const isActive =
        index === this.#hoveredHexIndex || index === this.#clickedHexIndex;

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
      this.#hexBars.setColorAt(index, _color);
    }

    if (this.#hexBars.instanceColor) {
      this.#hexBars.instanceColor.needsUpdate = true;
    }
  }

  #setBarMatrix(hex: HexData) {
    const center = getXYZCoordinates(
      hex.center[0],
      hex.center[1],
      this.globeRadius
    );
    _center.set(center.x, center.y, center.z);
    _localY.copy(_center).normalize();

    const paddedVertices = getNewGeoJson(hex, this.dotPadding);
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

    const height = Math.max(hex.offsetFromCenter - this.globeRadius, 1e-4);
    _matrix.makeBasis(_localX, _localY, _localZ);
    _matrix.scale(_vertex.set(radius, height, radius));
    _matrix.setPosition(_center);
    return _matrix;
  }

  #visualizeResult(aggregatedData: HexData[]) {
    const count = aggregatedData.length;
    const opacities = new Float32Array(count);
    const geometry = this.#createBarGeometry();
    const opacityAttribute = new THREE.InstancedBufferAttribute(opacities, 1);
    geometry.setAttribute('instanceOpacity', opacityAttribute);

    const hexBars = new THREE.InstancedMesh(
      geometry,
      this.#createBarMaterial(),
      count
    );
    const barBasePositions = new Float32Array(count * 3);
    aggregatedData.forEach((hexData, index) => {
      const matrix = this.#setBarMatrix(hexData);
      hexBars.setMatrixAt(index, matrix);
      opacities[index] = this.#barOpacity;
      const offset = index * 3;
      barBasePositions[offset] = matrix.elements[12];
      barBasePositions[offset + 1] = matrix.elements[13];
      barBasePositions[offset + 2] = matrix.elements[14];
    });
    hexBars.instanceMatrix.needsUpdate = true;
    hexBars.computeBoundingSphere();

    this.#aggregatedData = aggregatedData.map((hexData, index) => ({
      ...hexData,
      id: String(index),
    }));
    this.#hexBars = hexBars;
    this.#barBasePositions = barBasePositions;
    this.#updateBarDepthColors();
    this.#instanceOpacities = opacityAttribute;
    this.#hexBarsGroup.add(hexBars);
    this.#pickableObjects.push(hexBars);
    if (typeof this.#tooltipsLimit != 'number') this.#tooltipsLimit = count;
    this.scene.add(this.#hexBarsGroup);
  }

  #updateGlobePosition() {
    this.#projectedGlobePosition.copy(this.globe.position).project(this.camera);
    this.#globePosition.x =
      ((this.#projectedGlobePosition.x + 1) / 2) * this.sizes.width;
    this.#globePosition.y =
      ((this.#projectedGlobePosition.y - 1) / 2) * this.sizes.height * -1;
  }

  #highlightHex(index: number | null) {
    this.#setBarAppearance(index, true);
  }

  #unhighlightHex(index: number | null) {
    this.#setBarAppearance(index, false);
  }

  #setBarAppearance(index: number | null, active: boolean) {
    if (index === null || !this.#hexBars || !this.#instanceOpacities) return;
    this.#instanceOpacities.setX(
      index,
      active ? this.#barActiveOpacity : this.#barOpacity
    );
    this.#instanceOpacities.needsUpdate = true;
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
    if ((cameraChanged || pointerChanged) && this.#hexBars) {
      this.#raycaster.setFromCamera(this.mouse, this.camera);
      this.#intersections.length = 0;
      this.#raycaster.intersectObjects(
        this.#pickableObjects,
        false,
        this.#intersections
      );
      const hit = this.#intersections[0];
      const hoveredHexIndex =
        hit && hit.object !== this.globe && hit.instanceId !== undefined
          ? hit.instanceId
          : null;

      if (hoveredHexIndex !== null) {
        const hoveredHexId = String(hoveredHexIndex);

        if (this.#hoveredHexId !== hoveredHexId) {
          const previousHoveredIndex = this.#hoveredHexIndex;
          this.#hoveredHexIndex = hoveredHexIndex;
          this.#hoveredHexId = hoveredHexId;
          this.#tooltipsManager.hoveredHexId = hoveredHexId;
          previousHoveredIndex !== null &&
            previousHoveredIndex !== this.#clickedHexIndex &&
            this.#unhighlightHex(previousHoveredIndex);
          this.#highlightHex(hoveredHexIndex);
        }
      } else if (this.#hoveredHexIndex !== null) {
        const previousHoveredIndex = this.#hoveredHexIndex;
        this.#hoveredHexIndex = null;
        this.#hoveredHexId = null;
        this.#tooltipsManager.hoveredHexId = null;
        previousHoveredIndex !== this.#clickedHexIndex &&
          this.#unhighlightHex(previousHoveredIndex);
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
    if (this.#hoveredHexId !== null && this.#hoveredHexIndex !== null) {
      const previousClickedIndex = this.#clickedHexIndex;
      this.#clickedHexIndex = this.#hoveredHexIndex;
      this.#tooltipsManager.clickedHexId = this.#hoveredHexId;
      previousClickedIndex !== null &&
        previousClickedIndex !== this.#clickedHexIndex &&
        this.#unhighlightHex(previousClickedIndex);
      this.#highlightHex(this.#clickedHexIndex);
    } else {
      const previousClickedIndex = this.#clickedHexIndex;
      this.#clickedHexIndex = null;
      this.#tooltipsManager.clickedHexId = null;
      this.#unhighlightHex(previousClickedIndex);
    }
    this.requestRender();
  };

  #removeHexBars() {
    this.#hexBarsGroup.clear();
    if (this.#hexBars) {
      this.#hexBars.geometry.dispose();
      (this.#hexBars.material as THREE.Material).dispose();
      this.#hexBars.dispose();
      this.#hexBars = null;
    }
    this.#instanceOpacities = null;
    this.#barBasePositions = null;
    this.#pickableObjects.length = 1;
    this.#intersections.length = 0;
    this.#hoveredHexIndex = null;
    this.#hoveredHexId = null;
    this.#clickedHexIndex = null;
    this.requestRender();
  }

  override setGlobeColor(color: string) {
    super.setGlobeColor(color);
    this.#barFarColor.set(color);
    this.#updateBarDepthColors();
  }

  setActiveColor(color: string) {
    this.#barActiveColor = color;
    this.#tooltipsManager.activeTooltipColors = {
      backgroundColor: color,
      textColor: '#fff',
    };
    this.#updateBarDepthColors();
    this.requestRender();
  }

  onLoading() {
    this.#loaderManager.showLoader();
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutDots();
  }

  onUpdate(data: GlobeData[]) {
    this.#loaderManager.hideLoader();
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.#createHexBars(data);
    this.#tooltipsManager.createTooltips(this.#aggregatedData);
    this.fadeInDots();
  }

  onError() {
    this.#loaderManager.showError();
    this.#removeHexBars();
    this.#tooltipsManager.removeTooltips();
    this.fadeOutDots();
  }

  protected override onDestroy() {
    window.removeEventListener('click', this.#handleClick);
    this.#removeHexBars();
    this.#tooltipsManager.destroy();
    this.#loaderManager.destroy();
  }
}
