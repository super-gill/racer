/**
 * Simulation events.
 * The simulation never touches graphics, sound or the HUD. It records what happened
 * (a crash, a lap, an impact) here, and whoever is watching (the browser client today,
 * network clients later) drains the list and reacts.
 *
 * Event types and their fields:
 *   go          race start
 *   crash       pod, vx, vy           pod wrecked (vx, vy = velocity at impact, for debris)
 *   respawn     pod                   pod back on the track after a wreck or recovery
 *   recovered   pod                   player asked to be pulled back onto the track
 *   impact      pod, x, y, strength, kind ('wall' | 'rock' | 'pod'), other
 *   lap         pod, lap, time        completed lap number and its time
 *   finish      pod
 *   out         pod, reason           out of the race, e.g. 'Out of fuel'
 *   grounded    pod                   ran dry slowly and settled to the ground
 */

export const simEvents = [];

export function emit(type, data = {}) {
  simEvents.push({ type, ...data });
}

/** Returns all events since the last call and clears the list. */
export function drainEvents() {
  return simEvents.splice(0, simEvents.length);
}
