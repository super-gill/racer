/**
 * Audio. A synthesised engine drone, turbine whine, afterburner roar and impact thumps.
 * No sound files. Browsers only allow audio after a key press, so it starts on the first key.
 */

export const audio = {
  ctx: null,
  muted: false,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 500;
      this.filter.connect(this.master);
      this.oscA = ctx.createOscillator();
      this.oscA.type = 'sawtooth';
      this.oscB = ctx.createOscillator();
      this.oscB.type = 'square';
      const bGain = ctx.createGain();
      bGain.gain.value = 0.35;
      this.oscA.connect(this.filter);
      this.oscB.connect(bGain).connect(this.filter);
      this.oscA.start();
      this.oscB.start();
      // Turbine whine rises with revs.
      this.whine = ctx.createOscillator();
      this.whine.type = 'sine';
      this.whineGain = ctx.createGain();
      this.whineGain.gain.value = 0;
      this.whine.connect(this.whineGain).connect(ctx.destination);
      this.whine.start();
      // Afterburner roar: looped noise through a low band-pass.
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const roar = ctx.createBufferSource();
      roar.buffer = noise;
      roar.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 260;
      band.Q.value = 0.7;
      this.roarGain = ctx.createGain();
      this.roarGain.gain.value = 0;
      roar.connect(band).connect(this.roarGain).connect(ctx.destination);
      roar.start();
    } catch {
      this.ctx = null;
    }
  },
  /** pod: the pod being listened to. silentWanted: true when paused, on the title screen, etc. */
  update(pod, silentWanted) {
    if (!this.ctx || !pod) return;
    const t = this.ctx.currentTime;
    const { engineL, engineR } = pod.components;
    const thrust = (Math.abs(engineL.thrust) + Math.abs(engineR.thrust)) / 2;
    const afterburner = (engineL.afterburner + engineR.afterburner) / 2;
    const boosting = afterburner > 0.3;
    const spool = (engineL.spool + engineR.spool) / 2;
    const pitch = 45 + pod.speed * 0.9 + thrust * 18;
    this.oscA.frequency.setTargetAtTime(pitch, t, 0.08);
    this.oscB.frequency.setTargetAtTime(pitch * 1.503, t, 0.08);
    this.filter.frequency.setTargetAtTime(280 + thrust * 900 + (boosting ? 1400 : 0) + pod.speed * 6, t, 0.1);
    const silent = this.muted || silentWanted || pod.state !== 'racing';
    this.master.gain.setTargetAtTime(silent ? 0 : 0.03 + thrust * 0.045, t, 0.1);
    this.whine.frequency.setTargetAtTime(300 + spool * 1500, t, 0.05);
    this.whineGain.gain.setTargetAtTime(silent ? 0 : 0.012 * spool, t, 0.1);
    this.roarGain.gain.setTargetAtTime(silent ? 0 : 0.12 * afterburner, t, 0.08);
  },
  bang(strength) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0.5 * strength;
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start();
  },
};
