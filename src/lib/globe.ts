import * as THREE from 'three';
// @ts-expect-error missing types
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
// @ts-expect-error missing types
import world from 'world-map-geojson';

import matcap from '../assets/textures/matcap_1.png';
import defaultOpts from './defaultOpts';
import { getH3Indexes, getHexBin, getNewGeoJson } from './helpers';

export default class Glob3d {
  // private fields
  #aspectRatio: number;
  #bufferGeometryUtils;
  #canvas: HTMLElement;
  #controls: OrbitControls;
  #renderer: THREE.WebGLRenderer;
  #textureLoader: THREE.TextureLoader;

  // public fields
  camera: THREE.PerspectiveCamera;
  globe: THREE.Mesh;
  globeColor: string;
  globeOpacity: number;
  globeRadius: number;
  hexPadding: number;
  hexRes: number;
  mouse: THREE.Vector2;
  root: HTMLElement;
  scene: THREE.Scene;
  sizes: { width: number; height: number };

  constructor(root: HTMLElement, options: GlobeOptions = {}) {
    const {
      globeColor = defaultOpts.globeColor,
      globeOpacity = defaultOpts.globeOpacity,
      globeRadius = defaultOpts.globeRadius,
      hexRes = defaultOpts.hexRes,
      hexPadding = defaultOpts.hexPadding,
    } = options;

    this.root = root;
    this.#aspectRatio = root.clientWidth / root.clientHeight;
    this.#bufferGeometryUtils = BufferGeometryUtils;
    this.#canvas = this.#createCanvas(this.root);
    this.#textureLoader = new THREE.TextureLoader();
    this.#renderer = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.#canvas,
      antialias: true,
    });

    this.globeColor = globeColor;
    this.globeOpacity = globeOpacity;
    this.globeRadius = globeRadius;
    this.hexPadding = Math.max(0, Math.min(hexPadding, 1));
    this.hexRes = Math.max(1, Math.min(hexRes, 5));
    this.mouse = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.sizes = {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    };

    // solid globe
    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(this.globeRadius, 36, 36),
      new THREE.MeshBasicMaterial({
        color: this.globeColor,
        transparent: true,
        opacity: this.globeOpacity,
      })
    );
    this.scene.add(this.globe);

    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.#aspectRatio, 1, 1000);
    this.camera.position.z = 240;
    this.camera.position.y = 240;
    this.scene.add(this.camera);

    this.#controls = new OrbitControls(this.camera, this.#canvas);
    this.#controls.autoRotate = true;
    this.#controls.autoRotateSpeed = 0.1;
    this.#controls.enableDamping = true;

    this.#renderer.setSize(this.sizes.width, this.sizes.height);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.render(this.scene, this.camera);

    this.#tick();
    this.#createHexGlobe();
    this.#registerMouseMoveEvent();
    this.#registerResizeEvent();
  }

  #createCanvas(root: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.outline = 'none';
    canvas.style.userSelect = 'none';
    root.appendChild(canvas);
    return canvas;
  }

  #createHexGlobe() {
    const h3Indexes = getH3Indexes(world.features, this.hexRes);
    const material = new THREE.MeshMatcapMaterial();
    // TODO: should it be possible to set other matcap textures?
    material.matcap = this.#textureLoader.load(matcap);
    const hexBins = h3Indexes.map((index) => getHexBin(index));
    const globe = new THREE.Mesh(
      this.#updateHexGlobeGeometry(hexBins),
      material
    );
    this.scene.add(globe);
  }

  #getHexOffsetFromGlobe(radius: number, hexRes: number) {
    return radius * (Math.pow(5, 5) - Math.pow(hexRes, 5)) * 0.000001;
  }

  #updateHexGlobeGeometry(hexBins: HexBin[]) {
    return !hexBins.length
      ? new THREE.BufferGeometry()
      : this.#bufferGeometryUtils.mergeGeometries(
          hexBins.map((hex: HexBin) => {
            const geoJson = getNewGeoJson(hex, this.hexPadding);
            const offset = this.#getHexOffsetFromGlobe(
              this.globeRadius,
              this.hexRes
            );
            return new ConicPolygonGeometry(
              [geoJson], // GeoJson polygon coordinates
              this.globeRadius + offset, // bottom height
              this.globeRadius + offset, // top height
              true, // closed bottom
              true, // closed top
              false // include sides
            );
          })
        );
  }

  #registerMouseMoveEvent() {
    window.addEventListener('mousemove', (e) => {
      const xPos = e.clientX - this.root.getBoundingClientRect().left;
      const yPos = e.clientY - this.root.getBoundingClientRect().top;
      this.mouse.x = (xPos / this.sizes.width) * 2 - 1;
      this.mouse.y = -((yPos / this.sizes.height) * 2 - 1);
    });
  }

  #registerResizeEvent() {
    window.addEventListener('resize', () => {
      this.sizes.width = this.root.clientWidth;
      this.sizes.height = this.root.clientHeight;
      this.#aspectRatio = this.sizes.width / this.sizes.height;
      this.camera.aspect = this.#aspectRatio;
      this.camera.updateProjectionMatrix();
      this.#renderer.setSize(this.sizes.width, this.sizes.height);
      this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  #tick(): number {
    this.#renderer.render(this.scene, this.camera);
    this.#controls.update();
    return window.requestAnimationFrame(() => this.#tick());
  }
}
