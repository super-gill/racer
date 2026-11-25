/**
 * Pod Workshop page: controls, views and animation around the Pod Factory.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PRESETS, clone } from '../shared/podPresets.js';
import { PodFactory } from './podFactory.js';
import { VERSION } from '../shared/config.js';

document.querySelector('#panel .sub').textContent = `Prototype v${VERSION}`;

/* ===========================================================================
   3. SCENE
   =========================================================================== */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const SKY = 0xe9c9a0;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 120, 600);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;   // reflections for metal and chrome

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.minDistance = 6;
controls.maxDistance = 60;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x9a6a40, 0.7));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// Ground: plain sand for close-ups, scrolling track texture for the race view.
function speckle(base, dots) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (const [color, count, r] of dots) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      g.globalAlpha = 0.15 + Math.random() * 0.35;
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 0.5 + Math.random() * r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const groundTex = speckle('#b48a60', [['#7d5a3a', 700, 1.4], ['#d7b48a', 400, 1.1]]);
groundTex.repeat.set(60, 60);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);

/* ===========================================================================
   4. WORKSHOP STATE, VIEWS AND ANIMATION
   =========================================================================== */

let spec = clone(PRESETS['Redline Special']);
let mainPod = null;
let formation = [];            // other presets shown alongside in race view
let view = 'turntable';        // 'turntable' | 'race'
let afterburner = false;
const HOVER = 1.6;

function rebuild() {
  if (mainPod) { scene.remove(mainPod.root); mainPod.dispose(); }
  mainPod = PodFactory.buildPod(spec);
  scene.add(mainPod.root);
  rebuildFormation();
}

function rebuildFormation() {
  for (const p of formation) { scene.remove(p.root); p.dispose(); }
  formation = [];
  if (view !== 'race') return;
  const others = Object.entries(PRESETS).filter(([, s]) => JSON.stringify(s) !== JSON.stringify(spec)).slice(0, 3);
  const slots = [[-12, -10], [-12, 10], [-24, 0]];
  others.forEach(([, s], i) => {
    const pod = PodFactory.buildPod(s);
    pod.slot = slots[i];
    scene.add(pod.root);
    formation.push(pod);
  });
}

function setView(next) {
  view = next;
  document.getElementById('btn-turntable').classList.toggle('on', view === 'turntable');
  document.getElementById('btn-race').classList.toggle('on', view === 'race');
  document.getElementById('hint').textContent = view === 'turntable'
    ? 'Drag to orbit, scroll to zoom' : 'Race camera height (70 units), as in the game. Pods behind you are the other presets.';
  controls.enabled = view === 'turntable';
  if (view === 'turntable') {
    camera.position.set(14, 8, 14);
    controls.target.set(0, HOVER, 0);
    scene.fog.near = 120;
  } else {
    scene.fog.near = 260;
  }
  rebuildFormation();
}

/** Bob, exhaust flicker and afterburner plume, the same way the game animates pods. */
function animatePod(pod, t, phase, bank) {
  pod.engines.forEach((e, i) => {
    e.group.position.y = HOVER + 0.22 * Math.sin(t * (5.1 - i * 0.4) + phase + i * 1.3);
    e.exhaust.scale.setScalar(0.9 + Math.random() * 0.15);
    e.flame.visible = afterburner;
    if (afterburner) e.flame.scale.set(0.85 + Math.random() * 0.3, 1, 1);
  });
  pod.cockpit.position.y = HOVER * 0.8 + 0.14 * Math.sin(t * 3.3 + phase + 2);
  pod.body.rotation.x = bank;
  pod.updateLinks();
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (view === 'turntable') {
    mainPod.root.position.set(0, 0, 0);
    mainPod.root.rotation.y = 0;
    animatePod(mainPod, t, 0, 0);
    controls.update();
  } else {
    // Pods race "up" the screen; the ground scrolls underneath to fake speed.
    const sway = Math.sin(t * 0.7) * 0.25;
    mainPod.root.position.set(0, 0, Math.sin(t * 0.5) * 4);
    mainPod.root.rotation.y = Math.PI / 2 - sway * 0.3;
    animatePod(mainPod, t, 0, sway * 0.4);
    for (const [i, pod] of formation.entries()) {
      pod.root.position.set(pod.slot[1], 0, -pod.slot[0] + Math.sin(t * 0.6 + i) * 2);
      pod.root.rotation.y = Math.PI / 2;
      animatePod(pod, t, i * 2, 0);
    }
    groundTex.offset.y += dt * 1.6;
    camera.position.set(0, 70, 27);
    camera.lookAt(0, 0, 6);
  }
  renderer.render(scene, camera);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);

/* ===========================================================================
   5. CONTROLS PANEL
   Built from a list, like the game's tuning panel.
   =========================================================================== */

const CONTROLS = [
  // [group, path, label, type, options]
  ['Engines', 'engine.length', 'Length', 'range', [3.5, 7, 0.1]],
  ['Engines', 'engine.bodyRadius', 'Body radius', 'range', [0.4, 0.9, 0.01]],
  ['Engines', 'engine.intakeRadius', 'Intake radius', 'range', [0.4, 1.1, 0.01]],
  ['Engines', 'engine.bulge', 'Compressor bulge', 'range', [0, 0.35, 0.01]],
  ['Engines', 'engine.nozzle', 'Nozzle', 'select', ['afterburner', 'plain']],
  ['Engines', 'engine.nozzleLength', 'Nozzle length', 'range', [0.5, 1.6, 0.05]],
  ['Engines', 'engine.spacing', 'Spacing', 'range', [1.4, 2.8, 0.05]],
  ['Fins', 'fins.layout', 'Layout', 'select', ['none', 'vertical', 'outboard', 'both']],
  ['Fins', 'fins.shape', 'Shape', 'select', ['swept', 'delta', 'square']],
  ['Fins', 'fins.size', 'Size', 'range', [0.5, 1.6, 0.05]],
  ['Cockpit', 'cockpit.shape', 'Shape', 'select', ['teardrop', 'needle', 'tub']],
  ['Cockpit', 'cockpit.length', 'Length', 'range', [2.4, 4.6, 0.1]],
  ['Cockpit', 'cockpit.width', 'Width', 'range', [0.7, 1.4, 0.05]],
  ['Cockpit', 'cockpit.distance', 'Distance behind engines', 'range', [5.5, 9, 0.1]],
  ['Links', 'links.tether', 'Tethers', 'select', ['cables', 'struts']],
  ['Links', 'links.coupling', 'Engine coupling', 'select', ['cable', 'bar', 'none']],
  ['Livery', 'livery.base', 'Base colour', 'color'],
  ['Livery', 'livery.accent', 'Accent colour', 'color'],
  ['Livery', 'livery.trim', 'Trim colour', 'color'],
  ['Livery', 'livery.pattern', 'Pattern', 'select', ['plain', 'flames', 'stripes', 'checker', 'split']],
  ['Livery', 'livery.number', 'Racing number', 'number', [0, 99]],
  ['Livery', 'livery.font', 'Number style', 'select', ['race', 'stencil']],
  ['Livery', 'livery.metal', 'Metal finish', 'range', [0, 1, 0.05]],
  ['Livery', 'livery.wear', 'Wear and grime', 'range', [0, 1, 0.05]],
];

const getPath = (obj, path) => path.split('.').reduce((o, k) => o[k], obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

let rebuildQueued = false;
function queueRebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => { rebuildQueued = false; rebuild(); });
}

function buildControls() {
  const host = document.getElementById('controls');
  host.innerHTML = '';
  let group = '';
  for (const [g, path, label, type, opts] of CONTROLS) {
    if (g !== group) {
      group = g;
      const h = document.createElement('h3');
      h.textContent = g;
      host.appendChild(h);
    }
    const row = document.createElement('div');
    row.className = 'row';
    const value = getPath(spec, path);
    let input;
    if (type === 'range') {
      input = Object.assign(document.createElement('input'), { type: 'range', min: opts[0], max: opts[1], step: opts[2], value });
    } else if (type === 'select') {
      input = document.createElement('select');
      for (const o of opts) input.add(new Option(o, o));
      input.value = value;
    } else if (type === 'color') {
      input = Object.assign(document.createElement('input'), { type: 'color', value });
    } else {
      input = Object.assign(document.createElement('input'), { type: 'number', min: opts[0], max: opts[1], value });
    }
    const val = document.createElement('span');
    val.className = 'val';
    if (type === 'range') val.textContent = Number(value).toFixed(2);
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    row.append(labelEl, input, val);
    input.addEventListener('input', () => {
      let v = input.value;
      if (type === 'range') { v = parseFloat(v); val.textContent = v.toFixed(2); }
      if (type === 'number') v = clampInt(parseInt(v, 10), opts[0], opts[1]);
      setPath(spec, path, v);
      document.getElementById('preset').value = '';
      queueRebuild();
    });
    host.appendChild(row);
  }
}
const clampInt = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.opacity = 0), 1800);
}

function randomSpec() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const r = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
  const hue = () => `#${new THREE.Color().setHSL(Math.random(), r(0.35, 0.8), r(0.3, 0.55)).getHexString()}`;
  return {
    engine: { length: r(4, 6.4), bodyRadius: r(0.48, 0.75), intakeRadius: r(0.55, 0.95), bulge: r(0, 0.25),
              nozzle: pick(['afterburner', 'plain']), nozzleLength: r(0.7, 1.3), spacing: r(1.6, 2.3) },
    fins: { layout: pick(['none', 'vertical', 'outboard', 'both']), shape: pick(['swept', 'delta', 'square']), size: r(0.7, 1.3) },
    cockpit: { shape: pick(['teardrop', 'needle', 'tub']), length: r(2.8, 4.2), width: r(0.8, 1.25), distance: r(6.2, 8) },
    links: { tether: pick(['cables', 'struts']), coupling: pick(['cable', 'bar', 'none']) },
    livery: { base: hue(), accent: pick(['#f2e6d0', '#151210', '#e8c27a', '#f4f1ea']), trim: pick(['#1a1410', '#2a2a20', '#e8c27a']),
              pattern: pick(['plain', 'flames', 'stripes', 'checker', 'split']), number: Math.floor(Math.random() * 99) + 1,
              font: pick(['race', 'stencil']), metal: r(0.1, 0.85), wear: r(0, 0.8) },
  };
}

/** Accepts a pasted spec only if it has every field a preset has. */
function validSpec(s) {
  const ref = PRESETS['Redline Special'];
  return s && Object.keys(ref).every((k) => s[k] && Object.keys(ref[k]).every((f) => f in s[k]));
}

function loadSpec(next) {
  spec = clone(next);
  buildControls();
  rebuild();
}

const presetSelect = document.getElementById('preset');
presetSelect.add(new Option('(custom)', ''));
for (const name of Object.keys(PRESETS)) presetSelect.add(new Option(name, name));
presetSelect.value = 'Redline Special';
presetSelect.addEventListener('change', () => { if (presetSelect.value) loadSpec(PRESETS[presetSelect.value]); });

document.getElementById('btn-random').onclick = () => { presetSelect.value = ''; loadSpec(randomSpec()); };
document.getElementById('btn-copy').onclick = async () => {
  const json = JSON.stringify(spec, null, 2);
  try { await navigator.clipboard.writeText(json); toast('Pod spec copied'); }
  catch { console.log(json); toast('Clipboard blocked, spec logged to console'); }
};
document.getElementById('btn-paste').onclick = async () => {
  try {
    const parsed = JSON.parse(await navigator.clipboard.readText());
    if (!validSpec(parsed)) throw new Error('missing fields');
    presetSelect.value = '';
    loadSpec(parsed);
    toast('Pod spec loaded');
  } catch { toast('Clipboard does not hold a valid pod spec'); }
};
document.getElementById('btn-turntable').onclick = () => setView('turntable');
document.getElementById('btn-race').onclick = () => setView('race');
document.getElementById('btn-ab').onclick = (e) => { afterburner = !afterburner; e.target.classList.toggle('on', afterburner); };
document.getElementById('btn-spin').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.target.classList.toggle('on', controls.autoRotate); };

onResize();
buildControls();
rebuild();
setView('turntable');
frame();

// Developer hook, e.g. __workshop.load('Bluebird') or __workshop.view('race').
window.__workshop = { load: (name) => loadSpec(PRESETS[name]), view: setView, spec: () => spec,
  afterburner: (on) => { afterburner = on; } };
