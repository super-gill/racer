/**
 * Draws one pod from its simulation state. Handles bob, bank, cockpit swing, exhaust,
 * afterburner plume, reverser buckets, heat glow, trail effects, and the debris when it wrecks.
 * Nothing here changes the simulation.
 */
import * as THREE from 'three';
import { scene } from './scene.js';
import { particles, COLORS, effects } from './effects.js';
import { engineRunning } from '../shared/physics.js';
import { tuning } from '../shared/tuning.js';
import { clamp, damp, randRange } from '../shared/utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _world = new THREE.Vector3();

/** Stretches a unit cylinder so it runs from point a to point b (used for tether cables). */
function stretchBetween(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, _dir.divideScalar(len || 1));
  mesh.scale.set(1, len, 1);
}

const sharedDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.6, roughness: 0.5, flatShading: true });
const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.6 });
const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2a33, metalness: 0.8, roughness: 0.15 });
const cableGeometry = new THREE.CylinderGeometry(0.07, 0.07, 1, 5);

// Pod layout in pod-local space: +X forward, +Z right, +Y up.
const ENGINE_X = 2.6, ENGINE_Z = 1.9, COCKPIT_X = -4.4;

function makeEngine(color) {
  const group = new THREE.Group();
  const hullMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 4.4, 10).rotateZ(Math.PI / 2), hullMaterial);
  const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.5, 10).rotateZ(Math.PI / 2), sharedDarkMaterial);
  intake.position.x = 2.2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 10).rotateZ(-Math.PI / 2), sharedDarkMaterial);
  nose.position.x = 2.85;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.12), hullMaterial);
  fin.position.set(-1.2, 0.6, 0);
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false });

  // Dry exhaust glow at the nozzle.
  const exhaustMaterial = additive(0xff9a3c, 0.9);
  const exhaust = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), exhaustMaterial);
  exhaust.position.x = -2.35;

  // Afterburner plume: orange outer cone, blue-white core, shock diamonds. Scaled by how lit it is.
  const flame = new THREE.Group();
  flame.position.x = -2.35;
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.62, 4.5, 12, 1, true).rotateZ(Math.PI / 2), additive(0xff6a1a, 0.8));
  outer.position.x = -2.25;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.6, 10, 1, true).rotateZ(Math.PI / 2), additive(0x9fc8ff, 0.95));
  core.position.x = -1.3;
  flame.add(outer, core);
  for (const x of [-1.0, -2.0, -3.0]) {
    const diamond = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), additive(0xfff2d8, 0.85));
    diamond.position.x = x;
    flame.add(diamond);
  }
  flame.visible = false;

  // Thrust reverser buckets: lie along the nozzle when stowed, swing in behind it when deployed.
  const reverserPivots = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(-2.2, 0, side * 0.55);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.08), sharedDarkMaterial);
    plate.position.x = 0.45;
    pivot.add(plate);
    pivot.userData.side = side;
    return pivot;
  });

  group.add(body, intake, nose, fin, exhaust, flame, ...reverserPivots);
  return { group, hullMaterial, exhaust, exhaustMaterial, flame, reverserPivots };
}

function makeCockpit(color) {
  const group = new THREE.Group();
  const hullMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), metalness: 0.3,
    roughness: 0.5, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hullMaterial);
  body.scale.set(1.7, 0.7, 1.0);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glassMaterial);
  canopy.position.set(0.4, 0.4, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), hullMaterial);
  tail.position.set(-1.4, 0.5, 0);
  group.add(body, canopy, tail);
  return group;
}


export class PodView {
  constructor(pod) {
    this.pod = pod;
    this.hover = tuning.hoverHeight;
    this.swing = this.bank = this.pitch = 0;
    this.dustCarry = 0;
    this.debris = null;
    this.build();
  }

  build() {
    const color = this.pod.color;
    this.root = new THREE.Group();       // yaw and position
    this.body = new THREE.Group();       // bank and pitch
    this.root.add(this.body);
    this.engineL = makeEngine(color);
    this.engineR = makeEngine(color);
    this.cockpit = makeCockpit(color);
    this.body.add(this.engineL.group, this.engineR.group, this.cockpit);
    this.pieces = [
      { object: this.engineL.group, base: new THREE.Vector3(ENGINE_X, 0, -ENGINE_Z) },
      { object: this.engineR.group, base: new THREE.Vector3(ENGINE_X, 0, ENGINE_Z) },
      { object: this.cockpit, base: new THREE.Vector3(COCKPIT_X, 0, 0) },
    ];
    this.cables = [0, 1, 2].map(() => new THREE.Mesh(cableGeometry, cableMaterial));
    this.body.add(...this.cables);
    this.root.traverse((o) => { if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) o.castShadow = true; });
    scene.add(this.root);
    this.resetPieces();
  }

  /** Puts the pieces back together (after a respawn or restart). */
  resetPieces() {
    for (const piece of this.pieces) {
      piece.object.position.copy(piece.base);
      piece.object.rotation.set(0, 0, 0);
    }
    this.cables.forEach((c) => (c.visible = true));
    this.debris = null;
    this.root.visible = true;
    this.hover = tuning.hoverHeight;
  }

  /** The pod wrecked: pieces fly apart. vx, vy is the pod's velocity at impact. */
  onCrash(vx, vy) {
    const pod = this.pod;
    const fx = Math.cos(pod.heading), fy = Math.sin(pod.heading);
    const forward = vx * fx + vy * fy;
    const right = vx * -fy + vy * fx;
    this.debris = this.pieces.map((piece) => ({
      piece,
      vel: new THREE.Vector3(forward * 0.45 + randRange(-6, 6), randRange(8, 16), right * 0.45 + randRange(-8, 8)),
      spin: new THREE.Vector3(randRange(-9, 9), randRange(-9, 9), randRange(-9, 9)),
      landed: false,
    }));
    this.cables.forEach((c) => (c.visible = false));
    this.body.rotation.set(0, 0, 0);
    this.root.position.set(pod.x, 0, pod.y);
  }

  /** Runs once per rendered frame. */
  update(dt, time) {
    const pod = this.pod;
    if (pod.state === 'crashed') { this.updateDebris(dt); return; }
    const T = tuning;
    const speed = pod.speed;
    const speedNorm = clamp(speed / 100, 0, 1.3);
    this.root.position.set(pod.x, 0, pod.y);
    this.root.rotation.y = -pod.heading;
    this.root.visible = pod.ghostTimer <= 0 || Math.floor(time * 12) % 2 === 0;

    // Each piece bobs on its own rhythm; faster means more ground buzz. A dead pod drops to the ground.
    const t = time + pod.name.length * 1.3;
    const alive = pod.state !== 'dead';
    this.hover = damp(this.hover, alive ? T.hoverHeight : 0.45, alive ? 4 : 12, dt);
    const bob = alive ? T.bobAmount : 0;
    const buzz = alive ? speedNorm * 0.06 : 0;
    this.pieces[0].object.position.y = this.hover + bob * Math.sin(t * 5.1) + buzz * Math.sin(t * 31);
    this.pieces[1].object.position.y = this.hover + bob * Math.sin(t * 4.7 + 1.3) + buzz * Math.sin(t * 29 + 2);
    this.pieces[2].object.position.y = this.hover * 0.8 + bob * 0.6 * Math.sin(t * 3.3 + 2);

    // Cockpit swings out on its tethers in turns; whole pod banks into the turn and pitches with acceleration.
    this.swing = damp(this.swing, clamp(-pod.angVel * 0.45 * speedNorm, -1.3, 1.3), 5, dt);
    this.pieces[2].object.position.z = this.swing;
    this.bank = damp(this.bank, clamp(pod.angVel * T.bankAmount * (0.3 + speedNorm), -0.5, 0.5), 6, dt);
    this.pitch = damp(this.pitch, clamp(pod.forwardAccel * 0.004, -0.12, 0.12), 4, dt);
    this.body.rotation.set(this.bank, 0, this.pitch);

    // Nozzle glow follows revs, afterburner plume follows how lit it is,
    // reverser buckets swing in behind the nozzle, heat tints the engine red.
    for (const [visual, engine] of this.engines()) {
      const running = engineRunning(pod, engine);
      visual.exhaust.visible = running && engine.reverser < 0.5;
      visual.exhaust.scale.setScalar(0.35 + engine.power * 0.7 + Math.random() * 0.12);
      visual.exhaustMaterial.color.set(engine.power > 0.9 ? 0xffc070 : 0xff8a30);
      const lit = engine.afterburner;
      visual.flame.visible = lit > 0.02;
      if (visual.flame.visible) {
        const flicker = 0.85 + Math.random() * 0.3;
        visual.flame.scale.set(lit * flicker, 0.75 + 0.25 * lit, 0.75 + 0.25 * lit);
      }
      for (const pivot of visual.reverserPivots) pivot.rotation.y = pivot.userData.side * engine.reverser * 2.2;
      const heatGlow = clamp((engine.heat - 0.5) * 2, 0, 1);
      visual.hullMaterial.emissive.setRGB(heatGlow * 0.8, heatGlow * 0.12, 0);
    }

    // Cables: each engine back to the cockpit, plus a coupling between the engine noses.
    const eL = this.pieces[0].object.position, eR = this.pieces[1].object.position, ck = this.pieces[2].object.position;
    stretchBetween(this.cables[0], _a.set(eL.x - 2, eL.y, eL.z), _b.set(ck.x + 1.4, ck.y + 0.1, ck.z - 0.45));
    stretchBetween(this.cables[1], _a.set(eR.x - 2, eR.y, eR.z), _b.set(ck.x + 1.4, ck.y + 0.1, ck.z + 0.45));
    stretchBetween(this.cables[2], _a.set(eL.x + 1.6, eL.y, eL.z + 0.6), _b.set(eR.x + 1.6, eR.y, eR.z - 0.6));

    this.root.updateMatrixWorld(true);
    this.spawnTrailEffects(dt, speed);
  }

  /** Pairs of [visual, simulation state] for the two engines. */
  engines() {
    const c = this.pod.components;
    return [[this.engineL, c.engineL], [this.engineR, c.engineR]];
  }

  spawnTrailEffects(dt, speed) {
    const pod = this.pod;
    const engines = this.engines();
    // Dust kicked up under the engines, more with speed.
    this.dustCarry += speed * dt * 0.22;
    while (this.dustCarry >= 1) {
      this.dustCarry -= 1;
      const [visual] = engines[Math.random() < 0.5 ? 0 : 1];
      visual.exhaust.getWorldPosition(_world);
      particles.spawn(_world.x + randRange(-0.8, 0.8), 0.4, _world.z + randRange(-0.8, 0.8),
        pod.vx * 0.12 + randRange(-2, 2), randRange(0.5, 2), pod.vy * 0.12 + randRange(-2, 2),
        { size: randRange(1, 1.8), grow: 4.5, life: randRange(0.9, 1.6), color: COLORS.dust, alpha: 0.32 });
    }
    const fx = Math.cos(pod.heading), fy = Math.sin(pod.heading);
    for (const [visual, engine] of engines) {
      visual.exhaust.getWorldPosition(_world);
      if (engine.afterburner > 0.3 && Math.random() < 0.8) {
        particles.spawn(_world.x - fx * 3, _world.y, _world.z - fy * 3, pod.vx * 0.6 - fx * 20, 0, pod.vy * 0.6 - fy * 20,
          { size: 0.9, grow: -1.5, life: 0.2, color: COLORS.boost, alpha: 0.9, drag: 3 });
      }
      // Reversed exhaust blows forward and out past the buckets.
      if (engine.reverser > 0.5 && engine.power > 0.15 && Math.random() < 0.6) {
        const side = randRange(-1, 1) * 8;
        particles.spawn(_world.x, _world.y, _world.z, pod.vx + fx * 12 - fy * side, randRange(0, 2), pod.vy + fy * 12 + fx * side,
          { size: 0.8, grow: 3, life: 0.5, color: COLORS.dust, alpha: 0.35, drag: 3 });
      }
      if ((engine.flameout > 0 || engine.heat > 0.85) && Math.random() < 0.5) {
        particles.spawn(_world.x, _world.y + 0.3, _world.z, pod.vx * 0.3, randRange(1, 3), pod.vy * 0.3,
          { size: 1, grow: 3, life: 1.2, color: COLORS.smoke, alpha: 0.45, drag: 1.2 });
      }
    }
  }

  updateDebris(dt) {
    if (!this.debris) return;
    for (const d of this.debris) {
      const obj = d.piece.object;
      d.vel.y -= 30 * dt;
      obj.position.addScaledVector(d.vel, dt);
      obj.rotation.x += d.spin.x * dt; obj.rotation.y += d.spin.y * dt; obj.rotation.z += d.spin.z * dt;
      if (obj.position.y < 0.5) {
        obj.position.y = 0.5;
        if (!d.landed) {
          d.landed = true;
          obj.getWorldPosition(_world);
          effects.dustBurst(_world.x, _world.z, 14);
          effects.scorch(_world.x, _world.z, randRange(2, 3.5));
        }
        d.vel.y = -d.vel.y * 0.3;
        d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.6);
      } else if (Math.random() < 0.4) {
        obj.getWorldPosition(_world);
        particles.spawn(_world.x, _world.y, _world.z, 0, 1, 0,
          { size: 1.2, grow: 3, life: 1, color: COLORS.smoke, alpha: 0.5 });
      }
    }
  }
}
