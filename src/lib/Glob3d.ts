import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// @ts-expect-error missing types
import world from 'world-map-geojson';

import matcap from '../assets/textures/matcap_1.png';
import type { GlobeOptions } from '../types';
import defaultOpts from '../utils/defaultOpts';
import {
  getH3Indexes,
  getLandCell,
  getNewGeoJson,
  getXYZCoordinates,
} from '../utils/helpers';

const _center = new THREE.Vector3();
const _localX = new THREE.Vector3();
const _localY = new THREE.Vector3();
const _localZ = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _vertex = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

export default class Glob3d {
  // private fields
  #animationFrameId: number | null;
  #aspectRatio: number;
  #canvas: HTMLElement;
  #controls: OrbitControls;
  #destroyed: boolean;
  #frameDirty: boolean;
  #layoutDirty: boolean;
  #pointerClientX: number | null;
  #pointerClientY: number | null;
  #pointerDirty: boolean;
  #renderer: THREE.WebGLRenderer;
  #resizeObserver!: ResizeObserver;
  #rootBounds: DOMRect;
  #textureLoader: THREE.TextureLoader;

  // public fields
  camera: THREE.PerspectiveCamera;
  globe: THREE.Mesh;
  globeColor: string;
  globeRadius: number;
  landCellGlobe: THREE.InstancedMesh | null;
  landCellPadding: number;
  landCellRes: number;
  mouse: THREE.Vector2;
  root: HTMLElement;
  scene: THREE.Scene;
  sizes: { width: number; height: number };

  constructor(root: HTMLElement, options: GlobeOptions = {}) {
    const {
      globeColor = defaultOpts.globeColor,
      globeRadius = defaultOpts.globeRadius,
      landCellPadding = defaultOpts.landCellPadding,
      landCellRes = defaultOpts.landCellRes,
      autoRotate = defaultOpts.autoRotate,
    } = options;

    this.root = root;
    this.root.style.position = 'relative';
    this.root.style.overflow = 'hidden';
    this.#animationFrameId = null;
    this.#aspectRatio = root.clientWidth / root.clientHeight;
    this.#canvas = this.#createCanvas(this.root);
    this.#destroyed = false;
    this.#frameDirty = true;
    this.#layoutDirty = true;
    this.#pointerClientX = null;
    this.#pointerClientY = null;
    this.#pointerDirty = true;
    this.#rootBounds = this.root.getBoundingClientRect();
    this.#textureLoader = new THREE.TextureLoader();
    this.#renderer = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.#canvas,
      antialias: true,
    });

    this.globeColor = globeColor;
    this.globeRadius = globeRadius;
    this.landCellGlobe = null;
    this.landCellPadding = Math.max(0, Math.min(landCellPadding, 1));
    this.landCellRes = Math.max(1, Math.min(landCellRes, 5));
    this.mouse = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.sizes = {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    };

    // solid globe
    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(this.globeRadius, 48, 48),
      new THREE.MeshBasicMaterial({
        color: this.globeColor,
      })
    );
    this.scene.add(this.globe);

    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.#aspectRatio, 1, 1000);
    this.camera.position.z = 240;
    this.camera.position.y = 240;
    this.scene.add(this.camera);

    this.#controls = new OrbitControls(this.camera, this.#canvas);
    this.#controls.autoRotate = autoRotate;
    this.#controls.autoRotateSpeed = 0.1;
    this.#controls.enableDamping = true;

    this.#renderer.setSize(this.sizes.width, this.sizes.height);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.render(this.scene, this.camera);

    this.#createLandCellGlobe();
    this.#registerMouseMoveEvent();
    this.#registerResizeEvent();
    this.#animationFrameId = window.requestAnimationFrame(this.#tick);
  }

  #createCanvas(root: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.outline = 'none';
    canvas.style.userSelect = 'none';
    root.appendChild(canvas);
    return canvas;
  }

  #createLandCellGlobe() {
    const h3Indexes = getH3Indexes(world.features, this.landCellRes);
    const material = new THREE.MeshMatcapMaterial({
      opacity: 1,
      transparent: true,
    });
    // TODO: should it be possible to set other matcap textures?
    material.matcap = this.#textureLoader.load(matcap);
    const landCells = h3Indexes.map((index) => getLandCell(index));
    this.landCellGlobe = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 24),
      material,
      landCells.length
    );
    this.#updateLandCellGlobeInstances(landCells);
    this.scene.add(this.landCellGlobe);
    this.requestRender();
  }

  #getLandCellOffsetFromGlobe(radius: number, landCellRes: number) {
    return radius * (Math.pow(5, 5) - Math.pow(landCellRes, 5)) * 0.000001;
  }

  #updateLandCellGlobeInstances(landCells: LandCell[]) {
    const landCellGlobe = this.landCellGlobe;
    if (!landCellGlobe || !landCells.length) return;

    const offset = this.#getLandCellOffsetFromGlobe(
      this.globeRadius,
      this.landCellRes
    );
    landCells.forEach((landCell, index) => {
      landCellGlobe.setMatrixAt(index, this.#setCircleMatrix(landCell, offset));
    });
    landCellGlobe.instanceMatrix.needsUpdate = true;
    landCellGlobe.computeBoundingSphere();
  }

  #setCircleMatrix(landCell: LandCell, offset: number) {
    const center = getXYZCoordinates(
      landCell.center[0],
      landCell.center[1],
      this.globeRadius
    );
    _center.set(center.x, center.y, center.z);
    _localZ.copy(_center).normalize();

    const paddedVertices = getNewGeoJson(landCell, this.landCellPadding);
    let radius = 0;
    for (let i = 0; i < paddedVertices.length; i += 1) {
      const [lng, lat] = paddedVertices[i];
      const vertex = getXYZCoordinates(lat, lng, this.globeRadius);
      _vertex.set(vertex.x, vertex.y, vertex.z).sub(_center);
      _vertex.addScaledVector(_localZ, -_vertex.dot(_localZ));
      radius += _vertex.length();
      if (i === 0) _localX.copy(_vertex);
    }
    radius = paddedVertices.length > 0 ? radius / paddedVertices.length : 0;
    if (radius < 1e-4) radius = 1e-4;
    if (_localX.lengthSq() < 1e-8) {
      _localX.crossVectors(_localZ, _worldUp);
      if (_localX.lengthSq() < 1e-8) _localX.set(1, 0, 0);
    }
    _localX.normalize();
    _localY.crossVectors(_localZ, _localX).normalize();

    _center.addScaledVector(_localZ, offset);
    _matrix.makeBasis(_localX, _localY, _localZ);
    _matrix.scale(_vertex.set(radius, radius, 1));
    _matrix.setPosition(_center);
    return _matrix;
  }

  #updateLandCellOpacity(opacity: number) {
    if (this.landCellGlobe) {
      (this.landCellGlobe.material as THREE.Material).opacity = opacity;
      this.requestRender();
    }
  }

  fadeOutLandCells() {
    this.#updateLandCellOpacity(0.3);
  }

  fadeInLandCells() {
    this.#updateLandCellOpacity(1);
  }

  setGlobeColor(color: string) {
    this.globeColor = color;
    (this.globe.material as THREE.MeshBasicMaterial).color.set(color);
    this.requestRender();
  }

  setAutoRotate(autoRotate: boolean) {
    this.#controls.autoRotate = autoRotate;
    this.requestRender();
  }

  getRendererInfo() {
    const { memory, render } = this.#renderer.info;
    return {
      memory: {
        geometries: memory.geometries,
        textures: memory.textures,
      },
      render: {
        calls: render.calls,
        triangles: render.triangles,
        lines: render.lines,
        points: render.points,
      },
    };
  }

  #registerMouseMoveEvent() {
    window.addEventListener('mousemove', this.#handleMouseMove);
  }

  #handleMouseMove = (e: MouseEvent) => {
    this.#pointerClientX = e.clientX;
    this.#pointerClientY = e.clientY;
    this.#updateMousePosition(e.clientX, e.clientY);
  };

  #updateMousePosition(clientX: number, clientY: number) {
    const xPos = clientX - this.#rootBounds.left;
    const yPos = clientY - this.#rootBounds.top;
    this.mouse.x = (xPos / this.sizes.width) * 2 - 1;
    this.mouse.y = -((yPos / this.sizes.height) * 2 - 1);
    this.#pointerDirty = true;
  }

  #handleResize() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.#updateRootBounds();
    if (width === 0 || height === 0) return;
    if (width === this.sizes.width && height === this.sizes.height) return;

    this.sizes.width = width;
    this.sizes.height = height;
    this.#aspectRatio = width / height;
    this.camera.aspect = this.#aspectRatio;
    this.camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this.#pointerClientX !== null && this.#pointerClientY !== null) {
      this.#updateMousePosition(this.#pointerClientX, this.#pointerClientY);
    }
    this.#layoutDirty = true;
    this.#pointerDirty = true;
    this.requestRender();
  }

  #registerResizeEvent() {
    this.#resizeObserver = new ResizeObserver(() => this.#handleResize());
    this.#resizeObserver.observe(this.root);
    window.addEventListener('resize', this.#updateRootBounds);
    window.addEventListener('scroll', this.#updateRootBounds, true);
  }

  #updateRootBounds = () => {
    this.#rootBounds = this.root.getBoundingClientRect();
    if (this.#pointerClientX !== null && this.#pointerClientY !== null) {
      this.#updateMousePosition(this.#pointerClientX, this.#pointerClientY);
    }
    this.#layoutDirty = true;
    this.#pointerDirty = true;
  };

  protected requestRender() {
    this.#frameDirty = true;
  }

  protected onFrame(state: {
    cameraChanged: boolean;
    layoutChanged: boolean;
    pointerChanged: boolean;
  }) {
    void state;
  }

  protected onDestroy() {}

  #tick = () => {
    if (this.#destroyed) return;

    const cameraChanged = this.#controls.update();
    const layoutChanged = this.#layoutDirty;
    const pointerChanged = this.#pointerDirty;
    this.#layoutDirty = false;
    this.#pointerDirty = false;

    if (this.#frameDirty || cameraChanged || layoutChanged || pointerChanged) {
      this.onFrame({ cameraChanged, layoutChanged, pointerChanged });
    }
    if (this.#frameDirty || cameraChanged) {
      this.#renderer.render(this.scene, this.camera);
      this.#frameDirty = false;
    }
    this.#animationFrameId = window.requestAnimationFrame(this.#tick);
  };

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    if (this.#animationFrameId !== null) {
      window.cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }
    this.#resizeObserver.disconnect();
    window.removeEventListener('mousemove', this.#handleMouseMove);
    window.removeEventListener('resize', this.#updateRootBounds);
    window.removeEventListener('scroll', this.#updateRootBounds, true);
    this.#controls.dispose();
    this.onDestroy();

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    this.scene.clear();
    this.#renderer.dispose();
    this.#canvas.remove();
  }
}
