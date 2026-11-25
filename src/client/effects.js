/**
 * Visual effects: one pooled particle system (dust, sparks, fire, smoke) drawn as soft
 * round points, plus pooled scorch marks left by wrecks.
 */
import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { randRange } from '../shared/utils.js';

export class ParticleSystem {
  constructor(max) {
    this.max = max;
    this.next = 0;
    this.position = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.velocity = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.startAlpha = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5 || vAlpha <= 0.0) discard;
          gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.1, d));
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, { size = 1, grow = 0, life = 1, color = [1, 1, 1], alpha = 1, gravity = 0, drag = 1.5 } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.position.set([x, y, z], i * 3);
    this.velocity.set([vx, vy, vz], i * 3);
    this.color.set(color, i * 3);
    this.size[i] = size; this.grow[i] = grow;
    this.life[i] = life; this.maxLife[i] = life;
    this.alpha[i] = alpha; this.startAlpha[i] = alpha;
    this.gravity[i] = gravity; this.drag[i] = drag;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      const slow = Math.exp(-this.drag[i] * dt);
      this.velocity[k] *= slow; this.velocity[k + 2] *= slow;
      this.velocity[k + 1] = this.velocity[k + 1] * slow - this.gravity[i] * dt;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] = Math.max(0.1, this.position[k + 1] + this.velocity[k + 1] * dt);
      this.position[k + 2] += this.velocity[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = Math.max(0, this.startAlpha[i] * (this.life[i] / this.maxLife[i]));
    }
    for (const name of ['position', 'aAlpha', 'aSize', 'aColor']) this.geometry.attributes[name].needsUpdate = true;
  }

  /** Keeps point sizes in world units whatever the window size. */
  resize() {
    this.material.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
}

export const particles = new ParticleSystem(2500);

export const COLORS = {
  dust: [0.84, 0.69, 0.50],
  spark: [1.0, 0.75, 0.35],
  fire: [1.0, 0.55, 0.18],
  smoke: [0.22, 0.19, 0.17],
  exhaust: [1.0, 0.62, 0.25],
  boost: [1.0, 0.92, 0.75],
};

// Scorch marks left on the ground by wrecks. Pooled, oldest reused first.
export const scorchMarks = [];
let nextScorch = 0;
{
  const geo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x1a120c, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.visible = false;
    scene.add(mesh);
    scorchMarks.push(mesh);
  }
}

export const effects = {
  scorch(x, z, size) {
    const mark = scorchMarks[nextScorch];
    nextScorch = (nextScorch + 1) % scorchMarks.length;
    mark.position.set(x, 0.07, z);
    mark.scale.setScalar(size);
    mark.visible = true;
  },
  sparks(x, z, strength) {
    const count = Math.min(6, 1 + Math.floor(strength / 12));
    for (let i = 0; i < count; i++) {
      particles.spawn(x, 1, z, randRange(-15, 15), randRange(4, 12), randRange(-15, 15),
        { size: 0.35, life: randRange(0.2, 0.45), color: COLORS.spark, alpha: 1, gravity: 30, drag: 0.5 });
    }
  },
  dustBurst(x, z, amount = 20) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2, s = randRange(4, 16);
      particles.spawn(x, 0.6, z, Math.cos(a) * s, randRange(0.5, 3), Math.sin(a) * s,
        { size: randRange(1.5, 3), grow: 5, life: randRange(1, 2.2), color: COLORS.dust, alpha: 0.5 });
    }
  },
  explosion(x, y, z) {
    for (let i = 0; i < 40; i++) {
      particles.spawn(x, y, z, randRange(-14, 14), randRange(2, 14), randRange(-14, 14),
        { size: randRange(1.5, 3), grow: 7, life: randRange(0.35, 0.7), color: COLORS.fire, alpha: 0.95, drag: 2.5 });
    }
    for (let i = 0; i < 30; i++) {
      particles.spawn(x + randRange(-2, 2), y, z + randRange(-2, 2), randRange(-4, 4), randRange(3, 8), randRange(-4, 4),
        { size: randRange(2, 3.5), grow: 5, life: randRange(1.5, 2.8), color: COLORS.smoke, alpha: 0.55, drag: 1 });
    }
    this.dustBurst(x, z, 30);
  },
};

/** Clears scorch marks, e.g. on a restart. */
export function clearScorchMarks() {
  for (const m of scorchMarks) m.visible = false;
}
