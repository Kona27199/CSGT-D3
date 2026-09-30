'use strict';
/* Tiện ích chung: RNG có seed, chọn ngẫu nhiên, định dạng tiền, lưu game */
const U = {
  /* mulberry32 — cùng seed cho cùng chuỗi ngẫu nhiên (dùng cho "Thử thách hôm nay") */
  rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  rand: Math.random,
  setSeed(seed) { U.rand = U.rng(seed); },
  range(a, b) { return a + U.rand() * (b - a); },
  int(a, b) { return Math.floor(a + U.rand() * (b - a + 1)); },
  chance(p) { return U.rand() < p; },
  pick(arr) { return arr[Math.floor(U.rand() * arr.length)]; },
  weighted(obj) {
    let total = 0;
    for (const k in obj) total += obj[k];
    let r = U.rand() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  },
  shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  money(n) { return n.toLocaleString('vi-VN') + ' đ'; },
  pad(n, l) { return String(n).padStart(l || 2, '0'); },
  dateSeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  },
  esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
};

/* Lưu tiến trình trong localStorage (có try/catch để không lỗi khi trình duyệt chặn) */
const SAVE = {
  key: 'csgt_patrol_save_v1',
  data: { xp: 0, best: {}, stars: {}, sound: true, tutorialDone: false, tutorialDoneP: false, plays: 0, dailyBest: {}, mode: 'cp' },
  load() {
    try {
      const raw = localStorage.getItem(SAVE.key);
      if (raw) Object.assign(SAVE.data, JSON.parse(raw));
    } catch (e) { /* bỏ qua */ }
  },
  store() {
    try { localStorage.setItem(SAVE.key, JSON.stringify(SAVE.data)); } catch (e) { /* bỏ qua */ }
  },
  rank() {
    let r = DATA.RANKS[0], next = null;
    for (let i = 0; i < DATA.RANKS.length; i++) {
      if (SAVE.data.xp >= DATA.RANKS[i].xp) { r = DATA.RANKS[i]; next = DATA.RANKS[i + 1] || null; }
    }
    return { cur: r, next: next };
  },
  unlocked(id) {
    if (id === 1) return true;
    return (SAVE.data.stars[id - 1] || 0) >= 1;
  }
};
