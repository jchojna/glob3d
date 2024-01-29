import './styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GeoJsonGeometry } from 'three-geojson-geometry';
import { geoGraticule10 } from 'd3-geo';
import json from 'url:./assets/data/world_low_geo.json';
import worldMap from 'url:./assets/map/world_map.jpg';

// Constants
GLOBE_RADIUS = 100;

fetch(json).then(res => res.json()).then(countries => {
  console.log(countries);

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
  const globeGeometry = new THREE.SphereBufferGeometry(GLOBE_RADIUS, 24, 24);
  const defaultGlobeMaterial = new THREE.MeshBasicMaterial({
    color: '#555',
    transparent: true,
    wireframe: true
  });
  const globe = new THREE.Mesh(globeGeometry, defaultGlobeMaterial);
  scene.add(globe);
  
  // Graticules
  const graticuleObj = new THREE.LineSegments(
    new GeoJsonGeometry(geoGraticule10(), GLOBE_RADIUS, 2),
    new THREE.LineBasicMaterial({ color: 'white', transparent: true, opacity: 0.8 })
  );
  scene.add(graticuleObj);
  
  // Camera
  const camera = new THREE.PerspectiveCamera(55, aspectRatio, 1, 2000);
  camera.position.z = 200;
  scene.add(camera);
  
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  
  const renderer = new THREE.WebGLRenderer({
    canvas
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.render(scene, camera);

  // Dots
  const DOT_COUNT = 20000;
  const dotsPositions = [];
  const dotsIds = [];
  const countryIds = [];
  const vector = new THREE.Vector3();

  for (let i = DOT_COUNT; i >= 0; i--) {
    const phi = Math.acos(-1 + 2 * i / DOT_COUNT);
    const theta = Math.sqrt(DOT_COUNT * Math.PI) * phi;

    vector.setFromSphericalCoords(GLOBE_RADIUS, phi, theta);

    const dotGeometry = new THREE.CircleGeometry(0.5, 5);
    const dotMaterial = new THREE.MeshBasicMaterial( { color: '#fff' } );
    const circle = new THREE.Mesh(dotGeometry, dotMaterial);
    scene.add( circle );
    dotGeometry.lookAt(vector);
    dotGeometry.translate(vector.x, vector.y, vector.z);
  }

  new THREE.ImageLoader().load(worldMap, (image) => {
		const canv = document.createElement( 'canvas' );
		const context = canv.getContext( '2d' );
    context.drawImage(image, 0, 0, 2000, 1000, 0, 0, 2000, 1000);
    console.log(context);
    const imageData = context.getImageData(0, 0, 2000, 1000);
    console.log(imageData);
  });
  
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
}).catch(err => {
  // Do something for an error here
  console.log("Error Reading data " + err);
});