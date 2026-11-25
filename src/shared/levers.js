import { tuning } from './tuning.js';
import { clamp } from './utils.js';

/**
 * Two thrust levers, one per engine, from -1 (full reverse) to 1 (full forward).
 * Keys MOVE the levers and the levers stay where they are left, like real throttle levers.
 *
 * Linked mode: one shared throttle position, plus a temporary split while steering.
 * The split only ever pulls the INSIDE lever back, never pushes the outside one harder,
 * so turning always costs thrust.
 *
 * Manual mode: each lever moved on its own.
 *
 * The AI uses this same class with the same rates, so it has no reaction-time advantage.
 */
export class Levers {
  constructor() { this.reset(); }

  reset() {
    this.base = 0;      // linked mode: shared throttle position
    this.split = 0;     // linked mode: -1 (pull left lever back) to 1 (pull right lever back)
    this.left = 0;
    this.right = 0;
  }

  /** Linked mode from keys. throttle and steer are -1, 0 or 1. */
  linked(dt, throttle, steer, full, cut) {
    if (cut) this.base = 0;
    else if (full) this.base = 1;
    else this.base = clamp(this.base + throttle * tuning.leverRate * dt, -1, 1);
    this.moveSplit(dt, steer);
    this.applySplit();
  }

  /** Linked mode towards analogue targets. Used by the AI. */
  linkedTowards(dt, targetThrottle, steer) {
    const step = tuning.leverRate * dt;
    this.base += clamp(targetThrottle - this.base, -step, step);
    this.moveSplit(dt, steer);
    this.applySplit();
  }

  /** Manual mode: each input is -1, 0 or 1 and moves its own lever. */
  manual(dt, leftInput, rightInput, full, cut) {
    const step = tuning.leverRate * dt;
    if (cut) this.left = this.right = 0;
    else if (full) this.left = this.right = 1;
    else {
      this.left = clamp(this.left + leftInput * step, -1, 1);
      this.right = clamp(this.right + rightInput * step, -1, 1);
    }
    // Keep linked state in step, so switching modes mid-race doesn't jump the levers.
    this.base = (this.left + this.right) / 2;
    this.split = 0;
  }

  moveSplit(dt, steer) {
    const step = (steer !== 0 ? tuning.splitRate : tuning.splitReturnRate) * dt;
    this.split += clamp(steer - this.split, -step, step);
  }

  applySplit() {
    const depth = tuning.splitDepth;
    // Steering right pulls the right lever back, so the left engine pushes harder and the pod turns right.
    this.left = clamp(this.base - Math.max(0, -this.split) * depth, -1, 1);
    this.right = clamp(this.base - Math.max(0, this.split) * depth, -1, 1);
  }
}

/**
 * Applies one human player's raw input to their levers.
 * input: { mode: 'linked' | 'manual', throttle, steer, left, right (each -1, 0 or 1),
 *          full, cut, boost (true / false) }
 * Returns this step's engine commands.
 */
export function applyHumanInput(levers, input, dt) {
  if (input.mode === 'manual') levers.manual(dt, input.left, input.right, input.full, input.cut);
  else levers.linked(dt, input.throttle, input.steer, input.full, input.cut);
  return { left: levers.left, right: levers.right, boost: input.boost };
}
