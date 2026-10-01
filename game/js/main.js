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
  tally: null,
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

  /* Canvas vẽ ở độ phân giải thật của màn hình; mỗi điểm ảnh đồ họa = k điểm ảnh màn hình (số nguyên → luôn sắc nét).
   * Mặc định nhìn rộng ~250 đơn vị theo cạnh ngắn; người chơi thu phóng bằng +/−, con lăn chuột. */
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const short = Math.min(W, H) * dpr;
    G.kBase = Math.max(1, Math.round(short / (RS * 250)));
    const step = SAVE.data.zoomStep || 0;
    G.k = U.clamp(G.kBase + step, 1, G.kBase + 3);
    G.scale = RS * G.k;
    G.cv.width = Math.round(W * dpr); G.cv.height = Math.round(H * dpr);
    G.dark.width = G.cv.width; G.dark.height = G.cv.height;
    G.view.w = G.cv.width / G.scale; G.view.h = G.cv.height / G.scale;
    G.cam.w = G.view.w; G.cam.h = G.view.h;
    G.g.imageSmoothingEnabled = false;
    const need = Math.ceil(G.view.w * G.view.h / 260);
    while (G.drops.length < need) G.drops.push({ x: Math.random() * G.view.w, y: Math.random() * G.view.h, s: 180 + Math.random() * 120 });
    G.drops.length = need;
    const zl = UI.$('zoomLbl'); if (zl) zl.textContent = 'x' + G.k;
  },

  zoom(d) {
    const step = (SAVE.data.zoomStep || 0) + d;
    if (G.kBase + step < 1 || step > 3) return;
    SAVE.data.zoomStep = step; SAVE.store();
    G.resize();
    AUDIO.click();
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
      if ((k === '+' || k === '=') && !UI.isModal()) G.zoom(1);
      if ((k === '-' || k === '_') && !UI.isModal()) G.zoom(-1);
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
    G.cv.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) > 2) G.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    UI.$('zoomIn').addEventListener('click', () => G.zoom(1));
    UI.$('zoomOut').addEventListener('click', () => G.zoom(-1));
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
    LIFE.init(MAP.cur, G.shift);
    G.attractT = 0;
    UI.initMinimap(MAP.cur, false);
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
    UI.cpPanel(null);
    UI.hint(null);
    UI.$('toast').innerHTML = '';
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
      G.cpLane = m.lanes[m.cpLane];
      G.cpLane.noSpawn = true;
      G.cpHold = m.cpSpot.x + 14;
      /* tăng tỉ lệ vi phạm vì xe đến lần lượt */
      const p = Object.assign({}, shift.p);
      for (const k of ['helmet', 'passHelmet', 'carry2', 'phone', 'runRed', 'speed', 'alcohol']) p[k] = Math.min(0.6, (p[k] || 0) * 1.8);
      G.cpShift = Object.assign({}, shift, { p: p });
    }
    G.prewarm(20);
    for (const v of TRAFFIC.list) { v.ranRed = false; v.redWitnessed = false; }
    PLAYER.reset(G.cp ? m.cpSpot : m.vehSpawn, G.cp ? null : mode);
    if (G.cp) PLAYER.face = 'left';
    G.cpCur = null; G.cpTimer = 0.6; G.pass = false;
    UI.$('touch').classList.toggle('cp', G.cp);
    G.timeLeft = shift.duration;
    G.score = 0; G.log = [];
    G.stats = { passOk: 0, stops: 0, correct: 0, missed: 0, wrong: 0, escaped: 0, procOk: 0, procBad: 0, bribeRefused: 0, fineMin: 0, fineMax: 0, accident: null };
    G.target = null; G.pendingStop = null; G.act = false; G.actCool = 0;
    G.tally = { viol: {}, events: 0 };
    G.mode = 'play';
    G.pauseWhy = null;
    UI._cache = {};
    UI.hud(true);
    EVENTS.start(shift);
    MISSIONS.start(mode, shift);
    LIFE.init(m, shift);
    UI.initMinimap(m, !G.cp);
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
    if (reason !== 'bribe') MISSIONS.check(true);
    G.mode = 'summary';
    EVENTS.clear();
    UI.$('toast').innerHTML = '';
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
    UI.summary({ missions: MISSIONS.list, mode: G.modeUsed, shift: G.baseShift || sh, score: score, stars: stars, stats: G.stats, log: G.log, failed: failed, newBest: newBest, promoted: promoted, nextShift: nextShift });
  },

  /* ---------------- CHỐT KIỂM SOÁT ---------------- */
  vehicleDone(v) {
    if (G.cp && v === G.cpCur) { G.cpCur = null; G.cpTimer = 1.2; UI.cpPanel(null); }
  },

  cpSpawn() {
    const L = G.cpLane, sh = G.cpShift;
    const A = EVENTS.active;
    if (A && A.pendingCp) {
      const w = A.pendingCp; A.pendingCp = null;
      w.lane = L; w.s = Math.max(-30, G.cam.x - 30); w.holdAt = G.cpHold; w.cp = true; w.boost = 2; w.speed = w.cruiseKmh * KPX * 2;
      TRAFFIC.pos(w); TRAFFIC.list.push(w); G.cpCur = w;
      return;
    }
    const v = TRAFFIC.make(L, sh, Math.max(-30, G.cam.x - 30));
    /* máy đo tốc độ ghi nhận tốc độ hành trình tại điểm đo; hình ảnh xe vào chốt được tăng tốc cho nhịp chơi nhanh */
    if (G.shift.radar) v.measured = Math.round(v.cruiseKmh);
    v.boost = 2;
    v.speed = v.cruiseKmh * KPX * v.boost;
    v.holdAt = G.cpHold;
    v.cp = true;
    if (v.runRed) { v.ranRed = true; v.redWitnessed = true; }
    if (MAP.cur.oneway && v.veh === 'moto' && U.chance((sh.p.wrongway || 0) * 0.5)) v.wrongReport = true;
    TRAFFIC.list.push(v);
    G.cpCur = v;
  },

  cpPass(v, timeout) {
    UI.cpPanel(null);
    v.holdAt = null;
    v.boost = 1;
    v.state = 'drive';
    if (v.wanted) { G.vehicleDone(v); EVENTS.wantedMissed(); return; }
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
    MISSIONS.check();
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

  /* ---------------- CẬP NHẬT ---------------- */
  update(dt) {
    const m = MAP.cur;
    if (G.mode === 'menu') {
      G.attractT += dt;
      G.cam.x = U.clamp(m.pw / 2 - G.cam.w / 2 + Math.sin(G.attractT * 0.08) * 280, 0, m.pw - G.cam.w);
      G.cam.y = U.clamp(17 * TILE - G.cam.h / 2 + Math.sin(G.attractT * 0.05) * 90, 0, Math.max(0, m.ph - G.cam.h));
      TRAFFIC.updateLights(m, dt); TRAFFIC.spawnAll(m, G.shift, dt); TRAFFIC.update(m, dt, G.cam, () => {});
      LIFE.update(dt, G.cam);
      return;
    }
    if (G.mode !== 'play') return;
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) { G.timeLeft = 0; G.endShift('time'); return; }
    TRAFFIC.updateLights(m, dt);
    TRAFFIC.spawnAll(m, G.shift, dt);
    EVENTS.update(dt);
    LIFE.update(dt, G.cam);
    if (G.mode !== 'play') return;
    TRAFFIC.update(m, dt, G.cam, v => {
      if (v.event) return;
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
    G.cam.x = Math.round(U.clamp(PLAYER.x - G.cam.w / 2, 0, Math.max(0, m.pw - G.cam.w)) * RS) / RS;
    G.cam.y = Math.round(U.clamp(PLAYER.y - G.cam.h / 2, 0, Math.max(0, m.ph - G.cam.h)) * RS) / RS;
    /* khóa mục tiêu */
    let best = null, bd = 72;
    for (const v of TRAFFIC.list) {
      if (v.state !== 'drive' || v.stopped || v.special) continue;
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
    /* tình huống đặc biệt */
    const nearAcc = EVENTS.near();
    /* hành động */
    G.actCool -= dt;
    if (G.act) {
      G.act = false;
      if (nearAcc) { EVENTS.interact(); return; }
      if (G.pendingStop) UI.toast('Đang chờ phương tiện tấp vào lề...');
      else if (best && G.actCool <= 0) { G.actCool = 0.6; INSPECT.command(best); }
      else if (!best) UI.toast('Không có phương tiện trong tầm hiệu lệnh');
    }
    /* gợi ý */
    if (nearAcc) UI.hint('<b>SPACE</b> / XỬ LÝ: ' + U.esc(EVENTS.active.title));
    else if (G.pendingStop) UI.hint('Phương tiện đang tấp vào lề...');
    else if (best) UI.hint('<b>SPACE</b> / DỪNG XE: ra hiệu lệnh dừng ' + U.esc(best.plate));
    else if (EVENTS.active && EVENTS.active.type !== 'wanted') UI.hint('⚠ Đến hiện trường (theo mũi tên đỏ): ' + U.esc(EVENTS.active.title));
    else if (EVENTS.active) UI.hint('🚨 Tìm xe biển số ' + U.esc(EVENTS.active.vehicle ? EVENTS.active.vehicle.plate : '') + ' trong dòng xe');
    else UI.hint(null);
    UI.$('btnAct').textContent = nearAcc ? 'XỬ LÝ' : 'DỪNG XE';
  },

  /* ---------------- VẼ ---------------- */
  render() {
    const g = G.g, m = MAP.cur, cam = G.cam;
    if (!m) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0e1319';
    g.fillRect(0, 0, G.cv.width, G.cv.height);
    G.ox = cam.w > m.pw ? Math.round((cam.w - m.pw) / 2) : 0;
    G.oy = cam.h > m.ph ? Math.round((cam.h - m.ph) / 2) : 0;
    g.setTransform(G.scale, 0, 0, G.scale, G.ox * G.scale, G.oy * G.scale);
    g.imageSmoothingEnabled = false;
    const sw = Math.min(cam.w, m.pw - cam.x), sh = Math.min(cam.h, m.ph - cam.y);
    g.drawImage(m.bg, cam.x * RS, cam.y * RS, sw * RS, sh * RS, 0, 0, sw, sh);
    LIFE.drawWater(g, cam);
    LIFE.drawPeds(g, cam);
    TRAFFIC.draw(g, cam);
    if (G.mode !== 'menu' && G.cp && m.cpSpot) G.drawCones(g, m, cam);
    if (G.mode !== 'menu') PLAYER.draw(g, cam);
    MAP.drawLights(g, m, cam);
    LIFE.drawTrees(g, cam);
    g.drawImage(m.fg, cam.x * RS, cam.y * RS, sw * RS, sh * RS, 0, 0, sw, sh);
    LIFE.drawParts(g, cam);
    if (G.mode !== 'menu') EVENTS.draw(g, cam);
    if (G.mode === 'play' && !G.cp && Math.floor(performance.now() / 300) % 2 === 0) {
      for (const v of TRAFFIC.list) {
        if (v.state !== 'drive' || v.stopped || v.special) continue;
        if (Math.hypot(v.x - PLAYER.x, v.y - PLAYER.y) > 110) continue;
        if (!TRAFFIC.signs(v).length) continue;
        const x = Math.round(v.x - cam.x), y = Math.round(v.y - cam.y) - 15;
        g.fillStyle = '#000'; g.fillRect(x - 3, y - 1, 7, 8);
        g.fillStyle = '#ffd23f'; g.fillRect(x - 2, y, 5, 6);
        MAP.pixelText(g, '!', x - 1, y + 1, '#c0392b');
      }
    }
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
    LIFE.drawBirds(g);
    if (G.mode !== 'menu') EVENTS.drawArrow(g, cam);
    G.miniT = (G.miniT || 0) + 1;
    if (G.miniT % 4 === 0) UI.drawMinimap();
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

  /* chùm sáng hình nón (đèn pha) */
  cone(ctx, x, y, ang, len, spread, rgba0) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, len);
    gr.addColorStop(0, rgba0); gr.addColorStop(1, rgba0.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, ang - spread, ang + spread); ctx.closePath(); ctx.fill();
  },
  glow(ctx, x, y, r, rgba0) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba0); gr.addColorStop(1, rgba0.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  },

  lighting() {
    const L = G.shift ? G.shift.light : 'day';
    const g = G.g, cam = G.cam, m = MAP.cur, t = performance.now() / 1000;
    const rain = G.shift && G.shift.weather === 'rain';
    const inV = (x, y, pad) => x > -pad && y > -pad && x < cam.w + pad && y < cam.h + pad;
    if (L === 'day') {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const W = G.cv.width, H = G.cv.height;
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, rain ? 'rgba(10,20,40,0.35)' : 'rgba(0,0,0,0.2)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      g.setTransform(G.scale, 0, 0, G.scale, G.ox * G.scale, G.oy * G.scale);
      return;
    }
    const night = L === 'night';
    /* hoàng hôn: nhuộm cam phía trên, tím phía dưới */
    if (!night) {
      const lg = g.createLinearGradient(0, 0, 0, cam.h);
      lg.addColorStop(0, 'rgba(255,140,60,0.22)'); lg.addColorStop(1, 'rgba(110,60,150,0.18)');
      g.fillStyle = lg; g.fillRect(0, 0, cam.w, cam.h);
    }
    const dg = G.dg;
    dg.setTransform(1, 0, 0, 1, 0, 0);
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, G.dark.width, G.dark.height);
    dg.fillStyle = night ? 'rgba(5,9,28,0.78)' : 'rgba(40,20,60,0.3)';
    dg.fillRect(0, 0, G.dark.width, G.dark.height);
    dg.setTransform(G.scale, 0, 0, G.scale, G.ox * G.scale, G.oy * G.scale);
    dg.globalCompositeOperation = 'destination-out';
    const lamps = m.lamps.map(l => ({ x: l.x - cam.x, y: l.y - cam.y })).filter(p => inV(p.x, p.y, 50));
    for (const p of lamps) G.glow(dg, p.x + 3, p.y - 2, 44, 'rgba(0,0,0,0.92)');
    const heads = [];
    for (const v of TRAFFIC.list) {
      const x = v.x - cam.x, y = v.y - cam.y;
      if (!inV(x, y, 70) || v.state === 'crash') continue;
      const ang = TRAFFIC.angle(v);
      const fx = x + Math.cos(ang) * v.len / 2, fy = y + Math.sin(ang) * v.len / 2;
      heads.push({ v: v, x: x, y: y, fx: fx, fy: fy, ang: ang });
      G.cone(dg, fx, fy, ang, v.kind === 'moto' ? 32 : 46, v.kind === 'moto' ? 0.28 : 0.34, 'rgba(0,0,0,0.6)');
      G.glow(dg, fx + Math.cos(ang) * 14, fy + Math.sin(ang) * 14, v.kind === 'moto' ? 12 : 17, 'rgba(0,0,0,0.5)');
      G.glow(dg, x, y, v.len * 0.6, 'rgba(0,0,0,0.35)');
    }
    if (G.mode !== 'menu') {
      if (PLAYER.veh) {
        const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[PLAYER.face];
        G.cone(dg, PLAYER.x - cam.x, PLAYER.y - cam.y, ang, 56, 0.36, 'rgba(0,0,0,0.65)');
        G.glow(dg, PLAYER.x - cam.x + Math.cos(ang) * 20, PLAYER.y - cam.y + Math.sin(ang) * 20, 20, 'rgba(0,0,0,0.55)');
      }
      G.glow(dg, PLAYER.x - cam.x, PLAYER.y - cam.y - 4, 34, 'rgba(0,0,0,0.75)');
    }
    for (const w of m.windows) { const x = w.x - cam.x, y = w.y - cam.y; if (w.lit && inV(x, y, 10)) dg.fillRect(x, y, w.w, w.h); }
    const ep = G.mode !== 'menu' ? EVENTS.pos() : null;
    if (ep) G.glow(dg, ep.x - cam.x, ep.y - cam.y, 30, 'rgba(0,0,0,0.7)');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(G.dark, 0, 0);
    g.setTransform(G.scale, 0, 0, G.scale, G.ox * G.scale, G.oy * G.scale);
    /* ánh sáng màu cộng thêm */
    g.globalCompositeOperation = 'lighter';
    for (const p of lamps) {
      G.glow(g, p.x + 3, p.y - 2, 34, night ? 'rgba(255,180,90,0.22)' : 'rgba(255,190,110,0.12)');
      g.fillStyle = 'rgba(255,230,160,0.9)'; g.fillRect(p.x + 2.5, p.y - 11.75, 1.75, 0.75);
      if (rain) { const rg = g.createLinearGradient(0, p.y, 0, p.y + 22); rg.addColorStop(0, 'rgba(255,200,120,0.25)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = rg; g.fillRect(p.x + 1.5, p.y, 3, 22); }
    }
    for (const h of heads) {
      G.glow(g, h.fx + Math.cos(h.ang) * 12, h.fy + Math.sin(h.ang) * 12, h.v.kind === 'moto' ? 13 : 18, night ? 'rgba(255,240,200,0.14)' : 'rgba(255,240,200,0.07)');
      G.glow(g, h.fx, h.fy, 3, 'rgba(255,250,220,0.6)');
      const bx = h.x - Math.cos(h.ang) * h.v.len / 2, by = h.y - Math.sin(h.ang) * h.v.len / 2;
      const brake = h.v.state !== 'drive' || h.v.speed < h.v.cruiseKmh * KPX * 0.5;
      G.glow(g, bx, by, brake ? 9 : 5, brake ? 'rgba(255,40,40,0.5)' : 'rgba(255,40,40,0.25)');
      if (rain) { const rg = g.createLinearGradient(0, h.fy, 0, h.fy + 16); rg.addColorStop(0, 'rgba(255,240,200,0.18)'); rg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = rg; g.fillRect(h.fx - 1.5, h.fy, 3, 16); }
    }
    for (const w of m.windows) {
      const x = w.x - cam.x, y = w.y - cam.y;
      if (!w.lit || !inV(x, y, 10)) continue;
      g.fillStyle = w.shop ? 'rgba(255,210,130,0.5)' : 'rgba(255,190,100,0.42)'; g.fillRect(x, y, w.w, w.h);
      if (w.shop) G.glow(g, x + w.w / 2, y + w.h + 2, 10, 'rgba(255,200,120,0.18)');
    }
    /* đèn ưu tiên xanh - đỏ của xe tuần tra hắt xuống mặt đường */
    if (G.mode !== 'menu' && PLAYER.veh) {
      const on = Math.floor(t * 4) % 2 === 0;
      G.glow(g, PLAYER.x - cam.x, PLAYER.y - cam.y, 26, on ? 'rgba(255,40,40,0.35)' : 'rgba(40,110,255,0.35)');
    }
    g.globalCompositeOperation = 'source-over';
  },

  rain() {
    const g = G.g, cam = G.cam, dt = G.dtLast || 0.016;
    g.fillStyle = 'rgba(40,60,90,0.14)';
    g.fillRect(0, 0, cam.w, cam.h);
    g.fillStyle = 'rgba(170,195,235,0.5)';
    for (const d of G.drops) {
      d.y += d.s * dt; d.x -= d.s * 0.15 * dt;
      if (d.y > cam.h) { d.y = -6; d.x = Math.random() * (cam.w + 40); }
      if (d.x < -4) d.x = cam.w + 4;
      g.fillRect(Math.round(d.x * 2) / 2, Math.round(d.y), 0.5, 4);
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
