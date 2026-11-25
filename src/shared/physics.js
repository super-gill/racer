/**
 * Physics. Flat 2D: each engine pushes along the pod's heading, the thrust difference between
 * the engines turns the pod, and sideways sliding is bled off by grip. Height is visual only.
 * Includes the jet engine model (spool, reverser, afterburner, heat, fuel) and all collisions.
 */
import { COLLISION_CIRCLES, FUEL_CAPACITY, IDLE_SPOOL, TRACK_HALF_WIDTH } from './config.js';
import { track, nearestOnTrack, obstacles } from './track.js';
import { tuning } from './tuning.js';
import { clamp, damp, randRange, wrapAngle } from './utils.js';
import { emit } from './events.js';

export const engineRunning = (pod, engine) => pod.fuel > 0 && engine.flameout <= 0 && !pod.dnf;

/**
 * One jet engine for one physics step: reverser, revs, afterburner, heat, fuel, thrust.
 * lever: -1 (full reverse) to 1 (full forward). Below zero the reverser deploys.
 * Returns thrust in force units, negative when reversing.
 */
export function updateEngine(pod, engine, lever, afterburnerRequest, dt) {
  const T = tuning;
  if (engine.flameout > 0) engine.flameout -= dt;
  const running = engineRunning(pod, engine);

  // Reverser buckets move towards deployed when the lever is below idle.
  engine.reverser = clamp(engine.reverser + (lever < 0 ? 1 : -1) * T.reverserRate * dt, 0, 1);

  // Revs chase the lever. Slow to spool up from idle, quicker near the top, quicker still to spool down.
  const target = running ? IDLE_SPOOL + (1 - IDLE_SPOOL) * Math.abs(lever) : 0;
  const diff = target - engine.spool;
  const rate = diff > 0 ? T.spoolUpRate * (0.35 + 0.65 * engine.spool) : T.spoolDownRate;
  engine.spool += diff * (1 - Math.exp(-rate * dt));
  engine.power = clamp((engine.spool - IDLE_SPOOL) / (1 - IDLE_SPOOL), 0, 1);

  // Afterburner only lights with the lever at full, revs at the top and the reverser stowed.
  const canLight = running && afterburnerRequest && lever >= 0.98 && engine.spool >= 0.95 && engine.reverser === 0;
  engine.afterburner = canLight ? Math.min(1, engine.afterburner + dt / T.afterburnerLightTime)
    : Math.max(0, engine.afterburner - dt * 6);

  // Heat: revs warm the engine, the afterburner much more. Full heat flames it out.
  const heatGain = T.heatRate * engine.power + T.heatRate * (T.afterburnerHeatMult - 1) * engine.afterburner;
  const cooling = T.coolRate * (engine.flameout > 0 ? 1.5 : 1);
  engine.heat = clamp(engine.heat + (heatGain - cooling) * dt, 0, 1);
  if (engine.heat >= 1 && engine.flameout <= 0) { engine.flameout = T.flameoutTime; engine.afterburner = 0; }

  // Fuel: idle, dry revs and afterburner all burn from the shared tank.
  if (running) {
    pod.fuel -= (T.fuelBurnIdle + T.fuelBurnDry * engine.power + T.fuelBurnAfterburner * engine.afterburner) * dt;
  }

  // Thrust. Jet thrust climbs steeply with revs. The reverser turns it backwards at reduced power.
  if (!running) { engine.thrust = 0; return 0; }
  const dry = T.idleThrust + (1 - T.idleThrust) * Math.pow(engine.power, 1.5);
  const direction = 1 - 2 * engine.reverser;                      // 1 forward, -1 fully reversed
  const reverserLoss = direction < 0 ? T.reverseThrust : 1;
  const health = 0.4 + 0.6 * engine.integrity;                     // damaged engines push less (from v0.2)
  engine.thrust = dry * (1 + (T.afterburnerThrust - 1) * engine.afterburner) * direction * reverserLoss * health;
  return engine.thrust * T.engineThrust;
}

/** Fuel is weight: a full tank makes the pod accelerate and turn more slowly. */
export const podMass = (pod) => 1 + tuning.fuelWeight * (pod.fuel / FUEL_CAPACITY);

/** held: on the grid during the countdown, engines run but the pod is clamped in place. */
export function stepPodPhysics(pod, controls, dt, held = false) {
  const T = tuning;
  const fx = Math.cos(pod.heading), fy = Math.sin(pod.heading);
  const rx = -fy, ry = fx;

  const thrustL = updateEngine(pod, pod.components.engineL, controls.left, controls.boost, dt);
  const thrustR = updateEngine(pod, pod.components.engineR, controls.right, controls.boost, dt);
  if (held) { pod.vx = pod.vy = pod.angVel = 0; return; }
  const mass = podMass(pod);

  // Linear motion: thrust along heading, minus drag, divided by mass.
  const speed = pod.speed;
  const drag = T.linearDrag + T.quadDrag * speed + T.turnDrag * Math.abs(pod.angVel);
  pod.vx += ((fx * (thrustL + thrustR) - pod.vx * drag) / mass) * dt;
  pod.vy += ((fy * (thrustL + thrustR) - pod.vy * drag) / mass) * dt;

  // Grip: split velocity into forward and sideways, and bleed off the sideways part.
  const forward = pod.vx * fx + pod.vy * fy;
  const sideways = (pod.vx * rx + pod.vy * ry) * Math.exp(-T.lateralGrip * dt);
  pod.vx = fx * forward + rx * sideways;
  pod.vy = fy * forward + ry * sideways;
  pod.forwardAccel = damp(pod.forwardAccel, (forward - pod.lastForwardSpeed) / dt, 10, dt);
  pod.lastForwardSpeed = forward;

  // Turning comes only from the engines: left engine stronger turns right (positive angular velocity).
  const torque = ((thrustL - thrustR) / T.engineThrust) * T.turnGain / mass;
  pod.angVel += (torque - pod.angVel * T.angularDamping) * dt;
  pod.heading = wrapAngle(pod.heading + pod.angVel * dt);

  pod.x += pod.vx * dt;
  pod.y += pod.vy * dt;
}

/** A pod out of fuel: on the ground, sliding to a stop. */
export function stepDeadPod(pod, dt) {
  const friction = Math.exp(-1.6 * dt);
  pod.vx *= friction; pod.vy *= friction;
  pod.angVel *= Math.exp(-3 * dt);
  pod.heading = wrapAngle(pod.heading + pod.angVel * dt);
  pod.x += pod.vx * dt;
  pod.y += pod.vy * dt;
  for (const e of [pod.components.engineL, pod.components.engineR]) {
    e.spool *= Math.exp(-1.5 * dt);
    e.power = 0; e.afterburner = 0; e.thrust = 0;
    e.heat = Math.max(0, e.heat - tuning.coolRate * dt);
  }
}

/** World positions of a pod's collision circles. */
export function collisionCircles(pod) {
  const fx = Math.cos(pod.heading), fy = Math.sin(pod.heading);
  return COLLISION_CIRCLES.map(([offset, r]) => ({ x: pod.x + fx * offset, y: pod.y + fy * offset, r }));
}

/**
 * Pushes a pod out along a contact normal and handles the impact.
 * nx, ny point from the obstacle into the pod. canWreck is false during the countdown.
 * Returns false if the pod wrecked.
 */
function resolveImpact(pod, nx, ny, penetration, contactX, contactY, kind, canWreck) {
  pod.x += nx * penetration;
  pod.y += ny * penetration;
  const closing = -(pod.vx * nx + pod.vy * ny);
  if (closing <= 0) return true;
  if (closing > tuning.crashSpeed && canWreck && pod.state === 'racing') { pod.crash(); return false; }
  pod.vx += (1 + tuning.wallBounce) * closing * nx;
  pod.vy += (1 + tuning.wallBounce) * closing * ny;
  pod.vx *= 0.985; pod.vy *= 0.985;                        // scrape friction
  if (closing > 4) emit('impact', { pod, x: contactX, y: contactY, strength: closing, kind });
  return true;
}

/** Walls. Returns the nearest centreline sample, which the race uses for lap progress. */
export function collideWithTrack(pod, canWreck) {
  const centre = nearestOnTrack(pod.x, pod.y, pod.trackIndex);
  for (const c of collisionCircles(pod)) {
    const q = nearestOnTrack(c.x, c.y, centre.index, 12);
    const limit = TRACK_HALF_WIDTH - c.r;
    if (Math.abs(q.lateral) <= limit) continue;
    const p = track.pts[q.index];
    const side = Math.sign(q.lateral);
    const nx = -p.nx * side, ny = -p.ny * side;              // points back towards the centre
    const wallX = c.x - nx * c.r, wallY = c.y - ny * c.r;
    if (!resolveImpact(pod, nx, ny, Math.abs(q.lateral) - limit, wallX, wallY, 'wall', canWreck)) break;
  }
  return centre.index;
}

export function collideWithObstacles(pod, canWreck) {
  for (const c of collisionCircles(pod)) {
    for (const o of obstacles) {
      const dx = c.x - o.x, dy = c.y - o.y;
      const dist = Math.hypot(dx, dy);
      const minDist = c.r + o.radius;
      if (dist >= minDist || dist === 0) continue;
      const nx = dx / dist, ny = dy / dist;
      if (!resolveImpact(pod, nx, ny, minDist - dist, o.x + nx * o.radius, o.y + ny * o.radius, 'rock', canWreck)) return;
    }
  }
}

/** Pod-on-pod bumps. Equal mass, no wrecks from pod contact yet. */
export function collidePods(a, b) {
  if (a.state !== 'racing' || b.state !== 'racing' || a.ghostTimer > 0 || b.ghostTimer > 0) return;
  for (const ca of collisionCircles(a)) {
    for (const cb of collisionCircles(b)) {
      const dx = ca.x - cb.x, dy = ca.y - cb.y;
      const dist = Math.hypot(dx, dy);
      const minDist = ca.r + cb.r;
      if (dist >= minDist || dist === 0) continue;
      const nx = dx / dist, ny = dy / dist;
      const push = (minDist - dist) / 2;
      a.x += nx * push; a.y += ny * push;
      b.x -= nx * push; b.y -= ny * push;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing > 0) {
        const impulse = closing * (1 + 0.4) / 2;
        a.vx += nx * impulse; a.vy += ny * impulse;
        b.vx -= nx * impulse; b.vy -= ny * impulse;
        a.angVel += randRange(-0.5, 0.5) * closing * 0.05;
        b.angVel += randRange(-0.5, 0.5) * closing * 0.05;
        if (closing > 6) emit('impact', { pod: a, other: b, x: cb.x + nx * cb.r, y: cb.y + ny * cb.r, strength: closing, kind: 'pod' });
      }
    }
  }
}
