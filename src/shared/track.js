/**
 * Track data. The track is a centreline sampled every few units. Each sample stores its
 * position, direction (tangent), right-hand normal and distance from the start.
 * Physics, AI, lap counting and the client's meshes all read from this one structure.
 * Sim coordinates are (x, y) on the ground plane; y maps to world z in the renderer.
 */
import * as THREE from 'three';
import { CONTROL_POINTS, OBSTACLE_LAYOUT, SAMPLE_SPACING } from './config.js';

export function buildTrackData() {
  const curve = new THREE.CatmullRomCurve3(
    CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const count = Math.round(curve.getLength() / SAMPLE_SPACING);
  const raw = curve.getSpacedPoints(count);
  raw.pop();                                   // closed curve: last point repeats the first
  const pts = raw.map((p) => ({ x: p.x, y: p.z }));
  const n = pts.length;
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    let tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);
    tx /= len; ty /= len;
    Object.assign(pts[i], { tx, ty, nx: -ty, ny: tx, angle: Math.atan2(ty, tx), dist });
    dist += Math.hypot(next.x - pts[i].x, next.y - pts[i].y);
  }
  return { pts, count: n, length: dist };
}

export const track = buildTrackData();
export const N = track.count;
export const wrapIndex = (i) => ((i % N) + N) % N;
/** Signed number of samples from a to b, taking the short way round the loop. */
export function indexDelta(a, b) {
  let d = b - a;
  if (d > N / 2) d -= N;
  if (d < -N / 2) d += N;
  return d;
}

/** Nearest centreline sample, searching only near a hint so we never jump to another part of the track. */
export function nearestOnTrack(x, y, hint, window = 30) {
  let best = hint, bestD = Infinity;
  for (let k = -window; k <= window; k++) {
    const i = wrapIndex(hint + k);
    const p = track.pts[i];
    const d = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  const p = track.pts[best];
  return { index: best, lateral: (x - p.x) * p.nx + (y - p.y) * p.ny };
}

/** Nearest sample anywhere on the track. Slow, only used while building the world. */
export function nearestGlobal(x, y) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const p = track.pts[i];
    const d = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return { index: best, distance: Math.sqrt(bestD) };
}

export const obstacles = OBSTACLE_LAYOUT.map(([frac, lateral, radius]) => {
  const index = wrapIndex(Math.round(frac * N));
  const p = track.pts[index];
  return { index, lateral, radius, x: p.x + p.nx * lateral, y: p.y + p.ny * lateral };
});
