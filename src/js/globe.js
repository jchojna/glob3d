//// @ts-check

// #region // Imports //////////////////////////////////////////////////////////

import {
  getH3Indexes,
  getHexBin,
  getRandomInt,
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

const bfg = Object.assign({}, _bfg);
const BufferGeometryUtils = bfg.BufferGeometryUtils || bfg;

import json from 'url:../assets/data/world_low_geo.json';
import matcapImage from 'url:../assets/matcaps/matcap_1.png';

// #endregion //////////////////////////////////////////////////////////////////
// #region // Constants ////////////////////////////////////////////////////////

const GLOBE_RADIUS = 100;
const HEX_RES = 3;
const HEX_MARGIN = 0.2;
const HEX_CURVATURE_RES = 5;

const textureLoader = new THREE.TextureLoader();
const matcapTexture = textureLoader.load(matcapImage);

// #endregion //////////////////////////////////////////////////////////////////
// #region // Debug ////////////////////////////////////////////////////////////

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
const solidGlobeGeometry = new THREE.SphereBufferGeometry(GLOBE_RADIUS, 32, 32);
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
    GLOBE_RADIUS + 0.1,
    GLOBE_RADIUS + 0.1 + bin.occurrences / 3,
    true,
    true,
    true,
    HEX_CURVATURE_RES
  );
}

////////////////////////////////////////////////////////////////////////////////
// #region // asynchronous code ////////////////////////////////////////////////

const baseGbifUrl = 'https://api.gbif.org/v1/occurrence/search';
const facetsUrl = `${baseGbifUrl}?kingdomKey=1&phylumKey=44&classKey=212&facet=genusKey&genusKey.facetLimit=1200000&genusKey.facetOffset=0&limit=0`;

const getGenusDataUrl = (baseUrl, genus, limit) => {
  return `${baseUrl}?genusKey=${genus}&limit=${limit}`;
}

const getWikiUrl = (title, size = 300) => {
  return `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=${size}&origin=*`;
}

// Create hexGlobe object.
fetch(json).then(res => res.json()).then(({ features }) => {
  const h3Indexes = getH3Indexes(features, HEX_RES);
  const hexBins = h3Indexes.map(index => getHexBin(index));
  hexGlobe.geometry = updateHexGlobeGeometry(hexBins);
  scene.add(hexGlobe);
}).catch(err => {
  console.log("Error Reading data " + err);
});

fetch(facetsUrl)
  .then(res => res.json())
  .then(({ facets }) => {
    const genusData = facets[0].counts;
    const randomGenusIdx = getRandomInt(0, genusData.length);
    return genusData[randomGenusIdx].name;
  })
  .then(genus => {
    fetch(getGenusDataUrl(baseGbifUrl, genus, 1))
      .then(res => res.json())
      .then(({ results }) => {
        fetch(getWikiUrl(results[0].genus))
          .then(res => res.json())
          .then(({ query }) => {
            const { pages } = query;
            Object.values(pages).forEach(value => {
              const { source } = value.thumbnail;
              source ? console.log(source) : false;
            });
          })
          .catch((error) => console.log(error));
      })
      .catch((error) => console.log(error));

    fetch(getGenusDataUrl(baseGbifUrl, genus, 1000))
      .then(res => res.json())
      .then(({ results }) => {
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
            new THREE.MeshBasicMaterial({color: "red", side: THREE.DoubleSide})
          );
        });
        spotsMeshes.forEach(spot => scene.add(spot));
      });
      return genus;
  });

// #endregion //////////////////////////////////////////////////////////////////

// Handle mouse
const mouse = new THREE.Vector2();
let hoveredHexIdx = null;
let clickedHexIdx = null;

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX / sizes.width * 2 - 1;
  mouse.y = - (e.clientY / sizes.height * 2 - 1);
});

const getPixelPositionFromPolarCoords = (polarCoordinates) => {
  const { x, y, z } = polar2Cartesian(polarCoordinates[0], polarCoordinates[1], GLOBE_RADIUS);
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
    tooltipOccurrences.textContent = `${clickedHexData.occurrences} occurrences`;
  }
});

// const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const raycaster2 = new THREE.Raycaster();

////////////////////////////////////////////////////////////////////////////////
// #region // tick function ////////////////////////////////////////////////////
const tick = () => {
  // const elapsedTime = clock.getElapsedTime();

  // Add Raycaster
  if (spotsMeshes.length > 0) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([globe, ...spotsMeshes]);
    const intersectsMeshes = intersects.map(intersect => intersect.object);
    hoveredHexIdx = null;

    spotsMeshes.forEach((mesh, idx) => {
      if (intersectsMeshes.includes(mesh)) {
        const closestIntersect = intersects
          .sort((a, b) => a.distance - b.distance)[0]
          .object;
        if (closestIntersect === mesh) {
          mesh.material.color.set('blue');
          hoveredHexIdx = idx;
        }
      } else {
        if (idx !== clickedHexIdx) mesh.material.color.set('red');
      }
    });
  }
  // Handle tooltip visibility of the clicked hex.
  if (clickedHexIdx !== null) {
    const clickedHexData = resultsData[clickedHexIdx]
    const polarCoordinates = clickedHexData.center;
    const pxPosition = getPixelPositionFromPolarCoords(polarCoordinates);
    tooltip.style.transform = `translate(${pxPosition.x}px, ${pxPosition.y}px)`;

    // check collisions
    const { x, y, z } = polar2Cartesian(polarCoordinates[0], polarCoordinates[1], GLOBE_RADIUS);
    const point = new THREE.Vector3(x, y, z).project(camera);
    raycaster2.setFromCamera(point, camera);
    const intersects = raycaster2.intersectObjects([globe, spotsMeshes[clickedHexIdx]]);
    const closestIntersect = intersects.length > 0
    ? intersects.sort((a, b) => a.distance - b.distance)[0].object
    : null;

    closestIntersect === globe
    ? tooltip.classList.remove('tooltip--visible')
    : tooltip.classList.add('tooltip--visible');
  }

  renderer.render(scene, camera);
  controls.update();
  window.requestAnimationFrame(tick);
}
// #endregion //////////////////////////////////////////////////////////////////
tick();

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  aspectRatio = sizes.width / sizes.height;
  camera.aspect = aspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});
