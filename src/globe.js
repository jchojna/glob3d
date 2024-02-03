//// @ts-check

import './styles.scss';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { polyfill, geoToH3, h3ToGeo, h3ToGeoBoundary } from 'h3-js';
import { ConicPolygonGeometry } from 'three-conic-polygon-geometry';
import * as dat from 'lil-gui';

import * as _bfg from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const bfg = Object.assign({}, _bfg);
const BufferGeometryUtils = bfg.BufferGeometryUtils || bfg;

import json from 'url:./assets/data/world_low_geo.json';
import matcapImage from 'url:./assets/matcaps/matcap_1.png';
import { Color, Vector3 } from 'three';

// Constants
const GLOBE_RADIUS = 100;
const HEX_RES = 3; 
const HEX_MARGIN = 0.2;
const HEX_CURVATURE_RES = 5;

const textureLoader = new THREE.TextureLoader();
const matcapTexture = textureLoader.load(matcapImage);
const baseApiQuery = 'https://api.gbif.org/v1/occurrence/search';
const facets = `${baseApiQuery}?kingdomKey=1&phylumKey=44&classKey=212&facet=genusKey&genusKey.facetLimit=1200000&genusKey.facetOffset=0&limit=0`;

// Debug
const gui = new dat.GUI();

// Scene
const scene = new THREE.Scene();
const canvas = document.querySelector('canvas.webglobe');
const tooltip = document.querySelector('.tooltip');
const tooltipCountry = document.querySelector('.tooltip > .country');
const tooltipOccurrences = document.querySelector('.tooltip > .occurrences');

// Hexagonal Globe
const hexGlobeGeometry = undefined;
const hexGlobeMaterial = new THREE.MeshMatcapMaterial();
hexGlobeMaterial.matcap = matcapTexture;
const hexGlobe = new THREE.Mesh(hexGlobeGeometry, hexGlobeMaterial);
let spotsMeshes = [];
let resultsData = [];

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
camera.position.z = 150;
camera.position.y = 150;

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

const getHexBin = (h3Index) => {
  // Get center of a given hexagon - point as a [lat, lng] pair.
  const center = h3ToGeo(h3Index);
  // Get the vertices of a given hexagon as an array of [lat, lng] points.
  const vertices = h3ToGeoBoundary(h3Index, true).reverse();
  // Split geometries at the anti-meridian.
  const centerLng = center[1];
  vertices.forEach(d => {
    const edgeLng = d[0];
    if (Math.abs(centerLng - edgeLng) > 170) {
      d[0] += (centerLng > edgeLng ? 360 : -360);
    }
  });    
  return { h3Index, center, vertices };
}

// Compute new geojson with relative margin.
const getNewGeoJson = (hex, margin) => {
  const relNum = (st, end, rat) => st - (st - end) * rat;
  const [clat, clng] = hex.center;
  return margin === 0
    ? hex.vertices
    : hex.vertices
      .map(([elng, elat]) => [[elng, clng], [elat, clat]]
      .map(([st, end]) => relNum(st, end, HEX_MARGIN)));
}

const updateHexGlobeGeometry = (hexBins) => {
  return !hexBins.length
    ? new THREE.BufferGeometry()
    : BufferGeometryUtils.mergeBufferGeometries(hexBins.map(hex => {
      const geoJson = getNewGeoJson(hex, HEX_MARGIN);
      return new ConicPolygonGeometry(
        [geoJson],
        GLOBE_RADIUS,       // bottom height
        GLOBE_RADIUS + 0.1, // top height
        true,               // closed bottom
        true,               // closed top
        false,              // include sides
        HEX_CURVATURE_RES   // curvatureResolution
      );
    }));
}

const updateHexResultsGeometry = (bin) => {
  return new ConicPolygonGeometry(
    [getNewGeoJson(bin, HEX_MARGIN)],
    GLOBE_RADIUS,                       // bottom height
    GLOBE_RADIUS + bin.occurrences / 3, // top height
    true,                               // closed bottom
    true,                               // closed top
    true,                               // include sides
    HEX_CURVATURE_RES                   // curvatureResolution
  );
}

const polar2Cartesian = (lat, lng, relAltitude = 0) => {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  const r = GLOBE_RADIUS * (1 + relAltitude) + 0.1;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta)
  };
}

// Create hexGlobe object.
fetch(json).then(res => res.json()).then(({ features }) => {
  const h3Indexes = getH3Indexes(features);
  const hexBins = h3Indexes.map(index => getHexBin(index));
  hexGlobe.geometry = updateHexGlobeGeometry(hexBins);
  scene.add(hexGlobe);
}).catch(err => {
  console.log("Error Reading data " + err);
});

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

fetch(facets)
  .then(res => res.json())
  .then(({ facets }) => {
    const genusData = facets[0].counts;
    const randomGenusIdx = getRandomInt(0, genusData.length);
    return genusData[randomGenusIdx].name;
  })
  .then(genus => {
    const json = `${baseApiQuery}?limit=100&genusKey=${genus}`;

    fetch(json).then(res => res.json()).then(({ results }) => {
      resultsData = results
        // Filter out results with undefined coordinates.
        .filter(({ decimalLatitude, decimalLongitude }) => decimalLatitude && decimalLongitude)
        .map(result => {
          const { country, decimalLatitude, decimalLongitude } = result;
          const h3Index = geoToH3(decimalLatitude, decimalLongitude, HEX_RES);
          const hexBin = getHexBin(h3Index);
          return {
            country,
            coordinates: [decimalLatitude, decimalLongitude],
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

      // Hexagonal Results
      spotsMeshes = resultsData.map(bin => {
        return new THREE.Mesh(
          updateHexResultsGeometry(bin),
          new THREE.MeshBasicMaterial({color: "red"})
        );
      });
      spotsMeshes.forEach(spot => scene.add(spot));
    });
  });

// fetch end

// Handle mouse
const mouse = new THREE.Vector2();
let hoveredHexIdx = null;
let clickedHexIdx = null;

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX / sizes.width * 2 - 1;
  mouse.y = - (e.clientY / sizes.height * 2 - 1);
});

const getPixelPositionFromPolarCoords = (polarCoordinates) => {
  const { x, y, z } = polar2Cartesian(polarCoordinates[0], polarCoordinates[1]);
  const point = new THREE.Vector3(x, y, z).project(camera);
  return {
    x: (point.x + 1) / 2 * sizes.width,
    y: (point.y - 1) / 2 * sizes.height * -1
  }   
}

window.addEventListener('click', function() {
  if (hoveredHexIdx !== null) {
    clickedHexIdx = hoveredHexIdx;
    const clickedHexData = resultsData[clickedHexIdx]
    tooltipCountry.textContent = clickedHexData.country;
    tooltipOccurrences.textContent = clickedHexData.occurrences;
  }
});

// const clock = new THREE.Clock();

const tick = () => {
  // const elapsedTime = clock.getElapsedTime();

  // Add Raycaster
  if (spotsMeshes.length > 0) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(spotsMeshes);
    const intersectsMeshes = intersects.map(intersect => intersect.object);
    hoveredHexIdx = null;

    spotsMeshes.forEach((mesh, idx) => {
      if (intersectsMeshes.includes(mesh)) {
        mesh.material.color.set('blue');
        hoveredHexIdx = idx;
      } else {
        mesh.material.color.set('red');
      }
    });
  }
  if (clickedHexIdx !== null) {
    const clickedHexData = resultsData[clickedHexIdx]
    const polarCoordinates = clickedHexData.coordinates;
    const pxPosition = getPixelPositionFromPolarCoords(polarCoordinates);
    tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;
  }

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
