import * as dat from 'lil-gui';
import * as THREE from 'three';
// @ts-ignore
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

import json from '../data/world_low_geo.json';
import '../styles.css';
import { getH3Indexes, getHexBin, getNewGeoJson } from './helpers';

export default class Glob3d {
  // private fields
  #aspectRatio: number;
  #bufferGeometryUtils;
  #canvas: HTMLElement;
  #debugMode: boolean;
  #controls: OrbitControls;
  #hexGlobe: THREE.Mesh<any, any>;
  #hexGlobeGeometry: THREE.BufferGeometry | undefined;
  #hexGlobeMaterial: THREE.MeshMatcapMaterial;
  #matcapTexture: THREE.Texture | null;
  #renderer: THREE.WebGLRenderer;
  #root: HTMLElement;
  #solidGlobeGeometry: THREE.SphereGeometry;
  #solidGlobeMaterial: THREE.MeshBasicMaterial;
  #textureLoader: THREE.TextureLoader;

  // public fields
  camera: THREE.PerspectiveCamera;
  globe: THREE.Mesh<any, any>;
  globeRadius: number;
  hexMargin: number;
  hexRes: number;
  mouse: THREE.Vector2;
  scene: THREE.Scene;
  sizes: { width: number; height: number };

  constructor(
    root: HTMLElement,
    globeRadius: number,
    hexRes: number,
    hexMargin: number,
    debugMode: boolean
  ) {
    this.#root = root;
    this.#aspectRatio = window.innerWidth / window.innerHeight;
    this.#bufferGeometryUtils = BufferGeometryUtils;
    this.#canvas = this.createCanvas(this.#root);
    this.#debugMode = debugMode;
    this.#textureLoader = new THREE.TextureLoader();
    this.#matcapTexture = this.#textureLoader.load('/textures/matcap_1.png');
    this.#renderer = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.#canvas,
      antialias: true,
    });

    this.scene = new THREE.Scene();

    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.#aspectRatio, 1, 1000);
    this.camera.position.z = 200;
    this.camera.position.y = 200;
    this.scene.add(this.camera);

    this.globeRadius = globeRadius;
    this.hexMargin = hexMargin;
    this.hexRes = hexRes;
    this.mouse = new THREE.Vector2();
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // solid globe
    this.#solidGlobeGeometry = new THREE.SphereGeometry(
      this.globeRadius,
      32,
      32
    );
    this.#solidGlobeMaterial = new THREE.MeshBasicMaterial({
      color: '#000105',
      transparent: true,
      opacity: 0.85,
    });
    this.globe = new THREE.Mesh(
      this.#solidGlobeGeometry,
      this.#solidGlobeMaterial
    );
    this.scene.add(this.globe);

    // globe made of hexagons
    this.#hexGlobeGeometry = undefined;
    this.#hexGlobeMaterial = new THREE.MeshMatcapMaterial();
    this.#hexGlobeMaterial.matcap = this.#matcapTexture;
    this.#hexGlobe = new THREE.Mesh(
      this.#hexGlobeGeometry,
      this.#hexGlobeMaterial
    );

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
    const { features } = json;
    // @ts-ignore
    const h3Indexes = getH3Indexes(features, this.hexRes);
    const hexBins = h3Indexes.map((index) => getHexBin(index));
    this.#hexGlobe.geometry = this.updateHexGlobeGeometry(hexBins);
    this.scene.add(this.#hexGlobe);
  }

  updateHexGlobeGeometry(hexBins: any[]) {
    return !hexBins.length
      ? new THREE.BufferGeometry()
      : this.#bufferGeometryUtils.mergeGeometries(
          hexBins.map((hex: HexData) => {
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

  enableDebugMode() {
    const gui = new dat.GUI();
    gui.addColor(this.#solidGlobeMaterial, 'color');
    gui.add(this.#solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);
  }

  tick(): number {
    this.#renderer.render(this.scene, this.camera);
    this.#controls.update();
    return window.requestAnimationFrame(() => this.tick());
  }

  init() {
    this.tick();
    this.createHexGlobe();
    if (this.#debugMode) this.enableDebugMode();

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / this.sizes.width) * 2 - 1;
      this.mouse.y = -((e.clientY / this.sizes.height) * 2 - 1);
    });

    window.addEventListener('resize', () => {
      this.sizes.width = window.innerWidth;
      this.sizes.height = window.innerHeight;
      this.#aspectRatio = this.sizes.width / this.sizes.height;
      this.camera.aspect = this.#aspectRatio;
      this.camera.updateProjectionMatrix();
      this.#renderer.setSize(this.sizes.width, this.sizes.height);
    });
  }
}
