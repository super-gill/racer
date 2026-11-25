/**
 * Fixed game constants. Anything you will want to tweak while driving lives in tuning.js
 * instead, and is exposed in the tuning panel.
 * Shared by the browser client and (later) the Node host, so no browser-only code here.
 */

export const GAME_TITLE = 'WORKING TITLE';     // placeholder name, change in one place
export const VERSION = '0.1.4';
export const LAPS = 3;
export const FIXED_DT = 1 / 120;               // physics runs at a fixed 120 steps per second
export const SPEED_DISPLAY = 7;                // sim units per second to km/h shown on the HUD

export const TRACK_HALF_WIDTH = 18;            // distance from track centre to wall
export const SAMPLE_SPACING = 4;               // distance between centreline samples
export const WALL_PLATEAU = 26;                // width of the canyon rim beyond each wall
export const IDLE_SPOOL = 0.3;                 // engine revs at idle, as a fraction of maximum
export const FUEL_CAPACITY = 100;              // fuel units in a full tank

// Track centreline control points (x, z). A closed Catmull-Rom curve runs through them.
export const CONTROL_POINTS = [
  [0, -300], [250, -320], [420, -220], [430, -40], [300, 40], [260, 160],
  [380, 280], [300, 400], [80, 380], [-60, 250], [-200, 320], [-380, 260],
  [-420, 60], [-300, -80], [-380, -220], [-220, -320],
];

// Rock pillars on the racing surface: [fraction of lap, lateral offset, radius].
// Positive lateral offset is to the right of the racing direction.
export const OBSTACLE_LAYOUT = [
  [0.12, -7, 3.5], [0.20, 8, 3.0], [0.33, 0, 4.0], [0.45, -9, 3.0],
  [0.52, 6, 3.5], [0.63, -4, 3.0], [0.75, 9, 4.0], [0.86, -8, 3.2],
];

// AI opponents. lane: preferred lateral offset. topSpeed: in sim units per second.
export const AI_DRIVERS = [
  { name: 'Varrick Sol', color: 0x3f7fd6, lane: -5, topSpeed: 93, steerGain: 2.4, boostHeatLimit: 0.55 },
  { name: 'Mira Kade',   color: 0x4fb06a, lane:  4, topSpeed: 97, steerGain: 2.2, boostHeatLimit: 0.70 },
  { name: 'Dusk Oro',    color: 0x9a5ad0, lane:  0, topSpeed: 90, steerGain: 2.6, boostHeatLimit: 0.45 },
];

// AI settings used to drive a human's pod after they finish, or in autodrive.
export const HUMAN_AI = { lane: 0, topSpeed: 90, steerGain: 2.4, boostHeatLimit: 0.5, phase: 0 };
export const PLAYER_COLOR = 0xe8742a;

// Starting grid behind the line: [samples behind the line, lateral offset]. Two by two.
export const GRID = [[-10, -7], [-10, 7], [-22, -7], [-22, 7]];

// Collision circles in pod-local space [forward offset, radius]: engine pair and cockpit.
export const COLLISION_CIRCLES = [[2.6, 2.6], [-4.4, 1.5]];
