import * as dat from 'lil-gui';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

import matcap from '../assets/textures/matcap_1.png';
import worldGeoJson from '../data/world_low_geo.json';
import defaultOpts from './defaultOpts';
import { getH3Indexes, getHexBin, getNewGeoJson } from './helpers';

export default class Glob3d {
  // private fields
  #aspectRatio: number;
  #bufferGeometryUtils;
  #canvas: HTMLElement;
  #debugMode: boolean;
  #controls: OrbitControls;
  #renderer: THREE.WebGLRenderer;
  root: HTMLElement;
  #textureLoader: THREE.TextureLoader;

  // public fields
  camera: THREE.PerspectiveCamera;
  globe: THREE.Mesh;
  globeColor: string;
  globeOpacity: number;
  globeRadius: number;
  gui: dat.GUI;
  hexMargin: number;
  hexRes: number;
  mouse: THREE.Vector2;
  scene: THREE.Scene;
  sizes: { width: number; height: number };

  constructor(root: HTMLElement, options: GlobeOptions) {
    const {
      globeColor = defaultOpts.globeColor,
      globeOpacity = defaultOpts.globeOpacity,
      globeRadius = defaultOpts.globeRadius,
      hexRes = defaultOpts.hexRes,
      hexMargin = defaultOpts.hexMargin,
      debugMode = defaultOpts.debugMode,
    } = options;

    this.root = root;
    this.#aspectRatio = root.clientWidth / root.clientHeight;
    this.#bufferGeometryUtils = BufferGeometryUtils;
    this.#canvas = this.createCanvas(this.root);
    this.#debugMode = debugMode;
    this.#textureLoader = new THREE.TextureLoader();
    this.#renderer = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.#canvas,
      antialias: true,
    });

    this.globeColor = globeColor;
    this.globeOpacity = globeOpacity;
    this.globeRadius = globeRadius;
    this.gui = new dat.GUI();
    this.hexMargin = hexMargin;
    this.hexRes = hexRes;
    this.mouse = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.sizes = {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    };

    // solid globe
    const solidGlobeMaterial = new THREE.MeshBasicMaterial({
      color: this.globeColor,
      transparent: true,
      opacity: this.globeOpacity,
    });
    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(this.globeRadius, 36, 36),
      solidGlobeMaterial
    );
    this.gui.addColor(solidGlobeMaterial, 'color');
    this.gui.add(solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);
    this.scene.add(this.globe);

    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.#aspectRatio, 1, 1000);
    this.camera.position.z = 200;
    this.camera.position.y = 200;
    this.scene.add(this.camera);

    this.#controls = new OrbitControls(this.camera, this.#canvas);
    this.#controls.autoRotate = true;
    this.#controls.autoRotateSpeed = 0.1;
    this.#controls.enableDamping = true;

    this.#renderer.setSize(this.sizes.width, this.sizes.height);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.render(this.scene, this.camera);
  }

  createCanvas(root: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.outline = 'none';
    canvas.style.userSelect = 'none';
    root.appendChild(canvas);
    return canvas;
  }

  createHexGlobe() {
    const { features } = worldGeoJson;
    // @ts-ignore
    const h3Indexes = getH3Indexes(features, this.hexRes);
    const material = new THREE.MeshMatcapMaterial();
    // TODO: should it be possible to set other matcap textures?
    material.matcap = this.#textureLoader.load(matcap);
    const hexBins = h3Indexes.map((index) => getHexBin(index));
    const globe = new THREE.Mesh(
      this.updateHexGlobeGeometry(hexBins),
      material
    );
    this.scene.add(globe);
  }

  updateHexGlobeGeometry(hexBins: HexBin[]) {
    return !hexBins.length
      ? new THREE.BufferGeometry()
      : this.#bufferGeometryUtils.mergeGeometries(
          hexBins.map((hex: HexBin) => {
            const geoJson = getNewGeoJson(hex, this.hexMargin);
            return new ConicPolygonGeometry(
              [geoJson], // GeoJson polygon coordinates
              this.globeRadius, // bottom height
              this.globeRadius, // top height
              true, // closed bottom
              true, // closed top
              false // include sides
            );
          })
        );
  }

  registerMouseMoveEvent() {
    window.addEventListener('mousemove', (e) => {
      const xPos = e.clientX - this.root.getBoundingClientRect().left;
      const yPos = e.clientY - this.root.getBoundingClientRect().top;
      this.mouse.x = (xPos / this.sizes.width) * 2 - 1;
      this.mouse.y = -((yPos / this.sizes.height) * 2 - 1);
    });
  }

  tick(): number {
    this.#renderer.render(this.scene, this.camera);
    this.#controls.update();
    return window.requestAnimationFrame(() => this.tick());
  }

  init() {
    this.tick();
    this.createHexGlobe();
    this.registerMouseMoveEvent();
    if (!this.#debugMode) this.gui.hide();
  }
}
