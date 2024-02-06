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
import json from 'url:../assets/data/world_low_geo.json';
import matcapImage from 'url:../assets/matcaps/matcap_1.png';

// #endregion //////////////////////////////////////////////////////////////////
// #region // Class ////////////////////////////////////////////////////////////

class World {
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
    this.spotsMeshes = [];
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
    // camera
    this.camera = new THREE.PerspectiveCamera(55, this.aspectRatio, 1, 2000);
    this.camera.position.z = 150;
    this.camera.position.y = 150;
    // controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
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
      // Filter out results with undefined coordinates.
      .filter(({ decimalLatitude, decimalLongitude }) => decimalLatitude && decimalLongitude)
      .map(result => {
        const { country, decimalLatitude, decimalLongitude } = result;
        const h3Index = geoToH3(decimalLatitude, decimalLongitude, /* HEX_RES */ 3);
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
  }

  visualizeResult(aggregatedData) {
    return aggregatedData.map(bin => {
      return new THREE.Mesh(
        this.updateHexResultsGeometry(bin),
        new THREE.MeshBasicMaterial({color: "red", side: THREE.DoubleSide})
      );
    }).forEach(spot => this.scene.add(spot));
  }

  tick() {
    this.renderer.render(this.scene, this.camera);
    this.controls.update();
    return window.requestAnimationFrame(() => this.tick());
  }
}







// return false;

// #endregion //////////////////////////////////////////////////////////////////
// #region // Debug ////////////////////////////////////////////////////////////

// const gui = new dat.GUI();
// gui.addColor(solidGlobeMaterial, 'color');
// gui.add(solidGlobeMaterial, 'opacity').min(0).max(1).step(0.01);



////////////////////////////////////////////////////////////////////////////////
// #region // outside script ///////////////////////////////////////////////////

const baseGbifUrl = 'https://api.gbif.org/v1/occurrence/search';
const facetsUrl = `${baseGbifUrl}?kingdomKey=1&phylumKey=44&classKey=212&facet=genusKey&genusKey.facetLimit=1200000&genusKey.facetOffset=0&limit=0`;

const getGenusDataUrl = (baseUrl, genus, limit) => {
  return `${baseUrl}?genusKey=${genus}&limit=${limit}`;
}

const getWikiUrl = (title, size = 300) => {
  return `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=${size}&origin=*`;
}

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
        const inputData = getInputData(results);
        console.log(inputData)
        const worldInstance = new World(120);
        worldInstance.tick();
        worldInstance.createHexGlobe();
        const aggr = worldInstance.aggregateData(inputData);
        worldInstance.visualizeResult(aggr);
      });
      return genus;
  });


const getInputData = (dataArr) => {
  return dataArr.map(({
    continent,
    country,
    countryCode,
    decimalLatitude,
    decimalLongitude,
    genus,
    kingdom,
    species,
    eventDate
  }) => ({
    name: species,
    decimalLatitude,
    decimalLongitude,
    date: new Date(eventDate),
    country,
    // continent,
    // countryCode,
    // genus,
    // kingdom
  }))
}

// #endregion //////////////////////////////////////////////////////////////////
return false;
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
  // if (spotsMeshes.length > 0) {
  //   raycaster.setFromCamera(mouse, camera);
  //   const intersects = raycaster.intersectObjects([globe, ...spotsMeshes]);
  //   const intersectsMeshes = intersects.map(intersect => intersect.object);
  //   hoveredHexIdx = null;

  //   spotsMeshes.forEach((mesh, idx) => {
  //     if (intersectsMeshes.includes(mesh)) {
  //       const closestIntersect = intersects
  //         .sort((a, b) => a.distance - b.distance)[0]
  //         .object;
  //       if (closestIntersect === mesh) {
  //         mesh.material.color.set('blue');
  //         hoveredHexIdx = idx;
  //       }
  //     } else {
  //       if (idx !== clickedHexIdx) mesh.material.color.set('red');
  //     }
  //   });
  // }
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
