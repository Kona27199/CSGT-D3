'use strict';
/* Âm thanh 8-bit tạo bằng WebAudio — không cần file âm thanh, chạy offline */
const AUDIO = {
  ctx: null,
  init() {
    if (AUDIO.ctx) return;
    try { AUDIO.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AUDIO.ctx = null; }
  },
  tone(freq, dur, type, vol, when, slideTo) {
    if (!SAVE.data.sound || !AUDIO.ctx) return;
    const c = AUDIO.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  whistle() {
    if (!SAVE.data.sound || !AUDIO.ctx) return;
    const c = AUDIO.ctx, t = c.currentTime;
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2600;
    lfo.frequency.value = 38; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.setValueAtTime(0.12, t + 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
    g.gain.linearRampToValueAtTime(0.12, t + 0.35);
    g.gain.setValueAtTime(0.12, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(g); g.connect(c.destination);
    o.start(t); lfo.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9);
  },
  click() { AUDIO.tone(880, 0.05, 'square', 0.04); },
  good() { AUDIO.tone(660, 0.1, 'square', 0.06); AUDIO.tone(990, 0.15, 'square', 0.06, 0.1); },
  bad() { AUDIO.tone(220, 0.25, 'sawtooth', 0.06, 0, 110); },
  beep() { AUDIO.tone(1400, 0.08, 'square', 0.05); AUDIO.tone(1400, 0.08, 'square', 0.05, 0.15); },
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => AUDIO.tone(f, 0.18, 'square', 0.06, i * 0.13));
  },
  siren() {
    AUDIO.tone(700, 0.4, 'triangle', 0.05, 0, 1000);
    AUDIO.tone(1000, 0.4, 'triangle', 0.05, 0.4, 700);
  }
};
