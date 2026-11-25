/**
 * Headless simulation test. Runs a full race with no browser and no graphics, the same way the
 * Node host will. Fails (exit code 1) if pods don't finish or errors are thrown.
 *
 *   npm test
 */
import { FIXED_DT, LAPS } from '../src/shared/config.js';
import { setupRace, simStep, pods, race, standings } from '../src/shared/race.js';
import { drainEvents } from '../src/shared/events.js';
import { formatTime } from '../src/shared/utils.js';

const [you] = setupRace();
you.autodrive = true;                          // let the AI drive the human pod too

const counts = {};
const limit = 400;                             // seconds of race time
for (let t = 0; t < limit && pods.some((p) => p.active); t += FIXED_DT) {
  simStep(FIXED_DT);
  for (const e of drainEvents()) counts[e.type] = (counts[e.type] || 0) + 1;
}

console.log(`Race time ${formatTime(race.time)}, phase ${race.phase}`);
for (const pod of standings()) {
  const laps = pod.lapTimes.map(formatTime).join('  ');
  console.log(`${pod.name.padEnd(12)} ${pod.finished ? 'finished' : pod.dnf ?? 'running'}  laps ${laps}  wrecks ${pod.crashCount}  fuel ${pod.fuel.toFixed(0)}%`);
}
console.log('Events:', counts);

const unfinished = pods.filter((p) => !p.finished);
if (unfinished.length) {
  console.error(`FAIL: ${unfinished.map((p) => p.name).join(', ')} did not finish ${LAPS} laps`);
  process.exit(1);
}
console.log('PASS');
