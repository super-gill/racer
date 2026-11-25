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
  'Copperhead': {
    engine: { length: 4.4, bodyRadius: 0.72, intakeRadius: 0.9, bulge: 0.2, nozzle: 'afterburner', nozzleLength: 0.8, spacing: 2.1 },
    fins: { layout: 'none', shape: 'swept', size: 1.0 },
    cockpit: { shape: 'teardrop', length: 3.0, width: 1.2, distance: 6.4 },
    links: { tether: 'struts', coupling: 'cable' },
    livery: { base: '#a85a2c', accent: '#151210', trim: '#e8c27a', pattern: 'checker', number: 3, font: 'race', metal: 0.75, wear: 0.35 },
  },
};

export const clone = (o) => JSON.parse(JSON.stringify(o));
