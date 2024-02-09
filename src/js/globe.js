import {
  getH3Indexes,
  getHexBin,
  getNewGeoJson,
  polar2Cartesian
} from './globeHelpers';
import '../styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { geoToH3 } from 'h3-js';
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import * as dat from 'lil-gui';
import * as _bfg from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import json from 'url:../assets/data/world_low_geo.json';
import matcapImage from 'url:../assets/matcaps/matcap_1.png';

export default class WebGLobe {
  constructor(
    globeRadius = 100,
    hexRes = 3,
    hexMargin = 0.2,
    hexCurvatureRes = 5
  ) {
    this.bfg = Object.assign({}, _bfg);
    this.BufferGeometryUtils = this.bfg.BufferGeometryUtils || this.bfg;
    this.globeRadius = globeRadius;
    this.hexRes = hexRes;
    this.hexMargin = hexMargin;
    this.hexCurvatureRes = hexCurvatureRes;
    this.textureLoader = new THREE.TextureLoader();
    this.matcapTexture = this.textureLoader.load(matcapImage);
    // scene
    this.scene = new THREE.Scene();
    this.canvas = document.querySelector('canvas.webglobe');
    this.tooltip = document.querySelector('.tooltip');
    this.tooltipCountry = document.querySelector('.tooltip > .country');
    this.tooltipOccurrences = document.querySelector('.tooltip > .occurrences');
    // hexagonal globe
    this.hexGlobeGeometry = undefined;
    this.hexGlobeMaterial = new THREE.MeshMatcapMaterial();
    this.hexGlobeMaterial.matcap = this.matcapTexture;
    this.hexGlobe = new THREE.Mesh(this.hexGlobeGeometry, this.hexGlobeMaterial);
    this.hexResults = [];
    this.aggregatedData = [];
    // sizes
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    }
    this.aspectRatio = this.sizes.width / this.sizes.height;
    // globe
    this.solidGlobeGeometry = new THREE.SphereBufferGeometry(this.globeRadius, 32, 32);
    this.solidGlobeMaterial = new THREE.MeshBasicMaterial({
      color: '#555',
      transparent: true,
      opacity: 0.2,
      wireframe: false
    });
    this.globe = new THREE.Mesh(this.solidGlobeGeometry, this.solidGlobeMaterial);
    // mouse
    this.mouse = new THREE.Vector2();
    this.hoveredHexIdx = null;
    this.clickedHexIdx = null;
    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.aspectRatio, 1, 2000);
    this.camera.position.z = 200;
    this.camera.position.y = 200;
    // controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    // raycaster
    this.raycaster = new THREE.Raycaster();
    this.raycaster2 = new THREE.Raycaster();
    // renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.scene.add(this.globe);
    this.scene.add(this.camera);
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.render(this.scene, this.camera);
  }

  createHexGlobe() {
    fetch(json)
      .then(res => res.json())
      .then(({ features }) => {
        const h3Indexes = getH3Indexes(features, this.hexRes);
        const hexBins = h3Indexes.map(index => getHexBin(index));
        this.hexGlobe.geometry = this.updateHexGlobeGeometry(hexBins);
        this.scene.add(this.hexGlobe);
      })
      .catch(err => {
        console.log("Error Reading data " + err);
      });
  }
  
  updateHexGlobeGeometry(hexBins) {
    return !hexBins.length
      ? new THREE.BufferGeometry()
      : this.BufferGeometryUtils.mergeBufferGeometries(hexBins.map(hex => {
        const geoJson = getNewGeoJson(hex, this.hexMargin);
        return new ConicPolygonGeometry(
          [geoJson],
          this.globeRadius,       // bottom height
          this.globeRadius + 0.1, // top height
          true,                   // closed bottom
          true,                   // closed top
          false,                  // include sides
          this.hexCurvatureRes    // curvatureResolution
        );
      }));
  }

  updateHexResultsGeometry(bin) {
    return new ConicPolygonGeometry(
      [getNewGeoJson(bin, this.hexMargin)],
      this.globeRadius + 0.1,
      this.globeRadius + 0.1 + bin.occurrences / 3,
      true,
      true,
      true,
      this.hexCurvatureRes
    );
  }

  aggregateData(results) {
    return results
      .map(({ name, coordinates, date, country }) => {
        const h3Index = geoToH3(coordinates[0], coordinates[1], this.hexRes);
        const hexBin = getHexBin(h3Index);
        return {
          name,
          date,
          country,
          coordinates,
          ...hexBin,
          occurrences: 1
        }
      })
      .reduce((a, b) => {
        const idx = a.findIndex(elem => elem.h3Index === b.h3Index)
        if (idx >= 0) {
          a[idx].occurrences++
          return a
        } else {
          return [ ...a, b ]
        }
      }, []);
  }

  visualizeResult(aggregatedData) {
    const hexResults = aggregatedData.map(bin => {
      return new THREE.Mesh(
        this.updateHexResultsGeometry(bin),
        new THREE.MeshBasicMaterial({color: "red", side: THREE.DoubleSide})
      );
    });
    hexResults.forEach(hex => this.scene.add(hex));
    return hexResults;
  }

  getPixelPositionFromPolarCoords(polarCoordinates) {
    const { x, y, z } = polar2Cartesian(polarCoordinates[0], polarCoordinates[1], this.globeRadius);
    const point = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (point.x + 1) / 2 * this.sizes.width,
      y: (point.y - 1) / 2 * this.sizes.height * -1
    }   
  }

  tick() {
    if (this.hexResults.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects([this.globe, ...this.hexResults]);
      const intersectsMeshes = intersects.map(intersect => intersect.object);
      this.hexResults.forEach((mesh, idx) => {
        if (intersectsMeshes.includes(mesh)) {
          const closestIntersect = intersects
            .sort((a, b) => a.distance - b.distance)[0]
            .object;
          if (closestIntersect === mesh) {
            mesh.material.color.set('blue');
            this.hoveredHexIdx = idx;
          }
        } else {
          mesh.material.color.set('red');
        }
      });
      if (this.hoveredHexIdx !== null) {
        const hoveredHexData = this.aggregatedData[this.hoveredHexIdx];
        const polarCoordinates = hoveredHexData.center;
        const pxPosition = this.getPixelPositionFromPolarCoords(polarCoordinates);
        this.tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
        this.tooltipCountry.textContent = hoveredHexData.country;
        this.tooltipOccurrences.textContent = `${hoveredHexData.occurrences} occurrences`;
        // check collisions
        const { x, y, z } = polar2Cartesian(polarCoordinates[0], polarCoordinates[1], this.globeRadius);
        const point = new THREE.Vector3(x, y, z).project(this.camera);
        this.raycaster2.setFromCamera(point, this.camera);
        const intersects2 = this.raycaster2.intersectObjects([this.globe, this.hexResults[this.hoveredHexIdx]]);
        const closestIntersect = intersects.length > 0
        ? intersects2.sort((a, b) => a.distance - b.distance)[0].object
        : null;
        
        closestIntersect === this.globe
        ? this.tooltip.classList.remove('tooltip--visible')
        : this.tooltip.classList.add('tooltip--visible');
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.controls.update();
    return window.requestAnimationFrame(() => this.tick());
  }

  initialize(data) {
    this.tick();
    this.createHexGlobe();
    this.aggregatedData = this.aggregateData(data);
    this.hexResults = this.visualizeResult(this.aggregatedData);
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX / this.sizes.width * 2 - 1;
      this.mouse.y = - (e.clientY / this.sizes.height * 2 - 1);
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

// const gui = new dat.GUI();
// gui.addColor(solidGlobeMaterial, 'color');
// gui.add(solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);
