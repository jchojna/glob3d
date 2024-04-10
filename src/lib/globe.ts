import * as dat from 'lil-gui';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

import worldGeoJson from '../data/world_low_geo.json';
import '../styles.css';
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
  globe: THREE.Mesh<any, any>;
  globeColor: string;
  globeOpacity: number;
  globeRadius: number;
  gui: dat.GUI;
  hexMargin: number;
  hexRes: number;
  mouse: THREE.Vector2;
  scene: THREE.Scene;
  sizes: { width: number; height: number };

  constructor(
    root: HTMLElement,
    globeColor: string,
    globeOpacity: number,
    globeRadius: number,
    hexRes: number,
    hexMargin: number,
    debugMode: boolean
  ) {
    this.root = root;
    this.#aspectRatio = window.innerWidth / window.innerHeight;
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
      width: window.innerWidth,
      height: window.innerHeight,
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
    this.#renderer.render(this.scene, this.camera);
  }

  createCanvas(root: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.classList.add('webglobe');
    root.appendChild(canvas);
    return canvas;
  }

  createHexGlobe() {
    const { features } = worldGeoJson;
    // @ts-ignore
    const h3Indexes = getH3Indexes(features, this.hexRes);
    const material = new THREE.MeshMatcapMaterial();
    // TODO: should it be possible to set other matcap textures?
    material.matcap = this.#textureLoader.load('/textures/matcap_1.png');
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
              this.globeRadius + 0.1, // top height
              true, // closed bottom
              true, // closed top
              false // include sides
            );
          })
        );
  }

  registerMouseMove() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / this.sizes.width) * 2 - 1;
      this.mouse.y = -((e.clientY / this.sizes.height) * 2 - 1);
    });
  }

  registerResize() {
    window.addEventListener('resize', () => {
      this.sizes.width = window.innerWidth;
      this.sizes.height = window.innerHeight;
      this.#aspectRatio = this.sizes.width / this.sizes.height;
      this.camera.aspect = this.#aspectRatio;
      this.camera.updateProjectionMatrix();
      this.#renderer.setSize(this.sizes.width, this.sizes.height);
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
    this.registerMouseMove();
    if (!this.#debugMode) this.gui.hide();
  }
}
