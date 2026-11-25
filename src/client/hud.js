/**
 * HUD: lap, position, timers, speed, fuel, heat and lever displays, warnings, messages,
 * minimap and the results table. Reads simulation state; never changes it.
 */
import * as THREE from 'three';
import { FUEL_CAPACITY, LAPS, SPEED_DISPLAY } from '../shared/config.js';
import { track } from '../shared/track.js';
import { race, pods, standings } from '../shared/race.js';
import { clamp, formatTime } from '../shared/utils.js';

const $ = (id) => document.getElementById(id);
const hudCache = {};
/** Only touches the DOM when the text actually changes. */
function setText(id, text) {
  if (hudCache[id] === text) return;
  hudCache[id] = text;
  $(id).textContent = text;
}

let centreTimer = 0, warnTimer = 0, toastTimer = 0;
let localPod = null;

/** Sets which pod the HUD shows. */
export function hudFollow(pod) { localPod = pod; }

export function showCentre(text, seconds) { $('center-msg').textContent = text; centreTimer = seconds; }
export function showWarning(text, seconds) { $('warn-msg').textContent = text; warnTimer = seconds; }
export function toast(text) { const el = $('toast'); el.textContent = text; el.style.opacity = 1; toastTimer = 1.6; }

// Minimap: track drawn once to an offscreen canvas, pods drawn each frame.
const minimap = $('minimap').getContext('2d');
const mapImage = document.createElement('canvas');
mapImage.width = mapImage.height = 180;
const mapBounds = (() => {
  const xs = track.pts.map((p) => p.x), ys = track.pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 150 / Math.max(maxX - minX, maxY - minY);
  return { scale, ox: 90 - ((minX + maxX) / 2) * scale, oy: 90 - ((minY + maxY) / 2) * scale };
})();
const toMap = (x, y) => [mapBounds.ox + x * mapBounds.scale, mapBounds.oy + y * mapBounds.scale];
{
  const g = mapImage.getContext('2d');
  g.strokeStyle = 'rgba(255, 207, 138, 0.55)';
  g.lineWidth = 5;
  g.beginPath();
  track.pts.forEach((p, i) => { const [x, y] = toMap(p.x, p.y); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath();
  g.stroke();
  const [sx, sy] = toMap(track.pts[0].x, track.pts[0].y);
  g.fillStyle = '#fff2dc';
  g.fillRect(sx - 3, sy - 3, 6, 6);
}

function updateMinimap() {
  minimap.clearRect(0, 0, 180, 180);
  minimap.drawImage(mapImage, 0, 0);
  for (const pod of pods) {
    const [x, y] = toMap(pod.x, pod.y);
    minimap.fillStyle = '#' + new THREE.Color(pod.color).getHexString();
    minimap.beginPath();
    minimap.arc(x, y, pod === localPod ? 4.5 : 3.5, 0, Math.PI * 2);
    minimap.fill();
    if (pod === localPod) { minimap.strokeStyle = '#fff'; minimap.lineWidth = 1.5; minimap.stroke(); }
  }
}

/**
 * Updates everything on screen. modes: { control, camera, onGrid } names for the mode panel;
 * onGrid is true on the race screen during the countdown.
 */
export function updateHud(dt, modes) {
  const me = localPod;
  if (!me) return;
  const lap = clamp(me.highestLine + 1, 1, LAPS);
  setText('hud-lap', `${lap}/${LAPS}`);
  setText('hud-pos', `${standings().indexOf(me) + 1}/${pods.length}`);
  setText('hud-time', formatTime(race.time));
  setText('hud-laptime', formatTime(me.highestLine >= 0 && !me.finished ? race.time - me.lapStart : 0));
  setText('hud-best', formatTime(me.bestLap));
  setText('hud-spd', String(Math.round(me.speed * SPEED_DISPLAY)));
  setText('mode-ctrl', modes.control);
  setText('mode-cam', modes.camera);

  const { engineL, engineR } = me.components;
  for (const [id, engine] of [['heat-l', engineL], ['heat-r', engineR]]) {
    const el = $(id);
    el.style.height = `${(engine.flameout > 0 ? 100 : engine.heat * 100).toFixed(1)}%`;
    el.classList.toggle('hot', engine.heat > 0.85 || engine.flameout > 0);
  }
  // Levers fill up from the centre line for forward, down for reverse.
  // The red marker is what the engine is actually giving: it lags the lever while the engine spools.
  const levers = [['lever-l', 'out-l', me.levers.left, engineL], ['lever-r', 'out-r', me.levers.right, engineR]];
  for (const [leverId, outId, value, engine] of levers) {
    const el = $(leverId);
    const h = `${(Math.abs(value) * 50).toFixed(1)}%`;
    el.style.height = h;
    el.style.bottom = value >= 0 ? '50%' : `calc(50% - ${h})`;
    el.classList.toggle('reverse', value < 0);
    const output = engine.power * (engine.reverser > 0.5 ? -1 : 1);
    $(outId).style.bottom = `calc(${(50 + output * 50).toFixed(1)}% - 1px)`;
  }
  const abL = engineL.afterburner > 0.5, abR = engineR.afterburner > 0.5;
  $('boost-tag').style.visibility = abL || abR ? 'visible' : 'hidden';
  setText('boost-tag', abL && abR ? 'Afterburner' : abL ? 'Afterburner L' : 'Afterburner R');
  const fuelPct = (me.fuel / FUEL_CAPACITY) * 100;
  $('fuel-fill').style.width = `${fuelPct.toFixed(1)}%`;
  $('fuel-fill').classList.toggle('low', fuelPct < 15);
  setText('fuel-pct', String(Math.ceil(fuelPct)));

  // Warnings: flameouts, overheating, wrong way, low fuel.
  if (me.state === 'racing') {
    const out = [engineL.flameout > 0 && 'Left', engineR.flameout > 0 && 'Right'].filter(Boolean);
    const p = track.pts[me.trackIndex];
    const wrongWay = race.phase === 'racing' && me.speed > 10 && (me.vx * p.tx + me.vy * p.ty) < -5;
    let warning = '';
    if (out.length) warning = `${out.join(' + ')} engine flameout`;
    else if (Math.max(engineL.heat, engineR.heat) > 0.85) warning = 'Overheating';
    else if (wrongWay) warning = 'Wrong way';
    else if (me.fuel / FUEL_CAPACITY < 0.15) warning = 'Low fuel';
    if (warning) { $('warn-msg').textContent = warning; $('warn-msg').classList.add('blink'); warnTimer = 0.1; }
  }

  if (modes.onGrid) {
    setText('center-msg', String(Math.max(1, Math.ceil(race.countdown))));
  } else if (centreTimer > 0) {
    centreTimer -= dt;
    if (centreTimer <= 0) setText('center-msg', '');
  } else {
    setText('center-msg', '');
  }
  if (warnTimer > 0) { warnTimer -= dt; if (warnTimer <= 0) { $('warn-msg').textContent = ''; $('warn-msg').classList.remove('blink'); } }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').style.opacity = 0; }

  if ($('results-screen').classList.contains('show')) renderResults();
  updateMinimap();
}

function renderResults() {
  const rows = standings().map((pod, i) => {
    const total = pod.finished ? formatTime(pod.finishTime) : pod.dnf ? `Out: ${pod.dnf}` : 'Racing';
    const style = pod === localPod ? ' style="color:#ffcf8a"' : '';
    return `<tr${style}><td>${i + 1}. ${pod.name}</td><td>${total}</td><td>Best ${formatTime(pod.bestLap)}</td><td>Wrecks ${pod.crashCount}</td></tr>`;
  }).join('');
  const table = $('results-table');
  if (table.dataset.last !== rows) { table.innerHTML = rows; table.dataset.last = rows; }
}
