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

export default class BarGlob3d extends Glob3d {
  #aggregatedData: HexData[];
  #barColor: string;
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
      barColor,
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
    this.#barColor = barColor;
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
      this.dotRes,
      this.globeRadius,
      this.#highestBar
    ).data;
    this.#visualizeResult(this.#aggregatedData);
  }

  #createBarGeometry() {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    geometry.translate(0, 0.5, 0);
    return geometry;
  }

  #createBarMaterial() {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
    });
    // material.onBeforeCompile = (shader) => {
    //   shader.vertexShader = shader.vertexShader
    //     .replace(
    //       '#include <common>',
    //       `#include <common>
    //        attribute float instanceOpacity;
    //        varying float vInstanceOpacity;`
    //     )
    //     .replace(
    //       '#include <begin_vertex>',
    //       `#include <begin_vertex>
    //        vInstanceOpacity = instanceOpacity;`
    //     );
    //   shader.fragmentShader = shader.fragmentShader
    //     .replace(
    //       '#include <common>',
    //       `#include <common>
    //        varying float vInstanceOpacity;`
    //     )
    //     .replace(
    //       '#elif defined( USE_COLOR )',
    //       '#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )'
    //     )
    //     .replace(
    //       '#include <color_fragment>',
    //       `#include <color_fragment>
    //        diffuseColor.a *= vInstanceOpacity;`
    //     );
    // };
    // material.customProgramCacheKey = () => 'instancedHexBar';
    return material;
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
    _color.set(this.#barColor);
    aggregatedData.forEach((hexData, index) => {
      hexBars.setMatrixAt(index, this.#setBarMatrix(hexData));
      hexBars.setColorAt(index, _color);
      opacities[index] = this.#barOpacity;
    });
    hexBars.instanceMatrix.needsUpdate = true;
    if (hexBars.instanceColor) hexBars.instanceColor.needsUpdate = true;
    hexBars.computeBoundingSphere();

    this.#aggregatedData = aggregatedData.map((hexData, index) => ({
      ...hexData,
      id: String(index),
    }));
    this.#hexBars = hexBars;
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
    _color.set(active ? this.#barActiveColor : this.#barColor);
    this.#hexBars.setColorAt(index, _color);
    if (this.#hexBars.instanceColor) {
      this.#hexBars.instanceColor.needsUpdate = true;
    }
    this.#instanceOpacities.setX(
      index,
      active ? this.#barActiveOpacity : this.#barOpacity
    );
    this.#instanceOpacities.needsUpdate = true;
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
          this.#hoveredHexIndex !== null &&
            this.#hoveredHexIndex !== this.#clickedHexIndex &&
            this.#unhighlightHex(this.#hoveredHexIndex);
          this.#highlightHex(hoveredHexIndex);

          this.#hoveredHexIndex = hoveredHexIndex;
          this.#hoveredHexId = hoveredHexId;
          this.#tooltipsManager.hoveredHexId = hoveredHexId;
        }
      } else {
        this.#hoveredHexIndex !== null &&
          this.#hoveredHexIndex !== this.#clickedHexIndex &&
          this.#unhighlightHex(this.#hoveredHexIndex);
        this.#hoveredHexIndex = null;
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
    if (this.#hoveredHexId !== null && this.#hoveredHexIndex !== null) {
      this.#clickedHexIndex !== null &&
        this.#unhighlightHex(this.#clickedHexIndex);
      this.#clickedHexIndex = this.#hoveredHexIndex;
      this.#tooltipsManager.clickedHexId = this.#hoveredHexId;
      this.#highlightHex(this.#clickedHexIndex);
    } else {
      this.#unhighlightHex(this.#clickedHexIndex);
      this.#clickedHexIndex = null;
      this.#tooltipsManager.clickedHexId = null;
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
    this.#pickableObjects.length = 1;
    this.#intersections.length = 0;
    this.#hoveredHexIndex = null;
    this.#hoveredHexId = null;
    this.#clickedHexIndex = null;
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
