# Changelog

All notable changes to this project are recorded here.
Versions stay below 1.0 until the first full release.

## [0.1.5] - 2026-11-25

Puts the Pod Workshop models in the game. Every pod is now built from a workshop spec, and you race your own design.

### Added
- Game pods built by the Pod Factory from each pod's spec
- "Race this pod" and "Load my pod" in the workshop, with your saved pod shown on the game's title screen
- Two presets: Night Shift and Rustbucket
- Two AI drivers, Hale Brannock and Juno Vex, and a preset for every AI driver
- Thrust reverser buckets on Pod Factory engines
- Shared pod spec schema and `sanitizeSpec()`, which cleans saved and pasted specs
- Second headless test scenario: 4 humans and 2 AI
- `__dev.renderInfo()` for draw calls, triangles and memory

### Changed
- Grid raised from 4 to 6 pods (three rows of two)
- Workshop controls come from the shared spec schema
- Nozzle petals merged into one mesh, and both engines share one livery texture
- Race liveries drawn at 512 px wide (1024 in the workshop)
- Results table escapes pod names, ready for player-entered names over the LAN

### Removed
- The old primitive pod model

## [0.1.4] - 2026-11-24

Restructures the project as the groundwork for LAN play. The game plays the same, but now runs from a small Node host, with the race simulation separated so it can later run on that host.

### Added
- Node host (`npm start`): a dependency-free web server that prints its LAN addresses and serves read-only from four folders
- Headless race test (`npm test`): a full race in Node with no browser
- Simulation events (crash, lap, impact, finish, out and others) that the client turns into effects, sound and messages
- Raw human input passed into the simulation, the form players will send over the network
- Favicon

### Changed
- Split the single-file game into modules: `src/shared` (simulation, no graphics) and `src/client` (rendering, HUD, sound, input)
- Split the Pod Workshop into the pod factory, presets and page modules
- Serve Three.js from `node_modules` instead of a CDN, so no internet access is needed after install
- Moved CSS into `public/css`
- Humans can be driven by the AI after finishing or in autodrive through a per-pod flag
- Race phase ends once every human has finished or is out

### Removed
- Standalone `index.html` and `workshop.html` that opened directly from disk

## [0.1.3] - 2026-11-24

Adds the Pod Workshop to design the look of pods (salvaged military jets, hot-rodded) before they go into the game. The game is unchanged at 0.1.2.

### Added
- `workshop.html`: standalone pod design page
- Pod Factory: builds pods from a spec, written to be copied into the game unchanged
- Lathe engines with nozzle, compressor bulge, chrome intake lip and spinner
- Afterburner nozzles with iris petals, and plain nozzles
- Fins in four layouts and three shapes, built from outlines
- Teardrop, needle and tub cockpits with glass canopy and tail fin
- Cable or strut tethers, and cable, bar or no engine coupling, all kept attached while parts bob
- Painted liveries: five patterns, racing number roundels, two number styles, metal finish, wear and soot
- Four presets: Redline Special, Desert Surplus, Bluebird, Copperhead
- Close-up turntable and race-height view with the other presets in formation
- Randomise, and copy and paste of pod specs as JSON
- Environment reflections for metal and chrome

## [0.1.2] - 2026-11-24

The engines are now afterburning low-bypass jets, giving boost, braking and fuel a physical basis.

### Added
- Engine spool: revs chase the lever, slow from idle and quicker near the top
- Idle thrust: a running jet always pushes, so pods never fully stop
- Thrust reversers below idle as brakes, with animated buckets and forward-blown exhaust
- Afterburner on Shift, which only lights at full lever and full revs, with plume and shock diamonds
- Fuel: one tank burned by idle, revs and afterburner, with a HUD gauge and low-fuel warning
- Fuel weight: a full tank slows acceleration and turning
- Running dry shuts the pod down and puts it out of the race, wrecking above a set speed
- Recover to track (Backspace) with a 3 s cooldown
- Engine output markers on the lever display
- Turbine whine and afterburner roar
- Engine, afterburner and fuel tuning groups
- Results show pods that are out and why

### Changed
- Levers move much faster (lag now comes from the engines)
- Boost is now the afterburner, with its own heat and fuel cost
- Engines run on the grid during the countdown while pods are held
- Flameouts now spool the engine down, then it relights and spools back up
- AI budgets afterburner use against fuel left and race distance, and steers with damping and a dead zone
- Tuning storage key changed to v2, so earlier saved tuning is ignored

## [0.1.1] - 2026-11-24

Replaces the control schemes with lever control, closer to how a real pod is flown.

### Added
- Persistent thrust levers: keys move each lever and it stays put
- Linked levers scheme (default): shared throttle, steering pulls the inside lever back
- Manual levers scheme: each lever moved on its own
- Space for both levers full, X to cut both levers
- Lever display on the HUD (white forward, blue reverse)
- Turn drag, so a turning pod loses speed beyond the lost thrust
- Lever tuning: lever speed, split speed, return speed, split depth
- Setting levers on the grid during the countdown

### Changed
- Steering only ever reduces thrust and has no direct steering assist
- AI now drives through the same levers at the same rates as the player
- Boost moved to Shift only (Space now sets both levers to full)

### Removed
- Simple and twin-engine (held key) schemes, and their tuning settings

## [0.1.0] - 2026-11-24

First playable prototype, built to test how driving feels.

### Added
- Three.js scene: canyon track with banded sandstone walls and rims, desert mesas for depth, rock pillars on the track, start gantry and chequered line
- Flat 2D twin-engine physics: thrust per engine, turning from thrust difference, sideways grip, drag
- Simple and twin-engine control schemes (switch with M)
- North-up and chase cameras (switch with C)
- Per-engine heat with boost, flameouts and HUD heat bars
- Cosmetic wrecks above an impact speed threshold: pieces fly apart, land with dust and scorch marks, then the pod respawns
- Pod-to-pod bumping, wall scrapes with sparks
- Visual-only hover, bob, banking, pitch and cockpit swing
- Dust trails, boost exhaust, overheat smoke
- Three AI opponents with lane offsets, braking for bends, rock avoidance and boost decisions
- 3-lap race with countdown, lap and best-lap timing, positions, minimap and results screen
- Live tuning panel with saving, JSON export and reset
- Synthesised engine sound and impact sounds
- `?autodrive` option and `__dev` console hook for testing
