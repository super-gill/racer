/**
 * AI drivers. Follow the centreline with a lane offset, slow for bends they can see coming,
 * steer round rocks, and use the afterburner on straights when cool with fuel to spare.
 * They drive through the same levers, at the same lever speeds, as a human.
 */
import { FUEL_CAPACITY, LAPS, TRACK_HALF_WIDTH } from './config.js';
import { track, N, wrapIndex, indexDelta, obstacles } from './track.js';
import { clamp, wrapAngle } from './utils.js';

/** Drives a pod's levers like a player would, at the same lever speeds. Returns engine commands. */
export function aiDrive(pod, time, dt, throttleCap = 1) {
  const target = aiTargets(pod, time, throttleCap);
  pod.levers.linkedTowards(dt, target.throttle, target.steer);
  return { left: pod.levers.left, right: pod.levers.right, boost: target.boost };
}

/** Decides where the AI wants its throttle and steering. */
export function aiTargets(pod, time, throttleCap = 1) {
  const ai = pod.ai;
  const speed = pod.speed;
  const look = Math.round(5 + speed * 0.12);
  const target = track.pts[wrapIndex(pod.trackIndex + look)];

  let lane = ai.lane + Math.sin(time * 0.3 + ai.phase) * 3;
  for (const o of obstacles) {
    const ahead = indexDelta(pod.trackIndex, o.index);
    if (ahead <= 0 || ahead > look + 25) continue;
    const needed = o.radius + 6;
    const gap = lane - o.lateral;
    if (Math.abs(gap) < needed) {
      let dodge = o.lateral + (gap >= 0 ? needed : -needed);
      if (Math.abs(dodge) > TRACK_HALF_WIDTH - 4) dodge = o.lateral + (gap >= 0 ? -needed : needed);
      lane = dodge;
    }
  }
  lane = clamp(lane, -(TRACK_HALF_WIDTH - 4), TRACK_HALF_WIDTH - 4);

  const tx = target.x + target.nx * lane, ty = target.y + target.ny * lane;
  const error = wrapAngle(Math.atan2(ty - pod.y, tx - pod.x) - pod.heading);
  // Damped against current rotation (the engines lag), with a small dead zone so tiny corrections
  // don't keep one lever off full and block the afterburner.
  let steer = clamp(error * ai.steerGain - pod.angVel * 0.45, -1, 1);
  if (Math.abs(steer) < 0.1) steer = 0;

  // How much the track turns in the next stretch decides the safe speed.
  const here = track.pts[pod.trackIndex].angle;
  let bend = 0;
  for (const k of [15, 30, 45]) bend = Math.max(bend, Math.abs(wrapAngle(track.pts[wrapIndex(pod.trackIndex + k)].angle - here)));
  // Afterburner on straights, if the engines are cool enough and there is fuel to spare for the rest of the race.
  const hottest = Math.max(pod.components.engineL.heat, pod.components.engineR.heat);
  const raceLeft = 1 - clamp(pod.progress / (LAPS * N), 0, 1);
  const fuelToSpare = pod.fuel / FUEL_CAPACITY > raceLeft * 0.5 + 0.05;
  const wantsAfterburner = bend < 0.6 && hottest < ai.boostHeatLimit && fuelToSpare;
  const targetSpeed = ai.topSpeed * clamp(1.08 - bend * 0.42, 0.5, 1.08) * (wantsAfterburner ? 1.25 : 1);

  let throttle = speed < targetSpeed ? 1 : speed > targetSpeed + 10 ? -0.7 : 0.25;
  if (Math.abs(error) > 0.9) throttle = Math.min(throttle, 0.4);
  throttle = Math.min(throttle, throttleCap);
  const boost = throttle === 1 && wantsAfterburner && speed > 40;
  return { throttle, steer, boost };
}

/** Respawns AI pods that are stuck or facing the wrong way. */
export function checkAiStuck(pod, dt) {
  const p = track.pts[pod.trackIndex];
  const facing = Math.cos(pod.heading) * p.tx + Math.sin(pod.heading) * p.ty;
  if (pod.speed < 4 || facing < -0.3) pod.stuckTimer += dt; else pod.stuckTimer = 0;
  if (pod.stuckTimer > 2.5) pod.respawn(false);
}
