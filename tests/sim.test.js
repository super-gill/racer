/**
 * Headless simulation test. Runs full races with no browser and no graphics, the same way the
 * Node host will. Fails (exit code 1) if any pod doesn't finish.
 *
 *   npm test
 *
 * Scenarios: 1 human with 5 AI (single player), and 4 humans with 2 AI (a full LAN race).
 * Humans are driven by the AI here (autodrive).
 */
import { FIXED_DT, LAPS } from '../src/shared/config.js';
import { setupRace, simStep, pods, race, standings } from '../src/shared/race.js';
import { drainEvents } from '../src/shared/events.js';
import { PRESETS } from '../src/shared/podPresets.js';
import { formatTime } from '../src/shared/utils.js';

function runRace(label, humans) {
  const humanPods = setupRace(humans);
  for (const pod of humanPods) pod.autodrive = true;
  const counts = {};
  for (let t = 0; t < 400 && pods.some((p) => p.active); t += FIXED_DT) {
    simStep(FIXED_DT);
    for (const e of drainEvents()) counts[e.type] = (counts[e.type] || 0) + 1;
  }
  console.log(`\n${label}: race time ${formatTime(race.time)}, phase ${race.phase}`);
  for (const pod of standings()) {
    const laps = pod.lapTimes.map(formatTime).join('  ');
    const who = pod.human ? 'human' : 'AI   ';
    console.log(`  ${who} ${pod.name.padEnd(14)} ${pod.finished ? 'finished' : pod.dnf ?? 'running'}  laps ${laps}  wrecks ${pod.crashCount}  fuel ${pod.fuel.toFixed(0)}%`);
  }
  console.log('  Events:', counts);
  return pods.filter((p) => !p.finished).map((p) => `${label}: ${p.name}`);
}

const failures = [
  ...runRace('1 human + 5 AI', [{ name: 'You', spec: PRESETS['Redline Special'] }]),
  ...runRace('4 humans + 2 AI', ['P1', 'P2', 'P3', 'P4'].map((name, i) => ({ name, spec: Object.values(PRESETS)[i] }))),
];

if (failures.length) {
  console.error(`\nFAIL: did not finish ${LAPS} laps: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nPASS');
