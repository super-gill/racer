/** Small maths and formatting helpers used everywhere. */

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing towards a target. */
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const randRange = (a, b) => a + (b - a) * Math.random();

/** Seeded random, so the world (mesas etc.) is the same every load. */
export function seededRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatTime(seconds) {
  if (seconds == null || !isFinite(seconds)) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
