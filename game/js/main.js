'use strict';
/* Vòng lặp game, điều khiển, camera, ánh sáng, thời tiết, quản lý ca trực */
const G = {
  cv: null, g: null, dark: null, dg: null,
  view: { w: 384, h: 216 },
  cam: { x: 0, y: 0, w: 384, h: 216 },
  mode: 'menu',        // menu | play | pause | summary
  pauseWhy: null,
  shift: null, timeLeft: 0, score: 0, stats: null, log: [],
  target: null, pendingStop: null, actCool: 0,
  accident: null, accidentAt: null,
  keys: {}, stick: { x: 0, y: 0 }, act: false, pass: false, touch: false,
  cp: false, cpCur: null, cpTimer: 0, cpLane: null, cpHold: 0, cpShift: null,
  drops: [], last: 0,

  init() {
    SAVE.load();
    G.cv = UI.$('game');
    G.g = G.cv.getContext('2d');
    G.dark = document.createElement('canvas');
    G.dg = G.dark.getContext('2d');
    G.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (G.touch) document.body.classList.add('has-touch');
    G.resize();
    window.addEventListener('resize', G.resize);
    G.bindInput();
    UI.title();
    requestAnimationFrame(G.frame);
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  /* Độ phân giải logic: cạnh ngắn ~216 px, co giãn toàn màn hình */
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const scale = Math.max(1, Math.min(W, H) / 216);
    G.view.w = Math.min(560, Math.ceil(W / scale));
    G.view.h = Math.min(560, Math.ceil(H / scale));
    G.cv.width = G.view.w; G.cv.height = G.view.h;
    G.dark.width = G.view.w; G.dark.height = G.view.h;
    G.cam.w = G.view.w; G.cam.h = G.view.h;
    G.g.imageSmoothingEnabled = false;
  },

  /* ---------------- ĐIỀU KHIỂN ---------------- */
  bindInput() {
    window.addEventListener('keydown', e => {
      AUDIO.init();
      const k = e.key.toLowerCase();
      if (UI.isModal() && /^[1-4]$/.test(k)) {
        const bs = [...document.querySelectorAll('#modal .choices button:not([disabled])')];
        const b = bs[+k - 1];
        if (b) { b.click(); e.preventDefault(); }
        return;
      }
      if (UI.isModal() && (k === 'enter' || k === ' ')) {
        const el = document.activeElement;
        if (el && el.tagName === 'BUTTON') return;
        const b = document.querySelector('#modal .fb button, #modal .row-end .btn.primary:not([disabled])');
        if (b) { b.click(); e.preventDefault(); }
        return;
      }
      G.keys[k] = true;
      if ((k === ' ' || k === 'e' || k === 'j') && G.mode === 'play') { G.act = true; e.preventDefault(); }
      if ((k === 'c' || k === 'enter') && G.mode === 'play') { G.pass = true; e.preventDefault(); }
      if ((k === 'escape' || k === 'p') && G.mode === 'play' && !UI.isModal()) { G.pause('menu'); UI.pauseMenu(); }
      if (k.startsWith('arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
    /* cần điều khiển cảm ứng */
    const stick = UI.$('stick'), knob = UI.$('knob');
    let sid = null, cx = 0, cy = 0;
    const R = 40;
    stick.addEventListener('pointerdown', e => {
      AUDIO.init();
      sid = e.pointerId; stick.setPointerCapture(sid);
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = e => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      G.stick.x = dx / R; G.stick.y = dy / R;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    const end = e => { if (e.pointerId !== sid) return; sid = null; G.stick.x = 0; G.stick.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    UI.$('btnAct').addEventListener('pointerdown', e => { e.preventDefault(); AUDIO.init(); G.act = true; });
    UI.$('btnPause').addEventListener('pointerdown', e => { e.preventDefault(); if (G.mode === 'play' && !UI.isModal()) { G.pause('menu'); UI.pauseMenu(); } });
  },

  input() {
    const K = G.keys;
    let x = (K['arrowright'] || K['d'] ? 1 : 0) - (K['arrowleft'] || K['a'] ? 1 : 0);
    let y = (K['arrowdown'] || K['s'] ? 1 : 0) - (K['arrowup'] || K['w'] ? 1 : 0);
    if (Math.abs(G.stick.x) + Math.abs(G.stick.y) > 0.1) { x = G.stick.x; y = G.stick.y; }
    return { x: x, y: y };
  },

  /* ---------------- VÒNG ĐỜI CA TRỰC ---------------- */
  attract() {
    G.mode = 'menu';
    UI.closeModal();
    U.setSeed(12345);
    MAP.build('city');
    TRAFFIC.reset();
    G.shift = DATA.SHIFTS[1];
    G.prewarm(15);
    G.attractT = 0;
  },

  prewarm(sec) {
    const far = { x: -9999, y: -9999, w: 1, h: 1 };
    for (let t = 0; t < sec; t += 0.1) {
      TRAFFIC.updateLights(MAP.cur, 0.1);
      TRAFFIC.spawnAll(MAP.cur, G.shift, 0.1);
      TRAFFIC.update(MAP.cur, 0.1, far, () => {});
    }
  },

  start(shift, seed, mode) {
    UI.hideScreen();
    UI.closeModal();
    mode = mode || SAVE.data.mode || 'cp';
    if (!DATA.MODES[mode]) mode = mode === 'patrol' ? 'moto' : 'cp';
    G.modeUsed = mode;
    G.baseShift = shift;
    if (mode === 'car') shift = DATA.carPatrolShift(shift);
    else if (mode === 'moto') shift = Object.assign({}, shift, { scope: 'moto', short: shift.short + ' · Mô tô' });
    G.shift = shift;
    G.cp = mode === 'cp';
    U.setSeed(seed >>> 0);
    const m = MAP.build(shift.map);
    TRAFFIC.reset();
    if (G.cp) {
      /* chốt kiểm soát: làn ngoài cùng chiều Đông dành cho xe vào chốt */
      G.cpLane = m.lanes[3];
      G.cpLane.noSpawn = true;
      const spot = m.kind === 'highway' ? { x: 40 * TILE, y: 16 * TILE + 10 } : { x: 14 * TILE, y: 21 * TILE + 10 };
      m.cpSpot = spot;
      G.cpHold = spot.x + 14;
      /* tăng tỉ lệ vi phạm vì xe đến lần lượt */
      const p = Object.assign({}, shift.p);
      for (const k of ['helmet', 'passHelmet', 'carry2', 'phone', 'runRed', 'speed', 'alcohol']) p[k] = Math.min(0.6, (p[k] || 0) * 1.8);
      G.cpShift = Object.assign({}, shift, { p: p });
    }
    G.prewarm(20);
    for (const v of TRAFFIC.list) { v.ranRed = false; v.redWitnessed = false; }
    const vehSpawn = m.kind === 'highway' ? { x: 40 * TILE, y: 16 * TILE + 8 } : { x: 12 * TILE, y: 20 * TILE + 8 };
    PLAYER.reset(G.cp ? m.cpSpot : vehSpawn, G.cp ? null : mode);
    if (G.cp) PLAYER.face = 'left';
    G.cpCur = null; G.cpTimer = 0.6; G.pass = false;
    UI.$('touch').classList.toggle('cp', G.cp);
    G.timeLeft = shift.duration;
    G.score = 0; G.log = [];
    G.stats = { passOk: 0, stops: 0, correct: 0, missed: 0, wrong: 0, escaped: 0, procOk: 0, procBad: 0, bribeRefused: 0, fineMin: 0, fineMax: 0, accident: null };
    G.target = null; G.pendingStop = null; G.act = false; G.actCool = 0;
    G.accident = null;
    G.accidentAt = shift.accident ? shift.duration * U.range(0.4, 0.6) : null;
    G.drops = [];
    for (let i = 0; i < 140; i++) G.drops.push({ x: Math.random() * 600, y: Math.random() * 600, s: 180 + Math.random() * 120 });
    G.mode = 'play';
    G.pauseWhy = null;
    UI._cache = {};
    UI.hud(true);
    AUDIO.siren();
    const tkey = G.cp ? 'tutorialDone' : 'tut_' + mode;
    const tlines = G.cp ? DATA.TUTORIAL_CP : (mode === 'car' ? DATA.TUTORIAL_CAR : DATA.TUTORIAL_MOTO).concat(DATA.TUTORIAL.slice(1));
    if (shift.tutorial && !SAVE.data[tkey]) {
      G.pause('tutorial');
      UI.dialogSeq(DATA.CAPTAIN, tlines, () => { SAVE.data[tkey] = true; SAVE.store(); G.resume(); });
    } else {
      G.pause('intro');
      const intro = mode === 'car' ? DATA.TUTORIAL_CAR[0] + ' Thời gian: ' + shift.time + (shift.weather === 'rain' ? ', trời mưa.' : '.')
        : mode === 'moto' ? 'Tuần tra lưu động bằng mô tô. ' + shift.desc + ' Tập trung xử lý vi phạm của xe mô tô, xe máy.'
        : shift.desc + (shift.checkpoint ? ' Đây là chốt kiểm soát theo kế hoạch: đồng chí được dừng mọi phương tiện.' : '');
      UI.dialogSeq(DATA.CAPTAIN, [intro], () => G.resume());
    }
  },

  pause(why) { G.mode = 'pause'; G.pauseWhy = why; G.keys = {}; G.stick.x = G.stick.y = 0; UI.hint(null); },
  resume() { G.mode = 'play'; G.pauseWhy = null; G.act = false; G.last = performance.now(); },

  addScore(n) { G.score += n; },

  endShift(reason) {
    if (G.mode === 'summary') return;
    G.mode = 'summary';
    UI.closeModal();
    UI.hud(false);
    const sh = G.shift, failed = reason === 'bribe';
    const score = G.score;
    let stars = 0;
    if (!failed) for (const t of sh.stars) if (score >= t) stars++;
    const before = SAVE.rank().cur.name;
    SAVE.data.xp += Math.max(0, failed ? 0 : score);
    SAVE.data.plays++;
    let newBest = false;
    if (!failed) {
      if (sh.id === 'daily') {
        const d = U.dateSeed();
        if (SAVE.data.dailyBest[d] == null || score > SAVE.data.dailyBest[d]) { SAVE.data.dailyBest[d] = score; newBest = true; }
      } else {
        if (SAVE.data.best[sh.id] == null || score > SAVE.data.best[sh.id]) { SAVE.data.best[sh.id] = score; newBest = true; }
        SAVE.data.stars[sh.id] = Math.max(SAVE.data.stars[sh.id] || 0, stars);
      }
    }
    SAVE.store();
    const promoted = SAVE.rank().cur.name !== before;
    if (failed) AUDIO.bad(); else if (stars > 0) AUDIO.fanfare();
    let nextShift = null;
    if (typeof sh.id === 'number') {
      const n = DATA.SHIFTS.find(x => x.id === sh.id + 1);
      if (n && SAVE.unlocked(n.id)) nextShift = n;
    }
    UI.summary({ mode: G.modeUsed, shift: G.baseShift || sh, score: score, stars: stars, stats: G.stats, log: G.log, failed: failed, newBest: newBest, promoted: promoted, nextShift: nextShift });
  },

  /* ---------------- CHỐT KIỂM SOÁT ---------------- */
  vehicleDone(v) {
    if (G.cp && v === G.cpCur) { G.cpCur = null; G.cpTimer = 1.2; UI.cpPanel(null); }
  },

  cpSpawn() {
    const L = G.cpLane, sh = G.cpShift;
    const v = TRAFFIC.make(L, sh, Math.max(-30, G.cam.x - 30));
    /* máy đo tốc độ ghi nhận tốc độ hành trình tại điểm đo; hình ảnh xe vào chốt được tăng tốc cho nhịp chơi nhanh */
    if (G.shift.radar) v.measured = Math.round(v.cruiseKmh);
    v.boost = 2;
    v.speed = v.cruiseKmh * KPX * v.boost;
    v.holdAt = G.cpHold;
    v.cp = true;
    if (v.runRed) { v.ranRed = true; v.redWitnessed = true; }
    if (MAP.cur.kind === 'city' && v.veh === 'moto' && U.chance((sh.p.wrongway || 0) * 0.5)) v.wrongReport = true;
    TRAFFIC.list.push(v);
    G.cpCur = v;
  },

  cpPass(v, timeout) {
    UI.cpPanel(null);
    v.holdAt = null;
    v.boost = 1;
    v.state = 'drive';
    const signs = TRAFFIC.signs(v);
    let pts, msg;
    if (TRAFFIC.visibleViolations(v).length || (v.weave && v.alc > 0)) {
      pts = -10; G.stats.escaped++;
      msg = (timeout ? 'Hết thời gian! ' : '') + 'Bỏ lọt vi phạm: ' + signs.join(', ') + ' (−10)';
      AUDIO.bad();
    } else if (G.shift.checkpoint) {
      pts = -5;
      msg = 'Chốt kiểm tra nồng độ cồn theo kế hoạch: cần dừng xe kiểm tra (−5)';
      AUDIO.bad();
    } else {
      pts = 5; G.stats.passOk++;
      msg = '✔ Nhận định đúng: không có dấu hiệu vi phạm (+5)';
      AUDIO.good();
    }
    G.addScore(pts);
    G.log.push({ plate: v.plate, text: 'Cho qua' + (pts < 0 ? ' – sai' : ' – đúng'), pts: pts });
    UI.toast(msg, pts < 0 ? 'bad' : '');
    G.vehicleDone(v);
  },

  updateCp(dt) {
    if (!G.cpCur && !G.pendingStop) { G.cpTimer -= dt; if (G.cpTimer <= 0) G.cpSpawn(); }
    const v = G.cpCur;
    if (v && v.state === 'cpwait') {
      v.waitT += dt;
      const lim = G.shift.cpWait || 10;
      UI.cpPanel(v, Math.max(0, 1 - v.waitT / lim));
      UI.hint(G.touch ? null : '<b>SPACE</b>: dừng xe kiểm tra · <b>C</b>: cho qua');
      if (G.act) { UI.cpPanel(null); INSPECT.command(v); }
      else if (G.pass) G.cpPass(v, false);
      else if (v.waitT > lim) G.cpPass(v, true);
    } else {
      UI.cpPanel(null);
      UI.hint(G.pendingStop ? 'Phương tiện đang tấp vào lề...' : 'Phương tiện tiếp theo đang vào chốt...');
    }
    G.act = false; G.pass = false;
  },

  /* ---------------- TAI NẠN ---------------- */
  spawnAccident() {
    const m = MAP.cur, spot = m.accidentSpot, L = m.lanes[spot.lane];
    TRAFFIC.list = TRAFFIC.list.filter(v => !(v.lane === L && Math.abs(v.s - spot.s) < 50));
    const a = TRAFFIC.make(L, Object.assign({}, G.shift, { mix: { moto: 1 } }), spot.s + 6);
    const b = TRAFFIC.make(L, Object.assign({}, G.shift, { mix: { car: 1 } }), spot.s - 14);
    for (const v of [a, b]) { v.state = 'crash'; v.speed = 0; v.stopped = true; v.flee = false; }
    a.crashAngle = 0.6; b.crashAngle = -0.25; a.off = -3;
    TRAFFIC.pos(a); TRAFFIC.pos(b);
    TRAFFIC.list.push(a, b);
    G.accident = { vs: [a, b], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0 };
    AUDIO.siren();
    UI.toast('📻 Trung tâm chỉ huy: Có tai nạn giao thông! Đến hiện trường ngay!', 'bad');
  },
  clearAccident() {
    if (!G.accident) return;
    for (const v of G.accident.vs) v.dead = true;
    TRAFFIC.list = TRAFFIC.list.filter(v => !v.dead);
    G.accident = null;
  },

  /* ---------------- CẬP NHẬT ---------------- */
  update(dt) {
    const m = MAP.cur;
    if (G.mode === 'menu') {
      G.attractT += dt;
      G.cam.x = U.clamp(m.pw / 2 - G.cam.w / 2 + Math.sin(G.attractT * 0.08) * 280, 0, m.pw - G.cam.w);
      G.cam.y = U.clamp(17 * TILE - G.cam.h / 2 + Math.sin(G.attractT * 0.05) * 90, 0, Math.max(0, m.ph - G.cam.h));
      TRAFFIC.updateLights(m, dt); TRAFFIC.spawnAll(m, G.shift, dt); TRAFFIC.update(m, dt, G.cam, () => {});
      return;
    }
    if (G.mode !== 'play') return;
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) { G.timeLeft = 0; G.endShift('time'); return; }
    TRAFFIC.updateLights(m, dt);
    TRAFFIC.spawnAll(m, G.shift, dt);
    TRAFFIC.update(m, dt, G.cam, v => {
      if (!v.stopped && v.near && TRAFFIC.visibleViolations(v).length) {
        G.stats.escaped++; G.addScore(-5);
        UI.toast('Để lọt phương tiện vi phạm ' + v.plate + ' (−5)');
      }
      if (v === G.pendingStop) G.pendingStop = null;
      if (v === G.cpCur) G.vehicleDone(v);
    });
    if (G.cp) {
      const m2 = MAP.cur;
      G.cam.x = Math.round(U.clamp(PLAYER.x - G.cam.w * 0.3, 0, Math.max(0, m2.pw - G.cam.w)));
      G.cam.y = Math.round(U.clamp(PLAYER.y - G.cam.h * 0.5, 0, Math.max(0, m2.ph - G.cam.h)));
      if (G.accidentAt != null && G.timeLeft <= G.accidentAt && !G.pendingStop && (!G.cpCur || G.cpCur.state !== 'pullover')) {
        G.accidentAt = null;
        AUDIO.siren();
        UI.toast('📻 Trung tâm chỉ huy: Có tai nạn giao thông gần chốt! Tổ công tác đến hiện trường ngay!', 'bad');
        UI.cpPanel(null);
        INSPECT.accident();
        return;
      }
      if (G.pendingStop && G.pendingStop.state === 'stopped' && G.pendingStop.t - G.pendingStop.stoppedAt > 0.3) {
        const v = G.pendingStop; G.pendingStop = null;
        INSPECT.begin(v);
        return;
      }
      G.updateCp(dt);
      return;
    }
    const inp = G.input();
    PLAYER.update(dt, inp.x, inp.y);
    G.cam.x = Math.round(U.clamp(PLAYER.x - G.cam.w / 2, 0, Math.max(0, m.pw - G.cam.w)));
    G.cam.y = Math.round(U.clamp(PLAYER.y - G.cam.h / 2, 0, Math.max(0, m.ph - G.cam.h)));
    /* khóa mục tiêu */
    let best = null, bd = 72;
    for (const v of TRAFFIC.list) {
      if (v.state !== 'drive' || v.stopped) continue;
      const d = Math.hypot(v.x - PLAYER.x, v.y - PLAYER.y);
      if (d < 80 && !G.pendingStop) v.near = true;
      if (d < bd) { bd = d; best = v; }
    }
    if (G.target !== best) G.targetT = 0;
    G.target = best;
    G.targetT = (G.targetT || 0) + dt;
    if (best && G.shift.radar && G.targetT > 0.35) {
      const k = Math.round(best.speed / KPX);
      if (best.measured == null || k > best.measured) best.measured = k;
    }
    /* xe đã tấp vào lề -> bắt đầu kiểm tra */
    if (G.pendingStop && G.pendingStop.state === 'stopped' && G.pendingStop.t - G.pendingStop.stoppedAt > 0.3) {
      const v = G.pendingStop; G.pendingStop = null;
      INSPECT.begin(v);
      return;
    }
    /* tai nạn */
    if (G.accidentAt != null && !G.accident && G.timeLeft <= G.accidentAt) { G.accidentAt = null; G.spawnAccident(); }
    let nearAcc = false;
    if (G.accident) {
      G.accident.t += dt;
      nearAcc = Math.hypot(G.accident.x - PLAYER.x, G.accident.y - PLAYER.y) < 56;
      if (G.accident.t > 75) {
        G.addScore(-40); G.stats.accident = -40;
        G.log.push({ plate: 'Tai nạn', text: 'Không có mặt kịp thời', pts: -40 });
        UI.toast('Tổ công tác khác đã phải xử lý vụ tai nạn (−40)', 'bad');
        G.clearAccident();
      }
    }
    /* hành động */
    G.actCool -= dt;
    if (G.act) {
      G.act = false;
      if (nearAcc) { INSPECT.accident(); return; }
      if (G.pendingStop) UI.toast('Đang chờ phương tiện tấp vào lề...');
      else if (best && G.actCool <= 0) { G.actCool = 0.6; INSPECT.command(best); }
      else if (!best) UI.toast('Không có phương tiện trong tầm hiệu lệnh');
    }
    /* gợi ý */
    if (nearAcc) UI.hint('<b>SPACE</b> / DỪNG XE: xử lý hiện trường tai nạn');
    else if (G.pendingStop) UI.hint('Phương tiện đang tấp vào lề...');
    else if (best) UI.hint('<b>SPACE</b> / DỪNG XE: ra hiệu lệnh dừng ' + U.esc(best.plate));
    else if (G.accident) UI.hint('⚠ Đến hiện trường tai nạn (theo mũi tên đỏ)');
    else UI.hint(null);
    UI.$('btnAct').textContent = nearAcc ? 'XỬ LÝ' : 'DỪNG XE';
  },

  /* ---------------- VẼ ---------------- */
  render() {
    const g = G.g, m = MAP.cur, cam = G.cam;
    if (!m) return;
    g.fillStyle = '#1a1a1a';
    g.fillRect(0, 0, cam.w, cam.h);
    const sw = Math.min(cam.w, m.pw - cam.x), sh = Math.min(cam.h, m.ph - cam.y);
    g.drawImage(m.bg, cam.x, cam.y, sw, sh, 0, 0, sw, sh);
    MAP.drawLights(g, m, cam);
    TRAFFIC.draw(g, cam);
    if (G.accident) {
      const ax = Math.round(G.accident.x - cam.x), ay = Math.round(G.accident.y - cam.y);
      for (let i = 0; i < 5; i++) {
        const t = (G.accident.t * 0.8 + i * 0.2) % 1;
        g.fillStyle = 'rgba(90,90,90,' + (0.6 * (1 - t)) + ')';
        g.fillRect(ax - 2 + Math.sin(i * 3 + t * 4) * 3, ay - 6 - t * 18, 4, 4);
      }
      if (Math.floor(G.accident.t * 3) % 2 === 0) MAP.pixelText(g, '!', ax - 1, ay - 26, '#ff3b30');
    }
    if (G.mode !== 'menu' && G.cp && m.cpSpot) G.drawCones(g, m, cam);
    if (G.mode === 'play' && !G.cp && Math.floor(performance.now() / 300) % 2 === 0) {
      for (const v of TRAFFIC.list) {
        if (v.state !== 'drive' || v.stopped) continue;
        if (Math.hypot(v.x - PLAYER.x, v.y - PLAYER.y) > 110) continue;
        if (!TRAFFIC.signs(v).length) continue;
        const x = Math.round(v.x - cam.x), y = Math.round(v.y - cam.y) - 15;
        g.fillStyle = '#000'; g.fillRect(x - 3, y - 1, 7, 8);
        g.fillStyle = '#ffd23f'; g.fillRect(x - 2, y, 5, 6);
        MAP.pixelText(g, '!', x - 1, y + 1, '#c0392b');
      }
    }
    if (G.mode !== 'menu') PLAYER.draw(g, cam);
    /* khung khóa mục tiêu */
    const tv = G.mode === 'play' ? G.target : null;
    if (tv) {
      const half = Math.max(tv.len, tv.wid) / 2 + 3;
      const x0 = Math.round(tv.x - cam.x - half), y0 = Math.round(tv.y - cam.y - half), s = half * 2;
      g.fillStyle = '#ffd23f';
      const c = 4;
      g.fillRect(x0, y0, c, 1); g.fillRect(x0, y0, 1, c);
      g.fillRect(x0 + s - c, y0, c, 1); g.fillRect(x0 + s - 1, y0, 1, c);
      g.fillRect(x0, y0 + s - 1, c, 1); g.fillRect(x0, y0 + s - c, 1, c);
      g.fillRect(x0 + s - c, y0 + s - 1, c, 1); g.fillRect(x0 + s - 1, y0 + s - c, 1, c);
    }
    G.lighting();
    if (G.shift && G.shift.weather === 'rain') G.rain();
    /* mũi tên chỉ hướng tai nạn */
    if (G.accident && G.mode === 'play') {
      const ax = G.accident.x - cam.x, ay = G.accident.y - cam.y;
      if (ax < 0 || ay < 0 || ax > cam.w || ay > cam.h) {
        const cx = cam.w / 2, cy = cam.h / 2, ang = Math.atan2(ay - cy, ax - cx);
        const px = U.clamp(cx + Math.cos(ang) * 1000, 10, cam.w - 10), py = U.clamp(cy + Math.sin(ang) * 1000, 10, cam.h - 10);
        g.save(); g.translate(Math.round(px), Math.round(py)); g.rotate(ang);
        g.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff3b30' : '#ffffff';
        g.fillRect(-6, -1, 7, 3); g.fillRect(0, -3, 2, 7); g.fillRect(2, -2, 2, 5); g.fillRect(4, -1, 2, 3);
        g.restore();
      }
    }
  },

  drawCones(g, m, cam) {
    const L = G.cpLane, y = Math.round(L.pos - 8 - cam.y);
    for (let x = m.cpSpot.x - 150; x <= m.cpSpot.x + 30; x += 18) {
      const px = Math.round(x - cam.x);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px - 1, y + 2, 5, 2);
      g.fillStyle = '#ff7b00'; g.fillRect(px, y - 3, 3, 5); g.fillRect(px - 1, y + 1, 5, 1);
      g.fillStyle = '#ffffff'; g.fillRect(px, y - 1, 3, 1);
    }
  },

  lighting() {
    const L = G.shift ? G.shift.light : 'day';
    if (L === 'day') return;
    const dg = G.dg, cam = G.cam, m = MAP.cur;
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, cam.w, cam.h);
    dg.fillStyle = L === 'night' ? 'rgba(6,10,32,0.74)' : 'rgba(60,25,70,0.32)';
    dg.fillRect(0, 0, cam.w, cam.h);
    dg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const gr = dg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const l of m.lamps) {
      const x = l.x - cam.x, y = l.y - cam.y;
      if (x < -40 || y < -40 || x > cam.w + 40 || y > cam.h + 40) continue;
      hole(x, y, 36, 0.85);
    }
    for (const v of TRAFFIC.list) {
      const x = v.x - cam.x, y = v.y - cam.y;
      if (x < -60 || y < -60 || x > cam.w + 60 || y > cam.h + 60) continue;
      const ax = v.axis === 'x' ? v.dir : 0, ay = v.axis === 'y' ? v.dir : 0;
      const ahead = v.len / 2 + 14;
      hole(x + ax * ahead, y + ay * ahead, v.kind === 'moto' ? 16 : 22, 0.8);
    }
    if (G.mode !== 'menu') hole(PLAYER.x - cam.x, PLAYER.y - cam.y - 6, 30, 0.7);
    if (G.accident) hole(G.accident.x - cam.x, G.accident.y - cam.y, 26, 0.6);
    G.g.drawImage(G.dark, 0, 0);
    /* quầng đèn */
    const g = G.g;
    g.globalCompositeOperation = 'lighter';
    for (const l of m.lamps) {
      const x = Math.round(l.x - cam.x), y = Math.round(l.y - cam.y);
      if (x < -10 || y < -10 || x > cam.w + 10 || y > cam.h + 10) continue;
      g.fillStyle = 'rgba(255,220,140,0.35)'; g.fillRect(x - 1, y - 1, 3, 3);
    }
    g.globalCompositeOperation = 'source-over';
  },

  rain() {
    const g = G.g, cam = G.cam, dt = G.dtLast || 0.016;
    g.fillStyle = 'rgba(40,60,90,0.12)';
    g.fillRect(0, 0, cam.w, cam.h);
    g.fillStyle = 'rgba(170,195,235,0.55)';
    for (const d of G.drops) {
      d.y += d.s * dt; d.x -= d.s * 0.15 * dt;
      if (d.y > cam.h) { d.y = -6; d.x = Math.random() * (cam.w + 40); }
      if (d.x < -4) d.x = cam.w + 4;
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
    }
  },

  frame(now) {
    const dt = Math.min(0.05, ((now - G.last) || 16) / 1000);
    G.last = now;
    G.dtLast = dt;
    try {
      G.update(dt);
      G.render();
      if (G.mode === 'play' || (G.mode === 'pause' && G.shift)) {
        if (G.mode === 'play' || G.pauseWhy) { UI.updateHud(); UI.updateCard(G.mode === 'play' ? G.target : null); }
      }
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(G.frame);
  }
};

window.addEventListener('load', G.init);
