/**
 * Renderer, camera, lights and the static world: ground, track surface, canyon walls,
 * mesas, rocks and the start gantry. Everything here is built once at load.
 */
import * as THREE from 'three';
import { TRACK_HALF_WIDTH, WALL_PLATEAU } from '../shared/config.js';
import { track, N, nearestGlobal, obstacles } from '../shared/track.js';
import { lerp, randRange, seededRandom } from '../shared/utils.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = 'view';
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const SKY_COLOR = 0xe9c9a0;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 260, 950);

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 3000);

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x9a6a40, 1.0));
export const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 450 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

const worldRandom = seededRandom(1977);
const worldRange = (a, b) => a + (b - a) * worldRandom();

/** Procedural speckled texture, drawn on a canvas. Gives the eye something to judge speed by. */
function makeSpeckleTexture({ size = 256, base, speckles, streaks = 0, edgeBands = false, repeat = 1 }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (const [color, count, maxR] of speckles) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      g.globalAlpha = 0.12 + Math.random() * 0.35;
      g.beginPath();
      g.arc(Math.random() * size, Math.random() * size, 0.5 + Math.random() * maxR, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = '#5a3a22';
  for (let i = 0; i < streaks; i++) {          // long marks along the racing direction
    g.globalAlpha = 0.05 + Math.random() * 0.12;
    g.lineWidth = 1 + Math.random() * 3;
    const x = Math.random() * size;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + randRange(-4, 4), size); g.stroke();
  }
  if (edgeBands) {                             // darker shoulders at the track edges
    g.globalAlpha = 0.35;
    g.fillStyle = '#5b3b22';
    g.fillRect(0, 0, size * 0.05, size);
    g.fillRect(size * 0.95, 0, size * 0.05, size);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function buildGround() {
  const tex = makeSpeckleTexture({
    base: '#c89a6a', repeat: 300,
    speckles: [['#a77a4f', 900, 1.6], ['#e0b88a', 500, 1.2], ['#8a5f3c', 160, 2.2]],
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  mesh.position.y = -0.02;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildTrackSurface() {
  const hw = TRACK_HALF_WIDTH;
  const positions = [], normals = [], uvs = [], indices = [];
  for (let i = 0; i <= N; i++) {               // one extra row closes the loop with continuous UVs
    const p = track.pts[i % N];
    const v = (i === N ? track.length : p.dist) / 16;
    positions.push(p.x - p.nx * hw, 0.03, p.y - p.ny * hw, p.x + p.nx * hw, 0.03, p.y + p.ny * hw);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, v, 1, v);
    if (i < N) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const tex = makeSpeckleTexture({
    base: '#a8805a', streaks: 40, edgeBands: true,
    speckles: [['#7d5a3a', 700, 1.4], ['#c79f75', 400, 1.1]],
  });
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** Builds a mesh from rows of points; neighbouring rows and columns become quads. */
function stripGeometry(rows, colorFor) {
  const cols = rows[0].length;
  const positions = [], colors = [], indices = [];
  const c = new THREE.Color();
  rows.forEach((row, r) => {
    row.forEach((v, col) => {
      positions.push(v.x, v.y, v.z);
      colorFor(v, col, c);
      colors.push(c.r, c.g, c.b);
      if (r < rows.length - 1 && col < cols - 1) {
        const a = r * cols + col, b = a + 1, d = a + cols, e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Wall height varies smoothly round the lap. Whole-number frequencies keep it seamless at the start line. */
function wallHeight(i, side) {
  const u = (i / N) * Math.PI * 2;
  return 10 + 5 * Math.sin(u * 7 + side * 1.7) + 3 * Math.sin(u * 23 + side);
}

function buildCanyonWalls() {
  const hw = TRACK_HALF_WIDTH;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });
  // Sandstone bands by height, lighter on top of the rim.
  const strata = (v, col, out) => {
    const band = 0.5 + 0.5 * Math.sin(v.y * 1.25 + Math.sin(v.x * 0.02) * 1.5);
    if (col === 3) out.setRGB(0.86, 0.62, 0.40, THREE.SRGBColorSpace);
    else out.setRGB(lerp(0.62, 0.80, band), lerp(0.32, 0.46, band), lerp(0.19, 0.27, band), THREE.SRGBColorSpace);
  };
  for (const side of [-1, 1]) {
    const rows = [];
    for (let i = 0; i <= N; i++) {
      const p = track.pts[i % N];
      const h = wallHeight(i % N, side);
      const rim = h + 2 * Math.sin((i / N) * Math.PI * 2 * 41);
      const at = (offset, y) => new THREE.Vector3(p.x + p.nx * side * offset, y, p.y + p.ny * side * offset);
      rows.push([
        at(hw, 0),                              // wall foot at the track edge
        at(hw + 1.5, h * 0.55),                 // slight lean back
        at(hw + 3, h),                          // top of the wall face
        at(hw + 3 + WALL_PLATEAU, rim),         // far side of the rim
        at(hw + 9 + WALL_PLATEAU, 0),           // back down to the desert floor
      ]);
    }
    const mesh = new THREE.Mesh(stripGeometry(rows, strata), material);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function buildMesas() {
  const material = new THREE.MeshStandardMaterial({ color: 0xb8714a, flatShading: true, roughness: 0.95 });
  let placed = 0;
  for (let tries = 0; tries < 3000 && placed < 80; tries++) {
    const x = worldRange(-950, 950), z = worldRange(-850, 950);
    const radius = worldRange(12, 50);
    if (nearestGlobal(x, z).distance < TRACK_HALF_WIDTH + WALL_PLATEAU + 20 + radius) continue;
    const height = worldRange(18, 95);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * worldRange(0.55, 0.9), radius, height, 7, 1), material);
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = worldRange(0, Math.PI * 2);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    placed++;
  }
}

function buildObstacles() {
  const material = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, flatShading: true, roughness: 0.9 });
  for (const o of obstacles) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(o.radius, 0), material);
    mesh.scale.set(1, 1.8, 1);
    mesh.position.set(o.x, o.radius * 1.3, o.y);
    mesh.rotation.y = worldRange(0, Math.PI);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function buildStartGate() {
  const p = track.pts[0];
  const hw = TRACK_HALF_WIDTH;
  // Chequered line
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 256;
  const g = canvas.getContext('2d');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#1d140c' : '#f2e6d0';
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(4, hw * 2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  line.position.set(p.x, 0.06, p.y);
  line.rotation.y = -p.angle;
  line.receiveShadow = true;
  scene.add(line);
  // Gantry
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a3a30, metalness: 0.5, roughness: 0.6, flatShading: true });
  const banner = new THREE.MeshStandardMaterial({ color: 0xd8572a, roughness: 0.7 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 1.2), metal);
    post.position.set(p.x + p.nx * side * (hw + 1), 8, p.y + p.ny * side * (hw + 1));
    post.castShadow = true;
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, hw * 2 + 3), banner);
  beam.position.set(p.x, 15, p.y);
  beam.rotation.y = -p.angle;
  beam.castShadow = true;
  scene.add(beam);
}

buildGround();
buildTrackSurface();
buildCanyonWalls();
buildMesas();
buildObstacles();
buildStartGate();
