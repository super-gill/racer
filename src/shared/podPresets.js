/**
 * Pod specs and presets. A pod's look is described entirely by a spec object.
 * Data only, so the host can use it later (for example, a player's chosen pod in the lobby).
 * Every visual difference comes from these numbers, so later the same values can carry
 * gameplay stats. Units match the game: 1 unit is roughly 1 metre.
 */

export const PRESETS = {
  'Redline Special': {
    engine: { length: 5.0, bodyRadius: 0.6, intakeRadius: 0.72, bulge: 0.12, nozzle: 'afterburner', nozzleLength: 1.0, spacing: 1.9 },
    fins: { layout: 'outboard', shape: 'swept', size: 1.0 },
    cockpit: { shape: 'teardrop', length: 3.4, width: 1.0, distance: 7.0 },
    links: { tether: 'cables', coupling: 'cable' },
    livery: { base: '#b8261c', accent: '#f2e6d0', trim: '#1a1410', pattern: 'flames', number: 7, font: 'race', metal: 0.45, wear: 0.2 },
  },
  'Desert Surplus': {
    engine: { length: 5.6, bodyRadius: 0.66, intakeRadius: 0.66, bulge: 0.06, nozzle: 'plain', nozzleLength: 0.8, spacing: 2.0 },
    fins: { layout: 'vertical', shape: 'square', size: 1.1 },
    cockpit: { shape: 'tub', length: 3.0, width: 1.15, distance: 6.6 },
    links: { tether: 'struts', coupling: 'bar' },
    livery: { base: '#5d5a3a', accent: '#d8cfa8', trim: '#2a2a20', pattern: 'plain', number: 42, font: 'stencil', metal: 0.2, wear: 0.7 },
  },
  'Bluebird': {
    engine: { length: 6.0, bodyRadius: 0.52, intakeRadius: 0.6, bulge: 0.1, nozzle: 'afterburner', nozzleLength: 1.2, spacing: 1.7 },
    fins: { layout: 'both', shape: 'delta', size: 0.9 },
    cockpit: { shape: 'needle', length: 4.0, width: 0.85, distance: 7.6 },
    links: { tether: 'cables', coupling: 'none' },
    livery: { base: '#3d7fc1', accent: '#f4f1ea', trim: '#152238', pattern: 'stripes', number: 12, font: 'race', metal: 0.55, wear: 0.1 },
  },
  'Night Shift': {
    engine: { length: 5.4, bodyRadius: 0.56, intakeRadius: 0.64, bulge: 0.08, nozzle: 'afterburner', nozzleLength: 1.1, spacing: 1.8 },
    fins: { layout: 'outboard', shape: 'delta', size: 1.1 },
    cockpit: { shape: 'needle', length: 3.8, width: 0.9, distance: 7.2 },
    links: { tether: 'cables', coupling: 'bar' },
    livery: { base: '#1b1a1e', accent: '#d9a441', trim: '#5a4a2a', pattern: 'stripes', number: 9, font: 'race', metal: 0.6, wear: 0.15 },
  },
  'Rustbucket': {
    engine: { length: 4.8, bodyRadius: 0.7, intakeRadius: 0.78, bulge: 0.18, nozzle: 'plain', nozzleLength: 0.9, spacing: 2.2 },
    fins: { layout: 'both', shape: 'square', size: 0.9 },
    cockpit: { shape: 'tub', length: 3.2, width: 1.25, distance: 6.8 },
    links: { tether: 'struts', coupling: 'cable' },
    livery: { base: '#8a4b2a', accent: '#c9b08a', trim: '#3a2a1e', pattern: 'split', number: 66, font: 'stencil', metal: 0.25, wear: 0.85 },
  },
  'Copperhead': {
    engine: { length: 4.4, bodyRadius: 0.72, intakeRadius: 0.9, bulge: 0.2, nozzle: 'afterburner', nozzleLength: 0.8, spacing: 2.1 },
    fins: { layout: 'none', shape: 'swept', size: 1.0 },
    cockpit: { shape: 'teardrop', length: 3.0, width: 1.2, distance: 6.4 },
    links: { tether: 'struts', coupling: 'cable' },
    livery: { base: '#a85a2c', accent: '#151210', trim: '#e8c27a', pattern: 'checker', number: 3, font: 'race', metal: 0.75, wear: 0.35 },
  },
};

export const clone = (o) => JSON.parse(JSON.stringify(o));

/** The pod a player gets until they choose one in the Pod Workshop. */
export const DEFAULT_PLAYER_POD = 'Redline Special';

/**
 * Every field of a pod spec, with its label for the workshop and the values it may take.
 * [group, path, label, type, options]: range [min, max, step], select [choices], color, number [min, max].
 */
export const SPEC_SCHEMA = [
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

/** Base colour of a spec as a number, e.g. for minimap dots. */
export const specColor = (spec) => parseInt(spec.livery.base.slice(1), 16);

/**
 * Returns a safe copy of a spec: every field present, numbers clamped to their range, choices
 * limited to the allowed options, colours in #rrggbb form. Anything missing or invalid falls back
 * to the default pod's value. Used for saved pods and, later, pods sent over the network.
 */
export function sanitizeSpec(input) {
  const out = clone(PRESETS[DEFAULT_PLAYER_POD]);
  for (const [, path, , type, opts] of SPEC_SCHEMA) {
    const [group, field] = path.split('.');
    const value = input?.[group]?.[field];
    if (type === 'range' && typeof value === 'number' && Number.isFinite(value)) {
      out[group][field] = Math.min(opts[1], Math.max(opts[0], value));
    } else if (type === 'number' && Number.isInteger(value)) {
      out[group][field] = Math.min(opts[1], Math.max(opts[0], value));
    } else if (type === 'select' && opts.includes(value)) {
      out[group][field] = value;
    } else if (type === 'color' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      out[group][field] = value.toLowerCase();
    }
  }
  return out;
}

/** Key under which the player's chosen pod is saved in the browser (shared by game and workshop). */
export const MY_POD_STORAGE_KEY = 'pod-proto.my-pod.v1';

/**
 * Turns a saved pod record ({ name, spec }) into a safe one. Falls back to the default pod.
 * The name is the preset it came from, or 'Custom'.
 */
export function sanitizeSavedPod(record) {
  const name = typeof record?.name === 'string' && record.name.trim() ? record.name.trim().slice(0, 24) : DEFAULT_PLAYER_POD;
  return { name, spec: sanitizeSpec(record?.spec ?? PRESETS[DEFAULT_PLAYER_POD]) };
}

