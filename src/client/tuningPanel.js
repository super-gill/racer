/**
 * Tuning panel (T). Built automatically from TUNING_META. Changes apply live to every pod
 * and are saved in this browser.
 */
import { TUNING_META, tuning, applyTuning, resetTuning } from '../shared/tuning.js';
import { toast } from './hud.js';

const TUNING_STORAGE_KEY = 'pod-proto.tuning.v2';
const $ = (id) => document.getElementById(id);

/** Loads tuning saved in this browser, if any. */
export function loadSavedTuning() {
  try { applyTuning(JSON.parse(localStorage.getItem(TUNING_STORAGE_KEY) || '{}')); } catch { /* storage unavailable */ }
}

function saveTuning() {
  try { localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(tuning)); } catch { /* storage unavailable */ }
}

export function buildTuningPanel() {
  const panel = $('tuning');
  panel.innerHTML = '';
  let group = '';
  for (const [g, key, label, min, max, step] of TUNING_META) {
    if (g !== group) {
      group = g;
      const h = document.createElement('h3');
      h.textContent = g;
      panel.appendChild(h);
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`;
    const input = row.querySelector('input');
    const val = row.querySelector('.val');
    const decimals = Math.max(0, (String(step).split('.')[1] || '').length);
    input.value = tuning[key];
    val.textContent = Number(tuning[key]).toFixed(decimals);
    input.addEventListener('input', () => {
      tuning[key] = parseFloat(input.value);
      val.textContent = tuning[key].toFixed(decimals);
      saveTuning();
    });
    input.addEventListener('change', () => input.blur());   // hand the keyboard back to the game
    panel.appendChild(row);
  }
  const copy = document.createElement('button');
  copy.textContent = 'Copy JSON';
  copy.onclick = async () => {
    const json = JSON.stringify(tuning, null, 2);
    try { await navigator.clipboard.writeText(json); toast('Tuning copied'); }
    catch { console.log(json); toast('Clipboard blocked, tuning logged to console'); }
    copy.blur();
  };
  const reset = document.createElement('button');
  reset.textContent = 'Reset defaults';
  reset.onclick = () => { resetTuning(); saveTuning(); buildTuningPanel(); toast('Tuning reset'); };
  panel.append(copy, reset);
}
