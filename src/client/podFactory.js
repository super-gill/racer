import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ===========================================================================
   2. POD FACTORY
   buildPod(spec, options) returns a Three.js group plus handles for animation.
   Used by both the Pod Workshop and the game.
   Pod-local space: +X forward, +Z right, +Y up.
   =========================================================================== */

export const PodFactory = (() => {
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.12 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.7, roughness: 0.45 });
  const intakeDark = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x14232c, metalness: 0.9, roughness: 0.08 });
  const cable = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.6 });
  const UP = new THREE.Vector3(0, 1, 0);

  /** Small seeded random so a pod's flames and wear marks look the same every time it is built. */
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /**
   * A lathe (shape spun round an axis) laid along +X.
   * profile: [radius, position along the part] pairs from back to front.
   * UVs are rebuilt so v runs evenly from back (0) to front (1); u runs round the part,
   * with the top of the part at u = 0.75 and the right-hand side at u = 0 / 1.
   */
  function latheAlongX(profile, segments = 24) {
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), segments);
    const back = profile[0][1], front = Math.max(...profile.map((p) => p[1]));
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - back) / (front - back));
    geo.rotateZ(-Math.PI / 2);        // lathe axis +Y becomes +X (forward)
    geo.computeVertexNormals();
    return geo;
  }

  /* ---------- Livery: paint, numbers, wear, drawn onto a canvas per part ---------- */

  const FONTS = { race: 'italic 900 {s}px "Arial Black", "Helvetica Neue", Arial, sans-serif',
                  stencil: '700 {s}px "Courier New", "Consolas", monospace' };

  /**
   * Paints one part. The canvas is the part unrolled: x runs round the circumference, y runs
   * front (top of the canvas) to back. circumference and length (world units) keep markings in proportion.
   */
  function paintPart(livery, { circumference, length, kind, seed, textureSize = 1024 }) {
    const W = textureSize, H = textureSize / 2;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    const ax = W / circumference, ay = H / length;        // pixels per world unit, round and along
    const topX = W * 0.75;                                 // u = 0.75 is the top of the part
    const rand = seeded(seed);

    g.fillStyle = livery.base;
    g.fillRect(0, 0, W, H);

    // Pattern
    if (livery.pattern === 'stripes') {
      g.fillStyle = livery.accent;
      for (const offset of [-0.22, 0.22]) g.fillRect(topX + offset * ax - 0.09 * ax, 0, 0.18 * ax, H);
      g.fillStyle = livery.trim;
      for (const offset of [-0.36, 0.36]) g.fillRect(topX + offset * ax - 0.03 * ax, 0, 0.06 * ax, H);
    } else if (livery.pattern === 'flames') {
      // Licks of flame from the front, all the way round.
      g.fillStyle = livery.accent;
      g.strokeStyle = livery.trim;
      g.lineWidth = 0.05 * ay;
      g.fillRect(0, 0, W, 0.18 * ay);
      const tongues = Math.max(6, Math.round(circumference / 0.35));
      g.beginPath();
      g.moveTo(0, 0);
      for (let i = 0; i < tongues; i++) {
        const x0 = (i / tongues) * W, x1 = ((i + 1) / tongues) * W;
        const reach = (kind === 'engine' ? 0.32 : 0.45) * H * (0.55 + rand() * 0.6);
        const lean = (rand() - 0.3) * (x1 - x0);
        g.lineTo(x0, 0.15 * ay);
        g.bezierCurveTo(x0, reach * 0.6, x0 + lean, reach * 0.9, (x0 + x1) / 2 + lean, reach);
        g.bezierCurveTo((x0 + x1) / 2 + lean * 0.5, reach * 0.7, x1, reach * 0.5, x1, 0.15 * ay);
      }
      g.lineTo(W, 0);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (livery.pattern === 'checker') {
      const size = 0.22;
      const cols = Math.round(circumference / size), rows = 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        g.fillStyle = (r + c) % 2 ? livery.accent : livery.trim;
        g.fillRect((c / cols) * W, (0.25 + r * size) * ay, W / cols + 1, size * ay + 1);
      }
      g.fillStyle = livery.accent;
      g.fillRect(0, H - 0.25 * ay, W, 0.12 * ay);
    } else if (livery.pattern === 'split') {
      g.fillStyle = livery.accent;
      g.fillRect(0, 0, W, H * 0.4);
      g.fillStyle = livery.trim;
      g.fillRect(0, H * 0.4, W, 0.06 * ay);
    }

    // Panel seams with rivet rows: hand-built look.
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    const seams = kind === 'engine' ? [0.3, 0.55, 0.78] : [0.35, 0.7];
    for (const s of seams) {
      const y = s * H;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      for (let x = 6; x < W; x += 0.12 * ax) { g.beginPath(); g.arc(x, y + 5, 1.6, 0, Math.PI * 2); g.fill(); }
    }

    // Racing number in a roundel on top.
    const number = String(livery.number);
    const roundel = kind === 'cockpit' ? 0.38 : 0.3;      // radius in world units
    g.save();
    g.translate(topX, (kind === 'cockpit' ? 0.7 : 0.6) * H);   // cockpit: behind the canopy
    g.scale(ax / ay, 1);                                   // draw in along-length pixels, stretched round
    const rpx = roundel * ay;
    g.fillStyle = livery.accent;
    g.beginPath(); g.arc(0, 0, rpx, 0, Math.PI * 2); g.fill();
    g.lineWidth = rpx * 0.12;
    g.strokeStyle = livery.trim;
    g.stroke();
    g.fillStyle = livery.trim;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = rpx * (number.length > 1 ? 1.05 : 1.35);
    g.font = FONTS[livery.font].replace('{s}', size.toFixed(1));
    g.fillText(number, 0, rpx * 0.06);
    g.restore();

    // Soot towards the back, always some; more with wear.
    const soot = g.createLinearGradient(0, H, 0, H * 0.55);
    soot.addColorStop(0, `rgba(20,14,10,${0.35 + livery.wear * 0.5})`);
    soot.addColorStop(1, 'rgba(20,14,10,0)');
    g.fillStyle = soot;
    g.fillRect(0, H * 0.55, W, H * 0.45);

    // Wear: chipped paint showing bare metal, scratches, dust.
    const chips = Math.round(livery.wear * 140);
    for (let i = 0; i < chips; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(165,162,155,0.55)' : 'rgba(50,38,26,0.45)';
      g.beginPath();
      g.ellipse(rand() * W, rand() * H, 1 + rand() * 3.5 * livery.wear, 0.8 + rand() * 2 * livery.wear, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(210,205,195,0.45)';
    g.lineWidth = 1;
    for (let i = 0; i < chips / 3; i++) {
      const x = rand() * W, y = rand() * H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 20); g.stroke();
    }
    g.fillStyle = `rgba(200,160,110,${livery.wear * 0.25})`;
    g.fillRect(0, H * 0.75, W, H * 0.25);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function paintMaterial(livery, part) {
    return new THREE.MeshStandardMaterial({
      map: paintPart(livery, part),
      metalness: livery.metal,
      roughness: 0.55 - livery.metal * 0.3 + livery.wear * 0.25,
      side: THREE.DoubleSide,
    });
  }

  /* ---------- Engine ---------- */

  function engineProfile(e) {
    const L = e.length, R = e.bodyRadius, I = e.intakeRadius, n = e.nozzleLength;
    const back = -L / 2, front = L / 2;
    const exit = e.nozzle === 'afterburner' ? R * 0.84 : R * 0.6;
    return {
      exit, back, front,
      profile: [
        [exit * 0.86, back + 0.12],              // inside lip of the nozzle
        [exit, back],                             // nozzle exit
        [R * 0.88, back + n],                     // nozzle to body
        [R, back + n + 0.35],
        [R * (1 + e.bulge), back + L * 0.66],     // compressor bulge
        [R * (1 + e.bulge * 0.5), front - 0.5],
        [I, front - 0.16],                        // flare out to the intake
        [I * 1.03, front - 0.05],
        [I * 0.95, front],                        // intake lip
        [I * 0.84, front - 0.12],
        [I * 0.8, front - 0.4],                   // back inside the intake
      ],
    };
  }

  /** One engine. material: its painted material. side: -1 left, 1 right. */
  function buildEngine(spec, side, material) {
    const e = spec.engine;
    const group = new THREE.Group();
    const { profile, exit, back, front } = engineProfile(e);
    const shell = new THREE.Mesh(latheAlongX(profile, 28), material);
    group.add(shell);

    // Intake: chrome lip, dark face, chrome spinner.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(e.intakeRadius * 0.98, 0.045, 8, 32).rotateY(Math.PI / 2), chrome);
    lip.position.x = front - 0.02;
    const face = new THREE.Mesh(new THREE.CircleGeometry(e.intakeRadius * 0.82, 24).rotateY(Math.PI / 2), intakeDark);
    face.position.x = front - 0.4;
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(e.intakeRadius * 0.32, 0.5, 16).rotateZ(-Math.PI / 2), chrome);
    spinner.position.x = front - 0.2;
    group.add(lip, face, spinner);

    // Nozzle: dark throat; afterburner nozzles get a ring of iris petals.
    const throat = new THREE.Mesh(new THREE.CircleGeometry(exit * 0.86, 24).rotateY(-Math.PI / 2), intakeDark);
    throat.position.x = back + 0.12;
    group.add(throat);
    if (e.nozzle === 'afterburner') {
      // 14 petals round the exit, merged into one mesh so they cost one draw call.
      const petals = 14;
      const petalGeo = new THREE.BoxGeometry(0.5, 0.035, (2 * Math.PI * exit / petals) * 1.08);
      const pivot = new THREE.Object3D(), petal = new THREE.Object3D();
      pivot.add(petal);
      petal.position.set(back - 0.18, exit * 1.02, 0);
      petal.rotation.z = 0.18;                    // flared slightly open
      const pieces = [];
      for (let i = 0; i < petals; i++) {
        pivot.rotation.x = (i / petals) * Math.PI * 2;
        pivot.updateMatrixWorld(true);
        pieces.push(petalGeo.clone().applyMatrix4(petal.matrixWorld));
      }
      group.add(new THREE.Mesh(mergeGeometries(pieces), darkMetal));
      petalGeo.dispose();
      pieces.forEach((g) => g.dispose());
    }

    // Thrust reverser buckets: lie along the nozzle when stowed, swing in behind it when deployed.
    // The caller sets each pivot's rotation.y = userData.side * deployed (0 to 1) * 2.2.
    const reverserPivots = [-1, 1].map((plateSide) => {
      const pivot = new THREE.Group();
      pivot.position.set(back + e.nozzleLength * 0.35, 0, plateSide * e.bodyRadius * 0.92);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, exit * 1.2, 0.07), darkMetal);
      plate.position.x = 0.45;
      pivot.add(plate);
      pivot.userData.side = plateSide;
      group.add(pivot);
      return pivot;
    });

    // Exhaust glow and afterburner plume (both animated by the caller).
    const exhaustMaterial = additive(0xff9a3c, 0.9);
    const exhaust = new THREE.Mesh(new THREE.SphereGeometry(exit * 0.75, 12, 8), exhaustMaterial);
    exhaust.position.x = back - 0.05;
    const flame = new THREE.Group();
    flame.position.x = back;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(exit * 0.95, 4.5, 14, 1, true).rotateZ(Math.PI / 2), additive(0xff6a1a, 0.8));
    outer.position.x = -2.25;
    const core = new THREE.Mesh(new THREE.ConeGeometry(exit * 0.6, 2.6, 12, 1, true).rotateZ(Math.PI / 2), additive(0x9fc8ff, 0.95));
    core.position.x = -1.3;
    flame.add(outer, core);
    for (const x of [-1.0, -2.0, -3.0]) {
      const diamond = new THREE.Mesh(new THREE.SphereGeometry(exit * 0.4, 8, 6), additive(0xfff2d8, 0.85));
      diamond.position.x = x;
      flame.add(diamond);
    }
    flame.visible = false;
    group.add(exhaust, flame);

    // Fins at the back of the engine: vertical, outboard (horizontal, pointing away from the other engine), or both.
    const f = spec.fins;
    if (f.layout !== 'none') {
      const finMaterial = new THREE.MeshStandardMaterial({ color: spec.livery.accent, metalness: 0.3, roughness: 0.5 });
      const geo = finGeometry(f.shape, f.size);
      const finX = back + e.nozzleLength + 0.9 * f.size;
      if (f.layout === 'vertical' || f.layout === 'both') {
        const fin = new THREE.Mesh(geo, finMaterial);
        fin.position.set(finX, e.bodyRadius * 0.85, 0);
        group.add(fin);
      }
      if (f.layout === 'outboard' || f.layout === 'both') {
        const fin = new THREE.Mesh(geo, finMaterial);
        fin.rotation.x = side * Math.PI / 2;      // shape's "up" now points out to this engine's side
        fin.position.set(finX, 0, side * e.bodyRadius * 0.85);
        group.add(fin);
      }
    }
    return { group, exhaust, exhaustMaterial, flame, material, reverserPivots };
  }

  function finGeometry(shape, size) {
    const outlines = {
      swept: [[0.8, 0], [-0.8, 0], [-1.15, 1], [-0.45, 1]],
      delta: [[0.9, 0], [-0.8, 0], [-0.85, 1.1]],
      square: [[0.6, 0], [-0.6, 0], [-0.65, 0.9], [0.35, 0.9]],
    };
    const pts = outlines[shape].map(([x, y]) => new THREE.Vector2(x * size, y * size));
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts),
      { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    geo.translate(0, 0, -0.035);
    return geo;
  }

  /* ---------- Cockpit ---------- */

  function cockpitProfile(c) {
    const L = c.length, W = c.width, h = L / 2;
    const shapes = {
      teardrop: [[0, -h], [W * 0.35, -h + 0.15], [W * 0.8, -L * 0.15], [W, L * 0.12], [W * 0.85, L * 0.32], [W * 0.45, L * 0.46], [0, h]],
      needle: [[0, -h], [W * 0.5, -h + 0.1], [W * 0.85, -L * 0.22], [W * 0.8, L * 0.1], [W * 0.45, L * 0.35], [W * 0.12, L * 0.48], [0, h]],
      tub: [[0, -h], [W * 0.85, -h + 0.06], [W, -L * 0.3], [W, L * 0.28], [W * 0.9, L * 0.42], [W * 0.5, L * 0.49], [0, h]],
    };
    return shapes[c.shape];
  }

  function buildCockpit(spec, seed, textureSize) {
    const c = spec.cockpit;
    const group = new THREE.Group();
    const material = paintMaterial(spec.livery, { circumference: 2 * Math.PI * c.width, length: c.length, kind: 'cockpit', seed, textureSize });
    const hull = new THREE.Mesh(latheAlongX(cockpitProfile(c), 24), material);
    hull.scale.y = 0.62;
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(c.length * 0.22, c.width * 0.5, c.width * 0.55);
    canopy.position.set(c.length * 0.1, c.width * 0.45, 0);
    const finMaterial = new THREE.MeshStandardMaterial({ color: spec.livery.accent, metalness: 0.3, roughness: 0.5 });
    const tail = new THREE.Mesh(finGeometry('swept', 0.55), finMaterial);
    tail.position.set(-c.length * 0.3, c.width * 0.5, 0);
    group.add(hull, canopy, tail);
    return { group, material };
  }

  /* ---------- Links between the parts ---------- */

  function stretchBetween(mesh, a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len || 1));
    mesh.scale.set(1, len, 1);
  }

  /**
   * Tethers, struts and the engine coupling. Each link is anchored to a point on a part,
   * so updateLinks() can keep it attached while the parts bob independently.
   */
  function buildLinks(spec, engines, cockpit) {
    const group = new THREE.Group();
    const links = [];
    const e = spec.engine, c = spec.cockpit;
    const strut = spec.links.tether === 'struts';
    const tetherGeo = new THREE.CylinderGeometry(strut ? 0.09 : 0.06, strut ? 0.09 : 0.06, 1, strut ? 8 : 5);
    const tetherMat = strut ? darkMetal : cable;
    const addLink = (geo, mat, partA, offsetA, partB, offsetB, joints) => {
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      const link = { mesh, partA, offsetA, partB, offsetB, joints: [] };
      if (joints) for (let i = 0; i < 2; i++) {
        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), chrome);
        group.add(joint);
        link.joints.push(joint);
      }
      links.push(link);
    };
    // Engine tail to cockpit nose, one each side.
    engines.forEach((engine, i) => {
      const side = i === 0 ? -1 : 1;
      addLink(tetherGeo, tetherMat,
        engine.group, new THREE.Vector3(-e.length / 2 + e.nozzleLength + 0.2, 0, -side * e.bodyRadius * 0.6),
        cockpit, new THREE.Vector3(c.length * 0.3, 0.1, side * c.width * 0.45), strut);
    });
    // Coupling between the engines.
    if (spec.links.coupling !== 'none') {
      const bar = spec.links.coupling === 'bar';
      const x = e.length * 0.25;
      addLink(new THREE.CylinderGeometry(bar ? 0.08 : 0.05, bar ? 0.08 : 0.05, 1, 6), bar ? darkMetal : cable,
        engines[0].group, new THREE.Vector3(x, 0, e.bodyRadius * 0.9),
        engines[1].group, new THREE.Vector3(x, 0, -e.bodyRadius * 0.9), false);
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    function update() {
      for (const link of links) {
        a.copy(link.partA.position).add(link.offsetA);
        b.copy(link.partB.position).add(link.offsetB);
        stretchBetween(link.mesh, a, b);
        if (link.joints.length) { link.joints[0].position.copy(a); link.joints[1].position.copy(b); }
      }
    }
    update();
    return { group, update };
  }

  /* ---------- Whole pod ---------- */

  /**
   * Builds a pod from a spec. Engines sit ahead of the centre, cockpit behind, as in the game.
   * options.textureSize: livery canvas width in pixels (1024 for close-ups, 512 is plenty in a race).
   *
   * Returns handles for animating it:
   *   root, body            position/heading group, and the bank/pitch group inside it
   *   engines[i]            { group, base, exhaust, exhaustMaterial, flame, material, reverserPivots }, left then right
   *   cockpit, cockpitBase  cockpit group and its rest position
   *   links                 group holding the cables or struts (hide it when the pod breaks up)
   *   updateLinks()         call after moving engines or cockpit so links stay attached
   *   dispose()             frees GPU memory
   */
  function buildPod(spec, { textureSize = 1024 } = {}) {
    const root = new THREE.Group();          // position and heading
    const body = new THREE.Group();          // bank and pitch
    root.add(body);
    const seed = (spec.livery.number * 7919 + spec.livery.pattern.length * 31) | 0;
    const engineX = spec.cockpit.distance * 0.4;
    const cockpitX = -spec.cockpit.distance * 0.6;

    // Both engines use the same painted texture (half the texture memory), but each has its own
    // material so it can glow with its own heat.
    const engineMaterial = paintMaterial(spec.livery, {
      circumference: 2 * Math.PI * spec.engine.bodyRadius, length: spec.engine.length, kind: 'engine', seed, textureSize });
    const engines = [-1, 1].map((side) => {
      const engine = buildEngine(spec, side, side < 0 ? engineMaterial : engineMaterial.clone());
      engine.base = new THREE.Vector3(engineX, 0, side * spec.engine.spacing);
      engine.group.position.copy(engine.base);
      body.add(engine.group);
      return engine;
    });
    const cockpit = buildCockpit(spec, seed + 1, textureSize);
    const cockpitBase = new THREE.Vector3(cockpitX, 0, 0);
    cockpit.group.position.copy(cockpitBase);
    body.add(cockpit.group);
    const links = buildLinks(spec, engines, cockpit.group);
    body.add(links.group);

    root.traverse((o) => {
      if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) { o.castShadow = true; o.receiveShadow = true; }
    });

    return {
      root, body, engines, cockpit: cockpit.group, cockpitBase, links: links.group,
      updateLinks: links.update,
      dispose() {
        const shared = [chrome, darkMetal, intakeDark, glass, cable];
        root.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          if (shared.includes(o.material)) return;
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        });
      },
    };
  }

  return { buildPod };
})();
