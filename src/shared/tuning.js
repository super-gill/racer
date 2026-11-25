/**
 * Handling and engine tuning.
 * One shared object read by the simulation every step. The client's tuning panel edits it live
 * and saves it in the browser; later the host will send its values to every player.
 */

export const TUNING_DEFAULTS = {
  // Engines: afterburning low-bypass jets
  engineThrust: 30,        // dry thrust per engine at full revs
  idleThrust: 0.06,        // thrust at idle as a fraction of full: a running jet always pushes
  spoolUpRate: 2.4,        // how fast revs climb (slower near idle, quicker near the top)
  spoolDownRate: 4,        // how fast revs fall
  reverseThrust: 0.4,      // reverser thrust as a fraction of forward
  reverserRate: 2.5,       // how fast the reverser buckets deploy or stow (1 / seconds)
  // Afterburner
  afterburnerThrust: 1.45, // thrust multiplier with the afterburner lit
  afterburnerLightTime: 0.3, // seconds for the afterburner to light fully
  // Handling
  turnGain: 14,            // how strongly an engine thrust difference turns the pod
  angularDamping: 4.0,     // how quickly spin settles when thrust evens out
  lateralGrip: 3.5,        // how fast sideways sliding is killed (low = drifty)
  linearDrag: 0.25,
  quadDrag: 0.004,         // drag that grows with speed, sets top speed
  turnDrag: 0.06,          // extra drag while rotating: a turning pod is not aerodynamic
  // Levers
  leverRate: 8,            // how fast keys move a lever. Fast: the engine spool provides the lag
  splitRate: 12,           // linked mode: how fast steering pulls the inside lever back
  splitReturnRate: 14,     // linked mode: how fast the levers come back into line
  splitDepth: 1.2,         // linked mode: how far full steering pulls the inside lever back
  // Heat
  heatRate: 0.10,          // heat gained per second at full dry revs
  afterburnerHeatMult: 3.2, // heat with the afterburner lit, as a multiple of full dry
  coolRate: 0.14,          // heat lost per second
  flameoutTime: 1.5,       // seconds before an overheated engine relights
  // Fuel
  startFuel: 100,          // percent of a full tank at the start
  fuelBurnIdle: 0.02,      // fuel per second per engine at idle
  fuelBurnDry: 0.16,       // extra fuel per second per engine at full dry revs
  fuelBurnAfterburner: 0.5, // extra fuel per second per engine with the afterburner lit
  fuelWeight: 0.25,        // how much heavier a full tank makes the pod (0.25 = 25%)
  dryTankWreckSpeed: 15,   // running dry above this speed drops the pod hard enough to wreck it
  // Crashes
  crashSpeed: 45,          // impact speed into a wall or rock that wrecks the pod
  wallBounce: 0.35,        // how much speed bounces back off a wall
  // Visual
  hoverHeight: 1.6,
  bobAmount: 0.25,
  bankAmount: 0.12,
  // Camera
  cameraHeight: 70,
  cameraZoomWithSpeed: 0.25,
};

export const TUNING_META = [
  // [group, key, label, min, max, step]
  ['Engines', 'engineThrust', 'Dry thrust per engine', 10, 60, 1],
  ['Engines', 'idleThrust', 'Idle thrust', 0, 0.3, 0.01],
  ['Engines', 'spoolUpRate', 'Spool up speed', 0.3, 10, 0.1],
  ['Engines', 'spoolDownRate', 'Spool down speed', 0.3, 12, 0.1],
  ['Engines', 'reverseThrust', 'Reverser power', 0, 1, 0.05],
  ['Engines', 'reverserRate', 'Reverser speed', 0.5, 10, 0.1],
  ['Afterburner', 'afterburnerThrust', 'Afterburner multiplier', 1, 2.5, 0.05],
  ['Afterburner', 'afterburnerLightTime', 'Light-up seconds', 0.05, 1.5, 0.05],
  ['Handling', 'turnGain', 'Turn from thrust split', 2, 40, 0.5],
  ['Handling', 'angularDamping', 'Spin damping', 0.5, 12, 0.1],
  ['Handling', 'lateralGrip', 'Sideways grip', 0.2, 12, 0.1],
  ['Handling', 'linearDrag', 'Drag (linear)', 0, 1, 0.01],
  ['Handling', 'quadDrag', 'Drag (speed)', 0, 0.02, 0.0005],
  ['Handling', 'turnDrag', 'Turn drag', 0, 0.3, 0.005],
  ['Levers', 'leverRate', 'Lever speed', 0.5, 20, 0.5],
  ['Levers', 'splitRate', 'Linked: split speed', 1, 30, 0.5],
  ['Levers', 'splitReturnRate', 'Linked: return speed', 1, 30, 0.5],
  ['Levers', 'splitDepth', 'Linked: split depth', 0.3, 2, 0.05],
  ['Heat', 'heatRate', 'Heat at full dry revs', 0, 0.5, 0.01],
  ['Heat', 'afterburnerHeatMult', 'Afterburner heat multiple', 1, 8, 0.1],
  ['Heat', 'coolRate', 'Cooling', 0, 0.5, 0.01],
  ['Heat', 'flameoutTime', 'Relight seconds', 0.2, 5, 0.1],
  ['Fuel', 'startFuel', 'Starting fuel %', 10, 100, 1],
  ['Fuel', 'fuelBurnIdle', 'Burn at idle', 0, 0.1, 0.005],
  ['Fuel', 'fuelBurnDry', 'Burn at full dry', 0, 0.6, 0.01],
  ['Fuel', 'fuelBurnAfterburner', 'Burn on afterburner', 0, 2, 0.05],
  ['Fuel', 'fuelWeight', 'Full tank weight', 0, 1, 0.05],
  ['Fuel', 'dryTankWreckSpeed', 'Dry tank wreck speed', 0, 80, 1],
  ['Crashes', 'crashSpeed', 'Wreck impact speed', 10, 150, 1],
  ['Crashes', 'wallBounce', 'Wall bounce', 0, 1, 0.05],
  ['Visual', 'hoverHeight', 'Hover height', 0.5, 5, 0.1],
  ['Visual', 'bobAmount', 'Bob amount', 0, 1, 0.05],
  ['Visual', 'bankAmount', 'Bank amount', 0, 0.4, 0.01],
  ['Camera', 'cameraHeight', 'Camera height', 30, 200, 1],
  ['Camera', 'cameraZoomWithSpeed', 'Zoom out with speed', 0, 1, 0.01],
];

/** The live values. Always the same object, so modules can hold a reference to it. */
export const tuning = { ...TUNING_DEFAULTS };

/** Copies known keys from values into the live tuning. Unknown keys are ignored. */
export function applyTuning(values) {
  for (const key of Object.keys(TUNING_DEFAULTS)) {
    if (typeof values?.[key] === 'number' && Number.isFinite(values[key])) tuning[key] = values[key];
  }
}

export function resetTuning() {
  Object.assign(tuning, TUNING_DEFAULTS);
}
