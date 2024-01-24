import {
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhongMaterial,
  SphereBufferGeometry,
  TextureLoader
} from 'three';

const THREE = window.THREE
  ? window.THREE
  : {
    Color,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshPhongMaterial,
    SphereBufferGeometry,
    TextureLoader
  };