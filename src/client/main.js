/**
 * Browser client entry point. Wires the shared simulation to the screen:
 * runs the fixed-step simulation, feeds it the local keyboard input, reacts to simulation
 * events with effects, sound and messages, and draws each frame.
 *
 * When LAN play arrives, the simulation moves to the Node host and this file will send
 * input and receive state instead of calling simStep itself.
 */
import { FIXED_DT, GAME_TITLE, LAPS, VERSION } from '../shared/config.js';
import { setupRace, resetRace, simStep, pods, race } from '../shared/race.js';
import { drainEvents } from '../shared/events.js';
import { track } from '../shared/track.js';
import { tuning } from '../shared/tuning.js';
import { clamp, formatTime } from '../shared/utils.js';
import { renderer, scene, camera } from './scene.js';
import { particles, effects, clearScorchMarks } from './effects.js';
import { PodView } from './podView.js';
import { view, followPod, snapCamera, updateCamera } from './camera.js';
import { hudFollow, updateHud, showCentre, showWarning, toast } from './hud.js';
import { buildTuningPanel, loadSavedTuning } from './tuningPanel.js';
import { audio } from './audio.js';
import { onKeyPress, takePressed, readLocalInput } from './input.js';

const $ = (id) => document.getElementById(id);
const CONTROL_MODE_NAMES = { linked: 'Linked levers', manual: 'Manual levers' };

/** Client-only settings and screen state. */
const client = {
  controlMode: 'linked',     // 'linked' | 'manual'
  screen: 'title',           // 'title' | 'race'
  paused: false,
  resultsTimer: 0,           // counts down to showing results after the local pod finishes or is out
  recoverRequested: false,
};

loadSavedTuning();
buildTuningPanel();
onKeyPress(() => audio.unlock());

const [localPod] = setupRace();
localPod.autodrive = new URLSearchParams(location.search).has('autodrive');
const views = new Map(pods.map((pod) => [pod.id, new PodView(pod)]));
followPod(localPod);
hudFollow(localPod);
snapCamera();

function restart() {
  resetRace();
  for (const v of views.values()) v.resetPieces();
  clearScorchMarks();
  drainEvents();
  client.resultsTimer = 0;
  $('results-screen').classList.remove('show');
  snapCamera();
}

function startRace() {
  client.screen = 'race';
  $('title-screen').classList.remove('show');
  restart();
}

/** Turns what happened in the simulation into effects, sound and messages. */
function handleEvents() {
  for (const e of drainEvents()) {
    const mine = e.pod === localPod;
    switch (e.type) {
      case 'go':
        showCentre('Go', 0.8);
        break;
      case 'crash':
        views.get(e.pod.id).onCrash(e.vx, e.vy);
        effects.explosion(e.pod.x, 2, e.pod.y);
        if (mine) { audio.bang(1); showWarning('Wrecked', 1.6); }
        break;
      case 'respawn':
        views.get(e.pod.id).resetPieces();
        break;
      case 'recovered':
        if (mine) toast('Recovered to track');
        break;
      case 'impact':
        effects.sparks(e.x, e.y, e.strength);
        if ((mine || e.other === localPod) && e.strength > 8) {
          const scale = e.kind === 'pod' ? 60 : tuning.crashSpeed;
          audio.bang(clamp(e.strength / scale, 0.1, e.kind === 'pod' ? 0.5 : 0.6));
        }
        break;
      case 'lap':
        if (mine && e.lap < LAPS) toast(`Lap ${e.lap}: ${formatTime(e.time)}`);
        break;
      case 'finish':
        if (mine) { showCentre('Finish', 2); client.resultsTimer = 1.5; }
        break;
      case 'out':
        if (mine) { showWarning(e.reason, 3); client.resultsTimer = 1.5; }
        break;
      case 'grounded':
        effects.dustBurst(e.pod.x, e.pod.y, 25);
        break;
    }
  }
}

function handleCommands() {
  const pressed = takePressed();
  if (client.screen === 'title') {
    if (pressed.has('Enter')) startRace();
    return;
  }
  if (pressed.has('Enter') && $('results-screen').classList.contains('show')) restart();
  if (pressed.has('KeyR')) { restart(); client.paused = false; $('pause-screen').classList.remove('show'); }
  if (pressed.has('KeyP') || pressed.has('Escape')) { client.paused = !client.paused; $('pause-screen').classList.toggle('show', client.paused); }
  if (pressed.has('KeyM')) {
    client.controlMode = client.controlMode === 'linked' ? 'manual' : 'linked';
    toast(`Controls: ${CONTROL_MODE_NAMES[client.controlMode]}`);
  }
  if (pressed.has('KeyC')) {
    view.cameraMode = view.cameraMode === 'north' ? 'chase' : 'north';
    toast(`Camera: ${view.cameraMode === 'north' ? 'North-up' : 'Chase'}`);
  }
  if (pressed.has('KeyT')) $('tuning').classList.toggle('show');
  if (pressed.has('KeyH')) $('help-screen').classList.toggle('show');
  if (pressed.has('Backspace')) client.recoverRequested = true;
  if (pressed.has('KeyN')) { audio.muted = !audio.muted; toast(audio.muted ? 'Sound off' : 'Sound on'); }
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  particles.resize();
}
addEventListener('resize', onResize);
onResize();

$('title-name').textContent = GAME_TITLE;
$('title-version').textContent = `Prototype v${VERSION}, driving feel test`;
document.title = `${GAME_TITLE} - prototype v${VERSION}`;

let lastTime = performance.now();
let accumulator = 0;
let visualTime = 0;

function stepSimulation(dt) {
  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    const input = readLocalInput(client.controlMode, client.recoverRequested);
    client.recoverRequested = false;
    simStep(FIXED_DT, new Map([[localPod.id, input]]));
    accumulator -= FIXED_DT;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  handleCommands();

  const running = client.screen === 'race' && !client.paused;
  if (running) stepSimulation(dt);
  handleEvents();

  if (client.resultsTimer > 0) {
    client.resultsTimer -= dt;
    if (client.resultsTimer <= 0) $('results-screen').classList.add('show');
  }

  const visualDt = running ? dt : 0;
  visualTime += visualDt;
  for (const v of views.values()) v.update(visualDt, visualTime);
  particles.update(visualDt);
  updateCamera(client.screen === 'race' ? dt : 0.016);
  updateHud(dt, {
    control: CONTROL_MODE_NAMES[client.controlMode],
    camera: view.cameraMode === 'north' ? 'North-up' : 'Chase',
    onGrid: client.screen === 'race' && race.phase === 'countdown',
  });
  audio.update(localPod, client.paused || client.screen !== 'race');
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Developer hook for testing in the browser console, e.g. __dev.fastForward(60).
window.__dev = {
  pods, race, track, tuning,
  fastForward(seconds) {
    for (let t = 0; t < seconds; t += FIXED_DT) simStep(FIXED_DT, new Map([[localPod.id, readLocalInput(client.controlMode)]]));
    handleEvents();
  },
  start: startRace,
};
