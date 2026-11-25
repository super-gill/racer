/**
 * Keyboard. Tracks which keys are held and which were pressed since the last frame,
 * and turns them into the raw input the simulation expects (see applyHumanInput in shared/levers.js).
 * Over the network, this raw input is what a player will send to the host.
 */

const keysDown = new Set();
const keysPressed = new Set();
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
const firstKeyHandlers = [];

/** Runs fn on every key press (used to unlock browser audio). */
export function onKeyPress(fn) { firstKeyHandlers.push(fn); }

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!keysDown.has(e.code)) keysPressed.add(e.code);
  keysDown.add(e.code);
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  for (const fn of firstKeyHandlers) fn();
});
addEventListener('keyup', (e) => keysDown.delete(e.code));
addEventListener('blur', () => keysDown.clear());

export const isDown = (...codes) => codes.some((c) => keysDown.has(c));

/** -1, 0 or 1 from two groups of keys. */
const axis = (positive, negative) => (isDown(...positive) ? 1 : 0) - (isDown(...negative) ? 1 : 0);

/** Keys pressed since the last call. Clears the list. */
export function takePressed() {
  const pressed = new Set(keysPressed);
  keysPressed.clear();
  return pressed;
}

/**
 * The local player's raw input for this frame.
 * mode: 'linked' (W/S both levers, A/D split) or 'manual' (W/S left lever, Up/Down right lever).
 */
export function readLocalInput(mode, recover = false) {
  return {
    mode,
    throttle: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    steer: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
    left: axis(['KeyW'], ['KeyS']),
    right: axis(['ArrowUp'], ['ArrowDown']),
    full: isDown('Space'),
    cut: isDown('KeyX'),
    boost: isDown('ShiftLeft', 'ShiftRight'),
    recover,
  };
}
