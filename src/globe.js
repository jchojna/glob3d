import './styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { polyfill, h3ToGeo, h3ToGeoBoundary } from 'h3-js';
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';

import * as _bfg from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const bfg = Object.assign({}, _bfg);
const BufferGeometryUtils = bfg.BufferGeometryUtils || bfg;

import json from 'url:./assets/data/world_low_geo.json';

// Constants
const GLOBE_RADIUS = 100;
const h3Indexes = [];

// Scene
const scene = new THREE.Scene();
const canvas = document.querySelector('canvas.webglobe');

fetch(json).then(res => res.json()).then(({ features }) => {
  
  const obj = new THREE.Mesh(
    undefined,
    new THREE.MeshNormalMaterial({ color: 'red' })
  );
  obj.__globeObjType = 'hexPolygon'; // Add object type

  features.forEach(({ geometry }) => {
    const { type, coordinates } = geometry;
    // Get H3 indexes for all hexagons in Polygon or MultiPolygon
    if (type === 'Polygon') {
      polyfill(coordinates, 3, true).forEach(idx => h3Indexes.push(idx));
    } else if (type === 'MultiPolygon') {
      coordinates.forEach(coords => {
        polyfill(coords, 3, true).forEach(idx => h3Indexes.push(idx));
      });
    } else {
      console.warn(`Unsupported GeoJson geometry type (${type})`);
    }
  });

  const hexBins = h3Indexes.map(h3Index => {
    hexCenter = h3ToGeo(h3Index);
    hexGeoJson = h3ToGeoBoundary(h3Index, true).reverse();
    // Split geometries at the anti-meridian.
    const centerLng = hexCenter[1];
    hexGeoJson.forEach(d => {
      const edgeLng = d[0];
      if (Math.abs(centerLng - edgeLng) > 170) {
        d[0] += (centerLng > edgeLng ? 360 : -360);
      }
    });    
    return { h3Index, hexCenter, hexGeoJson };
  });

  const margin = 0.2;
  
  obj.geometry = !hexBins.length
    ? new THREE.BufferGeometry()
    : BufferGeometryUtils.mergeBufferGeometries(hexBins.map(hex => {
      // compute new geojson with relative margin
      const relNum = (st, end, rat) => st - (st - end) * rat;
      const [clat, clng] = hex.hexCenter;
      const geoJson = margin === 0
      ? hex.hexGeoJson
      : hex.hexGeoJson
      .map(([elng, elat]) => [[elng, clng], [elat, clat]]
      .map(([st, end]) => relNum(st, end, margin)));

      return new ConicPolygonGeometry(
        [geoJson],
        GLOBE_RADIUS,
        GLOBE_RADIUS + 1,
        false,
        true,
        false,
        5
      );
    }));
  scene.add(obj);
}).catch(err => {
  console.log("Error Reading data " + err);
});;

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}
let aspectRatio = sizes.width / sizes.height;

// Globe
const globeGeometry = new THREE.SphereBufferGeometry(GLOBE_RADIUS, 24, 24);
const defaultGlobeMaterial = new THREE.MeshBasicMaterial({
  color: '#555',
  transparent: true,
  opacity: 0.1,
  wireframe: false
});
const globe = new THREE.Mesh(globeGeometry, defaultGlobeMaterial);
scene.add(globe);

// Camera
const camera = new THREE.PerspectiveCamera(55, aspectRatio, 1, 2000);
camera.position.z = 300;
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.render(scene, camera);

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
