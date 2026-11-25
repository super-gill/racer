# Working Title: Pod Racer Prototype

**Version:** 0.1.4 (prototype)
**Status:** Driving feel test. Not feature complete.
**Name:** "Working Title" is a placeholder. Change `GAME_TITLE` in `src/shared/config.js` once a name is chosen.

---

## 1. Purpose

v0.1.x answers one question: **is driving a twin-engine pod fun on a keyboard?**

Everything else on the roadmap (parts, hulls, race types, tournaments, sponsors, career) depends on the answer. This build has only what's needed to judge the handling: one track, three AI opponents, two lever-based control schemes, afterburning jet engines with heat and fuel, two cameras, crashes and a live tuning panel.

## 2. Requirements

| Item | Requirement |
|---|---|
| Host machine | Node.js 18 or later (current LTS recommended) |
| Players | Current Chrome, Edge or Firefox with WebGL 2. Nothing to install |
| Network | None once installed. `npm install` needs internet access once to fetch Three.js |
| Input | Keyboard |

## 3. Running

### 3.1 First time
1. Install Node.js LTS from nodejs.org.
2. Unzip the project folder anywhere.
3. Open a terminal in the folder and run `npm install`. This downloads Three.js 0.160.0 into `node_modules` (about 30 MB).

### 3.2 Every time
1. In the project folder, run `npm start`.
2. The host prints its addresses:
   ```
   Pod racer host running.
     This machine:   http://localhost:8080/
     Other machines: http://192.168.1.23:8080/
     Pod Workshop:   /workshop.html
   ```
3. Open the address in a browser and press **Enter** to race. The Pod Workshop is at `/workshop.html`.
4. Press **Ctrl+C** in the terminal to stop the host.

To use another port: `PORT=9000 npm start` (macOS / Linux) or `$env:PORT=9000; npm start` (Windows PowerShell).

**Autodrive:** add `?autodrive` to the address (`http://localhost:8080/?autodrive`) to let the AI drive your pod. Useful for watching the AI or checking visuals while you tune.

**Opening `index.html` directly no longer works.** The code is now split into modules, and browsers only load those from a web server.

### 3.3 Other machines on the network
Other machines can already load the game and workshop from the "Other machines" address. **Each browser still runs its own single-player race for now.** Shared LAN races come in a later version (see section 9). If the address doesn't load from another machine, check:
- **Firewall on the host:** allow Node.js, or the port (8080 by default), for inbound connections on private networks. Windows usually asks the first time you run `npm start`.
- **Client isolation:** many office and guest Wi-Fi networks block devices from reaching each other. A wired connection or a different network segment may be needed.
- **Policy:** check with whoever owns the network before running a host on it.

### 3.4 Tests
`npm test` runs a full 3-lap race headless in Node, with no browser and no graphics, and fails if any pod doesn't finish. This is the same simulation code the browser runs.

## 4. Controls

The pod is flown the way a real pod is: with **two thrust levers, one per afterburning jet engine**. Hover and stabilisation are automatic. The keys **move** the levers, and the levers **stay where you leave them**, like real throttle levers. Each lever runs from full reverse (-1) through idle (0) to full forward (+1).

The levers move almost instantly. The **engine** provides the lag: it takes a moment to spool up to what the lever asks for (see section 5).

The HUD's "Lever / output" panel shows both levers (white forward, blue reverse) and a red marker for what each engine is **actually** giving. The marker trails the lever while the engine spools.

Turning comes only from the engines: run the left engine harder to turn right, and the right engine harder to turn left. Turning always costs speed in two ways:
1. **Lost thrust.** Steering pulls an engine back and never pushes one harder.
2. **Turn drag.** A rotating pod isn't aerodynamic, so it gets extra drag while turning.

A pod going flat out in a straight line is always faster than a turning one.

### 4.1 Linked levers (default)

| Key | Action |
|---|---|
| W / Up | Push both levers forward. They stay there when released |
| S / Down | Pull both levers back, past zero into reverse |
| A, D / Left, Right | Turn. While held, the inside lever is pulled back. On release, the levers ease back into line |
| Space | Both levers to full instantly |
| X | Cut both levers to zero |
| Shift | Afterburner (see section 5.3) |
| Backspace | Recover to the track if you're stuck |

Easy to pick up, and it behaves like levers. At full throttle a hard turn takes the inside engine slightly into reverse, which tightens the turn but costs a lot of speed.

### 4.2 Manual levers

| Key | Action |
|---|---|
| W / S | Left lever forward / back |
| Up / Down | Right lever forward / back |
| Space | Both levers to full instantly |
| X | Cut both levers to zero |
| Shift | Afterburner |
| Backspace | Recover to the track |

Full control of each engine. Set a cruising thrust, then nudge one lever down to turn and back up to straighten. You have to remember where your levers are, so watch the lever display.

**On the grid:** the engines run during the countdown but the pod is held. Spool up before "Go".

### 4.3 Other keys

| Key | Action |
|---|---|
| Backspace | Recover to the track (3 s cooldown) |
| M | Switch between linked and manual levers |
| C | Switch camera: north-up or chase |
| T | Show or hide the tuning panel |
| H | Help |
| P / Esc | Pause |
| N | Mute |
| R | Restart race |
| Enter | Start race / race again from results |

## 5. Gameplay rules in this build

### 5.1 Race
- 3 laps against 3 AI pods. You start at the back of a two-by-two grid.
- **Laps** count when you cross the chequered line under the gantry going forwards. Driving backwards over the line doesn't count.

### 5.2 Engines: afterburning low-bypass jets
- **Spool:** revs chase the lever. They climb slowly from idle and faster near the top, and fall faster than they rise. Thrust climbs steeply with revs, so the last part of the spool matters most.
- **Idle thrust:** a running jet always pushes a little. With both levers at idle the pod keeps creeping forward. You can't fully stop except by crashing. Shutting the engines down is planned for later.
- **Thrust reversers (brakes):** pulling a lever below idle deploys that engine's reverser buckets after a short delay. The engine then pushes backwards at reduced power (40% by default). Reversing one engine while the other drives forward spins the pod tightly.
- **Turning** comes only from the engines, so it lags with the spool. Pulling the inside engine back takes effect as it spools down.

### 5.3 Afterburner
- Hold **Shift**. An engine lights its afterburner only when its lever is at full, its revs are at the top (95%+) and its reverser is stowed. It takes 0.3 s to light fully.
- In linked mode, steering pulls the inside lever off full, so the inside engine's afterburner goes out while you turn.
- With the afterburner lit, thrust is 1.45x, heat builds 3.2x as fast, and fuel burn is much higher.

### 5.4 Heat
- Revs warm each engine and the afterburner heats it fast. At full dry revs with default settings, an engine never overheats.
- At full heat the engine **flames out**. It loses thrust, spools down, and relights after 1.5 s, then has to spool back up. The pod pulls towards the dead engine.
- Heat is the **short-term** limit on afterburner use: how long you can hold it right now.

### 5.5 Fuel
- Both engines burn from one tank: a little at idle, more with revs, a lot on afterburner.
- **Fuel is weight.** A full tank makes the pod 25% heavier by default, so it accelerates and turns more slowly. The pod gets lighter as fuel burns. Top speed isn't affected.
- Fuel is the **race-long** budget: how much afterburner you can afford across the whole race.
- **Running dry** shuts everything down and you're out of the race (shown as "Out: Out of fuel"). Above 15 sim units per second (about 105 km/h) the pod drops and wrecks. Below that it settles to the ground and slides to a stop.
- Fuel is deliberately generous in this build: about half a tank is left after 3 laps of normal driving. Proper balancing comes in v0.2.

### 5.6 Crashes and recovery
- **Wrecks:** hitting a wall or rock with an impact speed (the part of your velocity going into the surface) above the wreck threshold destroys the pod. The pieces fly apart, land and leave scorch marks. After 2.4 s you respawn on the centreline with the engines at idle. You flicker for 1.2 s, with no pod collisions during that time. Fuel isn't refilled.
- **Scrapes:** lighter impacts bounce you off with sparks and a little speed loss.
- **Pod contact:** pods bump each other. Pod contact never wrecks in this build.
- **Recover (Backspace):** puts you back on the centreline at your current position, stationary, with engine heat and revs kept. 3 s cooldown.

## 6. Tuning panel

Press **T**. Every slider applies immediately to **all pods**, including the AI. Values are saved in the browser and reload next time. Use **Copy JSON** to export the current set (for example to paste into a chat), and **Reset defaults** to go back.

| Group | Setting | Default | Effect |
|---|---|---|---|
| Engines | Dry thrust per engine | 30 | Thrust at full revs without afterburner |
| Engines | Idle thrust | 0.06 | Thrust at idle as a fraction of full. Sets how much the pod creeps |
| Engines | Spool up speed | 2.4 | How fast revs climb. Lower = heavier, laggier feel |
| Engines | Spool down speed | 4 | How fast revs fall. Also sets how quickly steering bites |
| Engines | Reverser power | 0.40 | Reverse thrust as a fraction of forward |
| Engines | Reverser speed | 2.5 | How fast the buckets deploy and stow (2.5 = 0.4 s) |
| Afterburner | Afterburner multiplier | 1.45 | Thrust with the afterburner lit |
| Afterburner | Light-up seconds | 0.3 | Delay to fully light |
| Handling | Turn from thrust split | 14 | Turning per unit of engine imbalance |
| Handling | Spin damping | 4.0 | How fast rotation settles. Low = twitchy and spinny |
| Handling | Sideways grip | 3.5 | Low = drifty hover feel, high = on rails |
| Handling | Drag (linear) | 0.25 | Low-speed drag |
| Handling | Drag (speed) | 0.004 | High-speed drag. Mostly sets top speed |
| Handling | Turn drag | 0.06 | Extra drag per unit of rotation speed. How much a corner costs |
| Levers | Lever speed | 8 | How fast keys move a lever. Kept fast so the spool provides the lag |
| Levers | Linked: split speed | 12 | How fast steering pulls the inside lever back |
| Levers | Linked: return speed | 14 | How fast the levers come back into line after steering |
| Levers | Linked: split depth | 1.2 | How far full steering pulls the inside lever. Above 1 lets it reach the reverser at full throttle |
| Heat | Heat at full dry revs | 0.10 | Heat gained per second at full revs |
| Heat | Afterburner heat multiple | 3.2 | Heat with afterburner lit, as a multiple of full dry |
| Heat | Cooling | 0.14 | Heat lost per second |
| Heat | Relight seconds | 1.5 | Dead time after a flameout |
| Fuel | Starting fuel % | 100 | Tank level at the start. Takes effect on restart |
| Fuel | Burn at idle | 0.02 | Fuel per second per engine at idle (tank = 100) |
| Fuel | Burn at full dry | 0.16 | Extra fuel per second per engine at full revs |
| Fuel | Burn on afterburner | 0.5 | Extra fuel per second per engine with afterburner lit |
| Fuel | Full tank weight | 0.25 | Extra mass of a full tank (0.25 = 25% heavier) |
| Fuel | Dry tank wreck speed | 15 | Running dry above this speed wrecks the pod |
| Crashes | Wreck impact speed | 45 | Impact speed that wrecks the pod |
| Crashes | Wall bounce | 0.35 | How springy walls are |
| Visual | Hover height, bob, bank | 1.6 / 0.25 / 0.12 | Cosmetic only |
| Camera | Camera height, zoom with speed | 70 / 0.25 | View distance |

Tuning saved by v0.1.0 or v0.1.1 is ignored, because the engine settings changed (the storage key is now `pod-proto.tuning.v2`).

Top speed at defaults is about 95 sim units per second (shown as about 665 km/h), or about 119 (830 km/h) on afterburner.

**Suggested test order:** spool up and spool down speed first (they decide how heavy the pod feels and how quickly steering bites), then sideways grip and spin damping, then turn gain and split depth, then turn drag, afterburner and heat. Leave fuel until last.

## 7. Technical overview

### 7.1 Stack
- **Host:** a small Node.js web server (`server/server.js`) with no dependencies beyond Node itself. It serves files read-only from four folders and only answers GET and HEAD.
- **Client:** plain JavaScript modules in the browser, with Three.js 0.160.0 for rendering only. There's no build step: the browser loads the modules as they are.
- **No external assets:** all textures and sounds are generated in code.

### 7.2 Design decisions

| Decision | Reason |
|---|---|
| Physics is flat 2D, rendering is 3D | Handling stays simple to read and tune, while the camera gets real depth, parallax and shadows |
| Height is visual only | Bob, bank, cockpit swing and pitch never affect the simulation. Agreed for v0.1 |
| Fixed 120 Hz physics step | Handling feels the same at any frame rate |
| Keys move persistent levers instead of being the throttle | A held key is all-or-nothing. A lever that stays put gives the analogue feel of real throttle levers |
| Steering only ever reduces thrust | Turning has to cost speed. A flat-out straight-line pod is always fastest |
| Turn drag added on top | Represents a rotating pod not being aerodynamic. Tunable separately |
| AI uses the same lever class and rates | No reaction-time advantage over the player |
| Fast levers, lag from engine spool | Two layers of delay would feel mushy. The lag belongs to the engine, as on a real jet |
| Reverser below idle instead of a separate brake | Jets can't run backwards. Reversers give braking and the tight spin turn |
| Heat and fuel both limit the afterburner, on different time scales | Heat is the short-term limit (how long right now). Fuel is the race-long budget |
| Fuel affects mass, not drag | A full tank is slower to accelerate and turn but has the same top speed |
| Running dry is out of the race | A hard, clear consequence. Pit stops can be a race-type option later |
| Simulation in `src/shared`, with no graphics, DOM or sound | The same race code runs in the browser now and on the Node host for LAN play later. It's also testable headless (`npm test`) |
| Simulation reports what happened as events | Crashes, laps and impacts are recorded as events. The client turns them into effects, sound and messages. Over the network, events are what the host will send |
| Humans drive with raw input | The simulation takes each human's keys (throttle, steer, levers, boost) and moves their levers itself. Over the network, raw input is what players will send |
| Three.js served from `node_modules` | No CDN, so it works offline and on networks that block CDNs |
| No web framework on the host | Fewer dependencies to install and audit. It only serves files for now |
| AI uses the same physics as the player | No cheating, and tuning changes affect everyone equally |
| Components already have `integrity` | A damage model can be added in v0.2 without reworking pods. Engine thrust already scales with integrity |

### 7.3 Project layout

```
pod-racer/
  package.json            scripts: npm start, npm test
  server/server.js        Node host: serves the game to the network
  public/                 pages and styles
    index.html            the game
    workshop.html         the Pod Workshop
    css/game.css, css/workshop.css, favicon.svg
  src/shared/             simulation: runs in the browser and in Node, no graphics
    config.js             fixed constants: laps, track layout, AI drivers, grid
    tuning.js             live tuning values and the tuning panel's list
    utils.js              maths and time formatting
    track.js              centreline samples, nearest-point queries, rocks
    levers.js             thrust levers, linked and manual modes, human input
    pod.js                pod state: engines, fuel, wreck, respawn, recover
    physics.js            jet engine model, movement, mass, collisions
    ai.js                 AI drivers
    race.js               field setup, countdown, fixed sim step, laps, standings
    events.js             what happened this step, for the client to react to
    podPresets.js         Pod Workshop preset specs (data only)
  src/client/             browser only
    main.js               entry point: loop, keys, events to effects and messages
    scene.js              renderer, lights, world (ground, track, walls, mesas, gantry)
    effects.js            particles and scorch marks
    podView.js            draws a pod from its state, including wreck debris
    camera.js             north-up and chase cameras
    hud.js                HUD, warnings, minimap, results
    tuningPanel.js        tuning panel (T), saved in the browser
    audio.js              synthesised engine, whine, afterburner, impacts
    input.js              keyboard to raw input
    podFactory.js         builds workshop pods from a spec
    workshop.js           the Pod Workshop page
  tests/sim.test.js       headless race test
```

The host maps web addresses to folders: `/` to `public/`, `/shared/` to `src/shared/`, `/client/` to `src/client/` and `/vendor/three/` to `node_modules/three/`.

### 7.4 Coordinates

- The sim uses `(x, y)` on the ground. `y` maps to the world `z` axis in Three.js.
- Heading 0 points along +x. Positive angular velocity turns **right** (clockwise seen from above).
- Pod local space: +X forward, +Z right, +Y up.

### 7.5 Changing the track

Edit `CONTROL_POINTS` in `src/shared/config.js` (x, z pairs forming a closed loop). Keep corners gentle (roughly 60 units radius or more) and keep separate parts of the track at least about 110 units apart, or the canyon rims will overlap visually. Obstacles are placed by fraction of the lap in `OBSTACLE_LAYOUT` in the same file.

### 7.6 Developer hook

The browser console has `__dev`:

- `__dev.fastForward(seconds)`: runs the simulation without rendering. Use it to test the AI over many laps. For a full headless run, use `npm test` instead.
- `__dev.pods`, `__dev.race`, `__dev.track`: live state.

## 8. Known limitations

- No shared LAN races yet. Every browser runs its own race (see section 3.3).
- One track, no menus, no saving except tuning.
- Damage is not modelled: wrecks are all-or-nothing, and pod contact never wrecks.
- The AI is basic. It follows lanes off the centreline instead of a true racing line, and it doesn't fight for position.
- Collision shapes are two circles per pod, so very glancing contacts can look slightly off.
- Tight corners may show small overlaps in the canyon rim mesh.
- The audio is a placeholder.
- The current track is twisty, so there are few places long enough to make full use of the afterburner.
- No engine shutdown. The only way to stop is to crash or run dry.

## 9. Roadmap

| Version | Focus |
|---|---|
| 0.1.x | Tune handling and lever feel until they're right. Pick the default scheme and camera. Optional gamepad (triggers as levers) |
| 0.2 | LAN races: the race runs on the host, players join from their browsers over WebSockets, a lobby to pick pods and ready up, empty slots filled with AI |
| 0.3 | Damage model (component integrity, damage from walls, pods, rocks and overstress), fuel balancing, engine shutdown and restart, more ground marks |
| 0.1.4 | Project split into shared simulation and browser client, served by a Node host. Done |
| 0.1.5 | Move the Pod Factory into the game. AI pods use the presets, the player uses a workshop design |
| 0.4 | Parts and hulls changing stats, including a stabiliser part that sets how forgiving the pod is |
| 0.5 | Race types and results flow |
| 0.6 | Tournaments, special events, saving |
| 0.7 | Career and sponsorships (single player) |
| 1.0 | First full release |

## 10. Pod Workshop (`/workshop.html`)

### 10.1 Purpose
A standalone page for designing how pods look before the new models go into the game. It tests the art direction and the parts system. The game itself still uses the v0.1 placeholder pods.

### 10.2 Art direction
**Salvaged military jet engines, hot-rodded by their crews.** This explains why the pods run low-bypass afterburning jets: surplus fighter engines. It also brings hot-rod culture into the look: flame paint, racing numbers, chrome intakes, exposed afterburner nozzles, riveted panels and wear. It's a deliberate move away from the sleek alien pods of the films.

### 10.3 Running
Start the host (`npm start`) and open `/workshop.html` on its address, for example `http://localhost:8080/workshop.html`.

| Control | Action |
|---|---|
| Preset | Load one of the four example pods |
| Randomise | Random parts and paint |
| Copy JSON / Paste JSON | Export or import a pod spec through the clipboard |
| Close-up | Turntable view. Drag to orbit, scroll to zoom |
| Race view | The game's camera height (70 units), with the other presets in formation, to judge readability at race distance |
| Afterburner | Toggle afterburner plumes |
| Auto-rotate | Toggle the turntable spin |

### 10.4 Pod spec
A pod is described entirely by a spec object. Every visual difference comes from these values, so the same spec can carry gameplay stats later.

| Group | Field | Range / options | Meaning |
|---|---|---|---|
| engine | length | 3.5 to 7 | Engine length |
| engine | bodyRadius | 0.4 to 0.9 | Main body radius |
| engine | intakeRadius | 0.4 to 1.1 | Intake mouth radius |
| engine | bulge | 0 to 0.35 | Compressor bulge |
| engine | nozzle | afterburner, plain | Afterburner nozzles have iris petals |
| engine | nozzleLength | 0.5 to 1.6 | Length of the tapered nozzle section |
| engine | spacing | 1.4 to 2.8 | Distance of each engine from the centre line |
| fins | layout | none, vertical, outboard, both | Outboard fins are horizontal and show clearly from above |
| fins | shape | swept, delta, square | Fin outline |
| fins | size | 0.5 to 1.6 | Fin scale |
| cockpit | shape | teardrop, needle, tub | Hull profile |
| cockpit | length, width | 2.4 to 4.6, 0.7 to 1.4 | Hull size |
| cockpit | distance | 5.5 to 9 | Engine centre to cockpit centre |
| links | tether | cables, struts | Struts are thicker, with chrome joints |
| links | coupling | cable, bar, none | Link between the engines |
| livery | base, accent, trim | Colours | Paint colours |
| livery | pattern | plain, flames, stripes, checker, split | Paint scheme |
| livery | number | 0 to 99 | Racing number, shown in a roundel on top of each engine and the cockpit |
| livery | font | race, stencil | Number style |
| livery | metal | 0 to 1 | Paint from flat to metallic |
| livery | wear | 0 to 1 | Chipped paint, scratches, soot and dust |

### 10.5 How the models are built
- **Engines and cockpits** are lathes: a side-on profile spun around the long axis. The profile sets the nozzle, body, compressor bulge and intake lip.
- **Fins** are 2D outlines given thickness.
- **Paint** is drawn on a canvas per part, as if the part were unrolled. The canvas width runs around the part (the top of the part is at 75% across) and the height runs front (top) to back. Markings are scaled by the part's real circumference and length so numbers and roundels stay in proportion.
- **Links** are anchored to points on each part. `updateLinks()` keeps them attached while the parts bob independently.
- **Reflections** come from a generated room environment map, which makes chrome and metal read properly.
- `PodFactory` (`src/client/podFactory.js`) is ready for the game to use. `buildPod(spec)` returns the pod group plus handles for engines, flames, the cockpit, `updateLinks()` and `dispose()`.

### 10.6 Known limitations
- Nozzle type and every other part are visual only. No gameplay stats are attached yet.
- At race distance, numbers and fine markings can't be read. Outline, colour, fins and flames carry the identity.
- Fins are placed by formula, so extreme slider combinations can look odd.
- The game doesn't use the Pod Factory yet. That's v0.1.5.

## 11. Version history

See `CHANGELOG.md`.
