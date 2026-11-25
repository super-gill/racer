/**
 * The race: pods on the grid, countdown, the fixed simulation step, lap counting and standings.
 * Runs without graphics, so the same code can run in the browser today and on the Node host later.
 *
 * Human pods are driven by raw input passed to simStep (see applyHumanInput in levers.js);
 * everything else is driven by the AI.
 */
import { AI_DRIVERS, GRID, HUMAN_AI, LAPS, PLAYER_COLOR } from './config.js';
import { N, wrapIndex, indexDelta } from './track.js';
import { Pod } from './pod.js';
import { applyHumanInput } from './levers.js';
import { aiDrive, checkAiStuck } from './ai.js';
import { stepPodPhysics, stepDeadPod, collideWithTrack, collideWithObstacles, collidePods } from './physics.js';
import { emit } from './events.js';

export const race = {
  phase: 'countdown',   // 'countdown' | 'racing' | 'finished' (every human finished or out; AI may still be going)
  countdown: 0,
  time: 0,
  finishOrder: [],
};

/** All pods in grid order. */
export const pods = [];

/**
 * Creates the field: AI drivers first, then the humans at the back of the grid.
 * humans: [{ name, color }]. Returns the human pods in the same order.
 */
export function setupRace(humans = [{ name: 'You', color: PLAYER_COLOR }]) {
  pods.length = 0;
  const aiCount = Math.max(0, GRID.length - humans.length);
  AI_DRIVERS.slice(0, aiCount).forEach((d, i) => {
    pods.push(new Pod({ id: pods.length, name: d.name, color: d.color, ai: { ...d, phase: i * 2.1 } }));
  });
  const humanPods = humans.map((h) => {
    const pod = new Pod({ id: pods.length, name: h.name, color: h.color, human: true, ai: { ...HUMAN_AI } });
    pods.push(pod);
    return pod;
  });
  resetRace();
  return humanPods;
}

export function resetRace() {
  pods.forEach((pod, i) => pod.reset(wrapIndex(GRID[i][0]), GRID[i][1]));
  Object.assign(race, { phase: 'countdown', countdown: 3.2, time: 0, finishOrder: [] });
}

const raceStarted = () => race.phase !== 'countdown';

/** Tracks how far round the lap a pod is and records lap times when it crosses the line. */
function updateProgress(pod, index) {
  pod.progress += indexDelta(pod.trackIndex, index);
  pod.trackIndex = index;
  const line = Math.floor(pod.progress / N);
  if (line <= pod.highestLine) return;            // only count each line crossing once, going forwards
  pod.highestLine = line;
  if (pod.dnf) return;
  if (line === 0) { pod.lapStart = race.time; return; }   // first crossing starts lap 1
  const lapTime = race.time - pod.lapStart;
  pod.lapTimes.push(lapTime);
  pod.lapStart = race.time;
  if (pod.bestLap == null || lapTime < pod.bestLap) pod.bestLap = lapTime;
  emit('lap', { pod, lap: line, time: lapTime });
  if (line >= LAPS && !pod.finished) {
    pod.finished = true;
    pod.finishTime = race.time;
    race.finishOrder.push(pod);
    emit('finish', { pod });
  }
}

/** Finished pods by time, then pods still racing by distance, then pods that are out. */
export function standings() {
  const rank = (pod) => (pod.finished ? 0 : pod.dnf ? 2 : 1);
  return [...pods].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.finished) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });
}

/** Who is driving this pod right now: its human, or the AI. */
const aiDriven = (pod) => !pod.human || pod.autodrive || !pod.active;

/**
 * One fixed physics step for the whole race.
 * inputs: Map of pod id to that human's raw input for this step. A human with no input idles.
 */
export function simStep(dt, inputs = new Map()) {
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    if (race.countdown <= 0) { race.phase = 'racing'; emit('go'); }
  } else {
    race.time += dt;
  }

  for (const pod of pods) {
    if (pod.state === 'crashed') {
      pod.crashTimer -= dt;
      if (pod.crashTimer <= 0) pod.respawn();
      continue;
    }
    if (pod.state === 'dead') { stepDeadPod(pod, dt); continue; }
    pod.ghostTimer = Math.max(0, pod.ghostTimer - dt);
    pod.recoverCooldown = Math.max(0, pod.recoverCooldown - dt);

    // Engines run on the grid during the countdown (rev up, light the afterburner) but the pod is held.
    let controls;
    if (aiDriven(pod)) {
      controls = aiDrive(pod, race.time, dt, pod.finished ? 0.5 : 1);
    } else {
      const input = inputs.get(pod.id) ?? IDLE_INPUT;
      if (input.recover && raceStarted()) pod.recover();
      controls = applyHumanInput(pod.levers, input, dt);
    }
    pod.controls = controls;
    stepPodPhysics(pod, controls, dt, race.phase === 'countdown');
    if (pod.fuel <= 0 && !pod.dnf) pod.runOutOfFuel();
  }

  for (const pod of pods) {
    if (pod.state === 'crashed') continue;
    updateProgress(pod, collideWithTrack(pod, raceStarted()));
    if (pod.state !== 'crashed') collideWithObstacles(pod, raceStarted());
  }
  for (let i = 0; i < pods.length; i++) for (let j = i + 1; j < pods.length; j++) collidePods(pods[i], pods[j]);

  if (raceStarted()) {
    for (const pod of pods) if (pod.state === 'racing' && aiDriven(pod)) checkAiStuck(pod, dt);
    // The race is over once every human has finished or is out. The AI keeps going regardless.
    const humans = pods.filter((p) => p.human);
    if (race.phase === 'racing' && humans.length && humans.every((p) => !p.active)) race.phase = 'finished';
  }
}

/** Input for a human who is not pressing anything. */
export const IDLE_INPUT = Object.freeze({
  mode: 'linked', throttle: 0, steer: 0, left: 0, right: 0, full: false, cut: false, boost: false, recover: false,
});
