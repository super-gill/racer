/**
 * Pod simulation state. No graphics: the client draws a pod from this state (see client/podView.js).
 * A pod is two jet engines tethered to a cockpit. Components carry integrity so a damage model
 * can be added later.
 */
import { FUEL_CAPACITY, IDLE_SPOOL } from './config.js';
import { track, N } from './track.js';
import { tuning } from './tuning.js';
import { Levers } from './levers.js';
import { emit } from './events.js';

/** Fresh state for one jet engine. */
export function newEngineState() {
  return {
    integrity: 1,        // physical condition, 1 = perfect (used by the damage model later)
    heat: 0,             // 0 to 1; at 1 the engine flames out
    flameout: 0,         // seconds until relight
    spool: IDLE_SPOOL,   // revs, 0 to 1
    power: 0,            // revs above idle, 0 to 1
    reverser: 0,         // reverser buckets, 0 stowed to 1 deployed
    afterburner: 0,      // 0 unlit to 1 fully lit
    thrust: 0,           // output this step as a fraction of dry full thrust, negative when reversing
  };
}

export class Pod {
  /**
   * id: unique number in the race. human: driven by a person's input (otherwise AI).
   * ai: AI driving settings (lane, topSpeed, ...); humans get some too, used after they finish.
   */
  constructor({ id, name, color, human = false, ai }) {
    Object.assign(this, { id, name, color, human, ai });
    this.autodrive = false;          // a human pod driven by the AI (testing, or after finishing)
    this.reset(0, 0);
  }

  /** Puts the pod back to a fresh state at a given track sample and lateral offset. */
  reset(index, lateral) {
    const p = track.pts[index];
    this.x = p.x + p.nx * lateral;
    this.y = p.y + p.ny * lateral;
    this.heading = p.angle;
    this.vx = this.vy = this.angVel = 0;
    this.forwardAccel = 0;
    this.lastForwardSpeed = 0;
    this.components = {
      engineL: newEngineState(),
      engineR: newEngineState(),
      tether: { integrity: 1 },
      cockpit: { integrity: 1 },
    };
    this.state = 'racing';          // 'racing' | 'crashed' | 'dead' (out of fuel, sliding to a stop)
    this.fuel = FUEL_CAPACITY * tuning.startFuel / 100;
    this.dnf = null;                // reason the pod is out of the race, e.g. 'Out of fuel'
    this.recoverCooldown = 0;
    this.crashTimer = 0;
    this.ghostTimer = 0;            // brief no-collision window after a respawn
    this.stuckTimer = 0;
    this.crashCount = 0;
    this.trackIndex = index;
    this.progress = index - N;      // grid sits behind the line, so progress starts negative
    this.highestLine = -1;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = null;
    this.finished = false;
    this.finishTime = null;
    this.levers = new Levers();
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  /** Is this pod still running in the race (not finished and not out)? */
  get active() { return !this.finished && !this.dnf; }

  /** Wrecks the pod. It respawns after a short delay, unless it is out of the race. */
  crash() {
    if (this.state === 'crashed') return;
    emit('crash', { pod: this, vx: this.vx, vy: this.vy });
    this.state = 'crashed';
    this.crashTimer = this.dnf ? Infinity : 2.4;
    this.crashCount++;
    this.vx = this.vy = this.angVel = 0;
  }

  /**
   * Back on the centreline at the current track position, facing the right way.
   * After a wreck the engines restart from idle; a recovery keeps their heat and revs. Fuel is kept either way.
   */
  respawn(afterWreck = true) {
    const p = track.pts[this.trackIndex];
    this.x = p.x; this.y = p.y;
    this.heading = p.angle;
    this.vx = this.vy = this.angVel = 0;
    this.state = 'racing';
    this.ghostTimer = 1.2;
    this.stuckTimer = 0;
    for (const e of [this.components.engineL, this.components.engineR]) {
      e.reverser = 0; e.afterburner = 0;
      if (afterWreck) { e.heat = 0; e.flameout = 0; e.spool = IDLE_SPOOL; }
    }
    emit('respawn', { pod: this });
  }

  /** Pull back onto the track (Backspace), for when you are stuck. 3 second cooldown. */
  recover() {
    if (this.state !== 'racing' || this.dnf || this.recoverCooldown > 0) return;
    this.respawn(false);
    this.recoverCooldown = 3;
    emit('recovered', { pod: this });
  }

  /** Tank empty: everything shuts down and the pod is out. Fast enough and it hits the ground and wrecks. */
  runOutOfFuel() {
    this.dnf = 'Out of fuel';
    this.fuel = 0;
    emit('out', { pod: this, reason: this.dnf });
    if (this.speed > tuning.dryTankWreckSpeed) {
      this.crash();
    } else {
      this.state = 'dead';
      emit('grounded', { pod: this });
    }
  }
}
