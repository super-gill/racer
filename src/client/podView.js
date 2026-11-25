/**
 * Draws one pod from its simulation state, using the Pod Factory model built from the pod's
 * Workshop spec. Handles bob, bank, cockpit swing, exhaust, afterburner plume, reverser buckets,
 * heat glow, trail effects, and the debris when it wrecks. Nothing here changes the simulation.
 */
import * as THREE from 'three';
import { scene } from './scene.js';
import { particles, COLORS, effects } from './effects.js';
import { PodFactory } from './podFactory.js';
import { engineRunning } from '../shared/physics.js';
import { tuning } from '../shared/tuning.js';
import { clamp, damp, randRange } from '../shared/utils.js';

const _world = new THREE.Vector3();
const RACE_TEXTURE_SIZE = 512;      // livery detail in a race; numbers can't be read at race distance anyway

export class PodView {
  constructor(pod) {
    this.pod = pod;
    this.hover = tuning.hoverHeight;
    this.swing = this.bank = this.pitch = 0;
    this.dustCarry = 0;
    this.debris = null;
    this.model = PodFactory.buildPod(pod.spec, { textureSize: RACE_TEXTURE_SIZE });
    this.root = this.model.root;
    this.body = this.model.body;
    this.pieces = [
      ...this.model.engines.map((e) => ({ object: e.group, base: e.base })),
      { object: this.model.cockpit, base: this.model.cockpitBase },
    ];
    scene.add(this.root);
    this.resetPieces();
  }

  /** Puts the pieces back together (after a respawn or restart). */
  resetPieces() {
    for (const piece of this.pieces) {
      piece.object.position.copy(piece.base);
      piece.object.rotation.set(0, 0, 0);
    }
    this.model.links.visible = true;
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
    this.model.links.visible = false;
    for (const e of this.model.engines) { e.flame.visible = false; e.exhaust.visible = false; }
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
    const [engineL, engineR, cockpit] = this.pieces.map((p) => p.object);
    engineL.position.y = this.hover + bob * Math.sin(t * 5.1) + buzz * Math.sin(t * 31);
    engineR.position.y = this.hover + bob * Math.sin(t * 4.7 + 1.3) + buzz * Math.sin(t * 29 + 2);
    cockpit.position.y = this.hover * 0.8 + bob * 0.6 * Math.sin(t * 3.3 + 2);

    // Cockpit swings out on its tethers in turns; whole pod banks into the turn and pitches with acceleration.
    this.swing = damp(this.swing, clamp(-pod.angVel * 0.45 * speedNorm, -1.3, 1.3), 5, dt);
    cockpit.position.z = this.swing;
    this.bank = damp(this.bank, clamp(pod.angVel * T.bankAmount * (0.3 + speedNorm), -0.5, 0.5), 6, dt);
    this.pitch = damp(this.pitch, clamp(pod.forwardAccel * 0.004, -0.12, 0.12), 4, dt);
    this.body.rotation.set(this.bank, 0, this.pitch);
    this.model.updateLinks();

    // Nozzle glow follows revs, afterburner plume follows how lit it is,
    // reverser buckets swing in behind the nozzle, heat tints the engine red.
    for (const [visual, engine] of this.engines()) {
      const running = engineRunning(pod, engine);
      visual.exhaust.visible = running && engine.reverser < 0.5;
      visual.exhaust.scale.setScalar(0.45 + engine.power * 0.7 + Math.random() * 0.12);
      visual.exhaustMaterial.color.set(engine.power > 0.9 ? 0xffc070 : 0xff8a30);
      const lit = engine.afterburner;
      visual.flame.visible = lit > 0.02;
      if (visual.flame.visible) {
        const flicker = 0.85 + Math.random() * 0.3;
        visual.flame.scale.set(lit * flicker, 0.75 + 0.25 * lit, 0.75 + 0.25 * lit);
      }
      for (const pivot of visual.reverserPivots) pivot.rotation.y = pivot.userData.side * engine.reverser * 2.2;
      const heatGlow = clamp((engine.heat - 0.5) * 2, 0, 1);
      visual.material.emissive.setRGB(heatGlow * 0.8, heatGlow * 0.12, 0);
    }

    this.root.updateMatrixWorld(true);
    this.spawnTrailEffects(dt, speed);
  }

  /** Pairs of [model engine, simulation engine state], left then right. */
  engines() {
    const c = this.pod.components;
    return [[this.model.engines[0], c.engineL], [this.model.engines[1], c.engineR]];
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
