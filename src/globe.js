import './styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { polyfill, h3ToGeo, h3ToGeoBoundary } from 'h3-js';
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import * as dat from 'lil-gui';

import * as _bfg from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const bfg = Object.assign({}, _bfg);
const BufferGeometryUtils = bfg.BufferGeometryUtils || bfg;

import json from 'url:./assets/data/world_low_geo.json';
import matcapImage from 'url:./assets/matcaps/matcap_1.png';

// Constants
const GLOBE_RADIUS = 100;
const HEX_RES = 3;
const HEX_MARGIN = 0.2;
const HEX_CURVATURE_RES = 5;

const textureLoader = new THREE.TextureLoader();
const matcapTexture = textureLoader.load(matcapImage);

// Debug
const gui = new dat.GUI();

// Scene
const scene = new THREE.Scene();
const canvas = document.querySelector('canvas.webglobe');

// Hexagonal Globe
const hexGlobeGeometry = undefined;
const hexGlobeMaterial = new THREE.MeshMatcapMaterial();
hexGlobeMaterial.matcap = matcapTexture;
const hexGlobe = new THREE.Mesh(hexGlobeGeometry, hexGlobeMaterial);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}
let aspectRatio = sizes.width / sizes.height;

// Globe
const solidGlobeGeometry = new THREE.SphereBufferGeometry(GLOBE_RADIUS, 24, 24);
const solidGlobeMaterial = new THREE.MeshBasicMaterial({
  color: '#555',
  transparent: true,
  opacity: 0.1,
  wireframe: false
});
gui.addColor(solidGlobeMaterial, 'color');
gui.add(solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);
const globe = new THREE.Mesh(solidGlobeGeometry, solidGlobeMaterial);

// Camera
const camera = new THREE.PerspectiveCamera(55, aspectRatio, 1, 2000);
camera.position.z = 300;

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});

scene.add(globe);
scene.add(camera);
renderer.setSize(sizes.width, sizes.height);
renderer.render(scene, camera);

// Get H3 indexes for all hexagons in Polygon or MultiPolygon
const getH3Indexes = (features) => {
  const indexes = [];
  features.forEach(({ geometry }) => {
    const { type, coordinates } = geometry;
    if (type === 'Polygon') {
      polyfill(coordinates, HEX_RES, true).forEach(idx => indexes.push(idx));
    } else if (type === 'MultiPolygon') {
      coordinates.forEach(coords => {
        polyfill(coords, HEX_RES, true).forEach(idx => indexes.push(idx));
      });
    } else {
      console.warn(`Unsupported GeoJson geometry type (${type})`);
    }
  });
  return indexes;
}

const getHexBins = (h3Indexes) => {
  return h3Indexes.map(h3Index => {
    // Get center of a given hexagon - point as a [lat, lng] pair.
    center = h3ToGeo(h3Index);
    // Get the vertices of a given hexagon as an array of [lat, lng] points.
    vertices = h3ToGeoBoundary(h3Index, true).reverse();
    // Split geometries at the anti-meridian.
    const centerLng = center[1];
    vertices.forEach(d => {
      const edgeLng = d[0];
      if (Math.abs(centerLng - edgeLng) > 170) {
        d[0] += (centerLng > edgeLng ? 360 : -360);
      }
    });    
    return { h3Index, center, vertices };
  });
}

const updateHexGlobeGeometry = (hexBins) => {
  return !hexBins.length
    ? new THREE.BufferGeometry()
    : BufferGeometryUtils.mergeBufferGeometries(hexBins.map(hex => {
      // compute new geojson with relative margin
      const relNum = (st, end, rat) => st - (st - end) * rat;
      const [clat, clng] = hex.center;
      const geoJson = HEX_MARGIN === 0
        ? hex.vertices
        : hex.vertices
          .map(([elng, elat]) => [[elng, clng], [elat, clat]]
          .map(([st, end]) => relNum(st, end, HEX_MARGIN)));

      return new ConicPolygonGeometry(
        polygonGeoJson = [geoJson],
        bottomHeight = GLOBE_RADIUS,
        topHeight = GLOBE_RADIUS + 0.1,
        closedBottom = true,
        closedTop = true,
        includeSides = false,
        curvatureResolution = HEX_CURVATURE_RES
      );
    }));
}

// Create hexGlobe object.
fetch(json).then(res => res.json()).then(({ features }) => {
  const h3Indexes = getH3Indexes(features);
  const hexBins = getHexBins(h3Indexes);
  hexGlobe.geometry = updateHexGlobeGeometry(hexBins);
  scene.add(hexGlobe);
}).catch(err => {
  console.log("Error Reading data " + err);
});;

const tick = () => {
  renderer.render(scene, camera);
  controls.update();
  window.requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  aspectRatio = sizes.width / sizes.height;
  camera.aspect = aspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});
