import './styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GeoJsonGeometry } from 'three-geojson-geometry';
import { geoGraticule10 } from 'd3-geo';

// Scene
const scene = new THREE.Scene();
const canvas = document.querySelector('canvas.webglobe');

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}
let aspectRatio = sizes.width / sizes.height;

// Globe
const globeGeometry = new THREE.SphereBufferGeometry(1, 24, 24);
const defaultGlobeMaterial = new THREE.MeshBasicMaterial({
  color: '#555',
  transparent: true,
  wireframe: true
});
const globe = new THREE.Mesh(globeGeometry, defaultGlobeMaterial);
scene.add(globe);

// Graticules
const graticuleObj = new THREE.LineSegments(
  new GeoJsonGeometry(geoGraticule10(), 1, 2),
  new THREE.LineBasicMaterial({ color: 'white', transparent: true, opacity: 0.8 })
);
scene.add(graticuleObj);

// Camera
const camera = new THREE.PerspectiveCamera(55, aspectRatio, 0.1, 100);
camera.position.z = 3;
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({
  canvas
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