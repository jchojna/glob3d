import { latLngToCell } from 'h3-js';
import * as dat from 'lil-gui';
import * as THREE from 'three';
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as _bfg from 'three/addons/utils/BufferGeometryUtils.js';
import json from '../data/world_low_geo.json';
import '../styles.scss';
import {
  getH3Indexes,
  getHexBin,
  getNewGeoJson,
  polar2Cartesian,
} from './globeHelpers';

type GlobeData = {
  country: string;
  city: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  value: number;
};

export default class WebGLobe {
  bfg;
  BufferGeometryUtils: { mergeGeometries: (arg0: any) => any };
  globeRadius: number;
  hexRes: number;
  hexMargin: number;
  hexCurvatureRes: number;
  textureLoader: THREE.TextureLoader;
  matcapTexture: THREE.Texture | null;
  debugMode: boolean;
  highestBar: number;
  scene: THREE.Scene;
  root: HTMLElement;
  canvas: HTMLElement;
  tooltip: HTMLElement;
  tooltipCountry: HTMLElement;
  tooltipCity: HTMLElement;
  tooltipValue: HTMLElement;
  hexGlobeGeometry: undefined;
  hexGlobeMaterial: THREE.MeshMatcapMaterial;
  hexGlobe: THREE.Mesh<any, any>;
  hexResults: any[];
  hexMaxValue: number;
  hexResultsGroup: THREE.Object3D | THREE.Group;
  aggregatedData: HexData[];
  sizes: { width: any; height: any };
  aspectRatio: number;
  solidGlobeGeometry: any;
  solidGlobeMaterial: THREE.MeshBasicMaterial;
  globe: THREE.Mesh<any, any>;
  mouse: THREE.Vector2;
  hoveredHexObject: THREE.Mesh<any, any> | null;
  hoveredHexId: string | null;
  hoveredHexIndex: number;
  clickedHexIdx: number | null;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  renderer: THREE.WebGLRenderer;

  constructor(
    root: HTMLElement,
    globeRadius: number = 100,
    hexRes: number = 2,
    hexMargin: number = 0.2,
    hexCurvatureRes: number = 5,
    debugMode: boolean = false,
    highestBar: number = 0.5
  ) {
    this.root = root;
    this.canvas = this.createCanvas();
    this.tooltip = this.createTooltip();
    this.tooltipCountry = document.querySelector('.tooltip > .country')!;
    this.tooltipCity = document.querySelector('.tooltip > .city')!;
    this.tooltipValue = document.querySelector('.tooltip > .value')!;
    this.bfg = Object.assign({}, _bfg);
    this.BufferGeometryUtils = this.bfg.BufferGeometryUtils || this.bfg;
    this.BufferGeometryUtils = _bfg;
    this.globeRadius = globeRadius;
    this.hexRes = hexRes;
    this.hexMaxValue = NaN;
    this.hexMargin = hexMargin;
    this.hexCurvatureRes = hexCurvatureRes;
    this.textureLoader = new THREE.TextureLoader();
    this.matcapTexture = this.textureLoader.load('/textures/matcap_1.png');
    this.debugMode = debugMode;
    this.highestBar = highestBar;
    // scene
    this.scene = new THREE.Scene();
    // hexagonal globe
    this.hexGlobeGeometry = undefined;
    this.hexGlobeMaterial = new THREE.MeshMatcapMaterial();
    this.hexGlobeMaterial.matcap = this.matcapTexture;
    this.hexGlobe = new THREE.Mesh(
      this.hexGlobeGeometry,
      this.hexGlobeMaterial
    );
    this.hexResultsGroup = new THREE.Group();
    this.hexResults = [];
    this.aggregatedData = [];
    // sizes
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.aspectRatio = this.sizes.width / this.sizes.height;
    // globe
    this.solidGlobeGeometry = new THREE.SphereGeometry(
      this.globeRadius,
      32,
      32
    );
    this.solidGlobeMaterial = new THREE.MeshBasicMaterial({
      color: '#555',
      transparent: true,
      opacity: 0.2,
      wireframe: false,
    });
    this.globe = new THREE.Mesh(
      this.solidGlobeGeometry,
      this.solidGlobeMaterial
    );
    // mouse
    this.mouse = new THREE.Vector2();
    this.hoveredHexObject = null;
    this.hoveredHexId = null;
    this.hoveredHexIndex = NaN;
    this.clickedHexIdx = null;

    this.camera = new THREE.PerspectiveCamera(55, this.aspectRatio, 1, 2000);
    this.camera.position.z = 200;
    this.camera.position.y = 200;
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.raycaster = new THREE.Raycaster();
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.canvas,
      antialias: true,
    });
    this.scene.add(this.globe);
    this.scene.add(this.camera);
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.render(this.scene, this.camera);
  }

  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.classList.add('webglobe');
    this.root.appendChild(canvas);
    return canvas;
  }

  createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    this.tooltipCountry = document.createElement('p');
    this.tooltipCountry.classList.add('country');
    this.tooltipCity = document.createElement('p');
    this.tooltipCity.classList.add('city');
    this.tooltipValue = document.createElement('p');
    this.tooltipValue.classList.add('value');
    tooltip.appendChild(this.tooltipCountry);
    tooltip.appendChild(this.tooltipCity);
    tooltip.appendChild(this.tooltipValue);
    this.root.appendChild(tooltip);
    return tooltip;
  }

  createHexGlobe() {
    const { features } = json;
    const h3Indexes = getH3Indexes(features, this.hexRes);
    const hexBins = h3Indexes.map((index) => getHexBin(index));
    this.hexGlobe.geometry = this.updateHexGlobeGeometry(hexBins);
    this.scene.add(this.hexGlobe);
  }

  updateHexGlobeGeometry(hexBins: any[]) {
    return !hexBins.length
      ? new THREE.BufferGeometry()
      : this.BufferGeometryUtils.mergeGeometries(
          hexBins.map((hex: any) => {
            const geoJson = getNewGeoJson(hex, this.hexMargin);
            return new ConicPolygonGeometry(
              [geoJson],
              this.globeRadius, // bottom height
              this.globeRadius + 0.1, // top height
              true, // closed bottom
              true, // closed top
              false, // include sides
              this.hexCurvatureRes // curvatureResolution
            );
          })
        );
  }

  updateHexResultsGeometry(bin: HexData) {
    return new ConicPolygonGeometry(
      [getNewGeoJson(bin, this.hexMargin)],
      this.globeRadius + 0.1,
      this.globeRadius +
        0.1 +
        (bin.value / this.hexMaxValue) * this.globeRadius * 2 * this.highestBar,
      true,
      true,
      true,
      this.hexCurvatureRes
    );
  }

  preProcessData(data: GlobeData[]) {
    return data.map(({ city, country, coordinates, value }) => {
      const h3Index = latLngToCell(
        coordinates.lat,
        coordinates.lon,
        this.hexRes
      );
      const hexBin = getHexBin(h3Index);
      return {
        city,
        country,
        coordinates: [coordinates.lat, coordinates.lon],
        ...hexBin,
        value,
      };
    });
  }

  aggregateData(data: GlobeData[]) {
    const processedData = this.preProcessData(data);
    return processedData.reduce(
      (a: any[], b: { city: string; h3Index: any; value: number }) => {
        const idx = a.findIndex(
          (elem: { h3Index: any }) => elem.h3Index === b.h3Index
        );
        if (idx >= 0) {
          a[idx].city += `, ${b.city}`;
          a[idx].value += b.value;
          return a;
        } else {
          return [...a, b];
        }
      },
      []
    );
  }

  visualizeResult(aggregatedData: any[]) {
    const hexResults = aggregatedData.map((bin: any) => {
      return new THREE.Mesh(
        this.updateHexResultsGeometry(bin),
        new THREE.MeshBasicMaterial({ color: 'blue', side: THREE.DoubleSide })
      );
    });
    hexResults.forEach((hex: any) => this.hexResultsGroup.add(hex));
    this.scene.add(this.hexResultsGroup);
    return hexResults;
  }

  getPixelPositionFromPolarCoords(polarCoordinates: any[]) {
    const { x, y, z } = polar2Cartesian(
      polarCoordinates[0],
      polarCoordinates[1],
      this.globeRadius
    );
    const point = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((point.x + 1) / 2) * this.sizes.width,
      y: ((point.y - 1) / 2) * this.sizes.height * -1,
    };
  }

  enableDebugMode() {
    const gui = new dat.GUI();
    gui.addColor(this.solidGlobeMaterial, 'color');
    gui.add(this.solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);
  }

  handleTooltip() {
    const hoveredHexData = this.aggregatedData[this.hoveredHexIndex];
    const polarCoordinates = hoveredHexData.center;
    const pxPosition = this.getPixelPositionFromPolarCoords(polarCoordinates);
    this.tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
    this.tooltipCountry.textContent = hoveredHexData.country;
    this.tooltipCity.textContent = hoveredHexData.city;
    this.tooltipValue.textContent = `${hoveredHexData.value} people`;
  }

  tick() {
    // handle raycasting
    if (this.hexResults.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObjects([
        this.globe,
        ...this.hexResults,
      ]);
      const hoveredHexObject =
        intersects.length > 0 &&
        (intersects.sort(
          (a: { distance: number }, b: { distance: number }) =>
            a.distance - b.distance
        )[0].object as THREE.Mesh<any, any>);

      if (hoveredHexObject && hoveredHexObject.uuid !== this.globe.uuid) {
        const hoveredHexId = hoveredHexObject.uuid;

        if (this.hoveredHexId !== hoveredHexId) {
          const hoveredHexIndex = this.hexResults.findIndex(
            (hex: any) => hex.uuid === hoveredHexId
          );
          this.hoveredHexObject &&
            this.hoveredHexObject.material.color.set('blue');
          hoveredHexObject.material.color.set('green');

          this.hoveredHexObject = hoveredHexObject;
          this.hoveredHexId = hoveredHexId;
          this.hoveredHexIndex = hoveredHexIndex;
          this.tooltip.classList.add('tooltip--visible');

          if (!Number.isNaN(this.hoveredHexIndex)) {
            this.handleTooltip();
          }
        }
      } else {
        this.hoveredHexObject &&
          this.hoveredHexObject.material.color.set('blue');
        this.hoveredHexObject = null;
        this.hoveredHexId = null;
        this.hoveredHexIndex = NaN;
        this.tooltip.classList.remove('tooltip--visible');
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.controls.update();
    return window.requestAnimationFrame(() => this.tick());
  }

  clean() {
    this.aggregatedData = [];
    this.hexResults = [];
    this.hoveredHexIndex = NaN;
    this.hexResultsGroup.clear();
    this.tooltip.classList.remove('tooltip--visible');
  }

  update(data: any) {
    console.log('UPDATE');
    this.aggregatedData = this.aggregateData(data);
    this.hexResults = this.visualizeResult(this.aggregatedData);
  }

  initialize(data: any) {
    this.tick();
    this.createHexGlobe();
    this.aggregatedData = this.aggregateData(data);
    this.hexMaxValue = Math.max(...this.aggregatedData.map((obj) => obj.value));
    this.hexResults = this.visualizeResult(this.aggregatedData);
    if (this.debugMode) this.enableDebugMode();

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / this.sizes.width) * 2 - 1;
      this.mouse.y = -((e.clientY / this.sizes.height) * 2 - 1);
    });

    window.addEventListener('resize', () => {
      this.sizes.width = window.innerWidth;
      this.sizes.height = window.innerHeight;
      this.aspectRatio = this.sizes.width / this.sizes.height;
      this.camera.aspect = this.aspectRatio;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.sizes.width, this.sizes.height);
    });
  }
}
