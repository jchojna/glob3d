import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
};

const DEFAULT_DURATION = 900;

export default class CameraTransition {
  #camera: THREE.PerspectiveCamera;
  #controls: OrbitControls;
  #defaultPose: CameraPose;
  #duration: number;
  #from: CameraPose;
  #to: CameraPose;
  #startTime: number;
  #transitioning: boolean;
  #focused: boolean;
  #restoreAutoRotate: boolean;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    duration = DEFAULT_DURATION
  ) {
    this.#camera = camera;
    this.#controls = controls;
    this.#defaultPose = this.#capturePose();
    this.#duration = duration;
    this.#from = this.#capturePose();
    this.#to = this.#capturePose();
    this.#startTime = 0;
    this.#transitioning = false;
    this.#focused = false;
    this.#restoreAutoRotate = controls.autoRotate;
  }

  focus(position: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3) {
    if (!this.#focused) {
      this.#restoreAutoRotate = this.#controls.autoRotate;
    }
    this.#focused = true;
    this.#controls.autoRotate = false;
    this.#startTransition({ position, target, up });
  }

  reset() {
    if (!this.#focused && !this.#transitioning) return false;
    this.#focused = false;
    this.#controls.autoRotate = false;
    this.#startTransition(this.#defaultPose);
    return true;
  }

  update() {
    if (!this.#transitioning) return false;

    const elapsed = performance.now() - this.#startTime;
    const progress = THREE.MathUtils.clamp(elapsed / this.#duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    this.#camera.position.lerpVectors(
      this.#from.position,
      this.#to.position,
      eased
    );
    this.#controls.target.lerpVectors(
      this.#from.target,
      this.#to.target,
      eased
    );
    this.#camera.up.lerpVectors(this.#from.up, this.#to.up, eased).normalize();
    this.#controls.update();

    if (progress === 1) {
      this.#transitioning = false;
      this.#controls.enabled = !this.#focused;
      if (!this.#focused) {
        this.#controls.autoRotate = this.#restoreAutoRotate;
      }
    }
    return true;
  }

  #startTransition(pose: CameraPose) {
    this.#from = this.#capturePose();
    this.#to = {
      position: pose.position.clone(),
      target: pose.target.clone(),
      up: pose.up.clone().normalize(),
    };
    this.#startTime = performance.now();
    this.#transitioning = true;
    this.#controls.enabled = false;
  }

  #capturePose(): CameraPose {
    return {
      position: this.#camera.position.clone(),
      target: this.#controls.target.clone(),
      up: this.#camera.up.clone(),
    };
  }
}
