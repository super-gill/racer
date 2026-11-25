/**
 * Camera. North-up: fixed orientation with a slight tilt so walls and mesas show depth.
 * Chase: rotates to sit behind the pod. Follows whichever pod is set as the target.
 */
import * as THREE from 'three';
import { camera, sun } from './scene.js';
import { tuning } from '../shared/tuning.js';
import { wrapAngle } from '../shared/utils.js';

/** Camera settings shared with the rest of the client. */
export const view = { cameraMode: 'north' };   // 'north' | 'chase'
let target = null;

/** Sets which pod the camera follows. */
export function followPod(pod) { target = pod; }

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camHeading = 0;

function cameraTargets(out, lookOut) {
  if (!target) return;
  const T = tuning;
  const h = T.cameraHeight + target.speed * T.cameraZoomWithSpeed;
  if (view.cameraMode === 'north') {
    lookOut.set(target.x + target.vx * 0.35, 0, target.y + target.vy * 0.35);
    out.set(lookOut.x, h, lookOut.z + h * 0.3);
  } else {
    const fx = Math.cos(camHeading), fy = Math.sin(camHeading);
    lookOut.set(target.x + fx * 14, 0, target.y + fy * 14);
    out.set(target.x - fx * h * 0.55, h * 0.75, target.y - fy * h * 0.55);
  }
}

/** Jumps straight to the target pod (race start, restart). */
export function snapCamera() {
  if (!target) return;
  camHeading = target.heading;
  cameraTargets(camPos, camLook);
}

const _desiredPos = new THREE.Vector3(), _desiredLook = new THREE.Vector3();
export function updateCamera(dt) {
  if (!target) return;
  camHeading += wrapAngle(target.heading - camHeading) * (1 - Math.exp(-3.5 * dt));
  cameraTargets(_desiredPos, _desiredLook);
  camPos.lerp(_desiredPos, 1 - Math.exp(-5 * dt));
  camLook.lerp(_desiredLook, 1 - Math.exp(-8 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  // Keep the shadow area centred on what you are looking at.
  sun.position.set(camLook.x + 90, 160, camLook.z + 50);
  sun.target.position.copy(camLook);
}

