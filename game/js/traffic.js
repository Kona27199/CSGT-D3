'use strict';
/* Giao thông: đèn tín hiệu, sinh phương tiện + hồ sơ vi phạm, di chuyển, vẽ */
const KPX = 0.9; // 1 km/h = 0.9 px/giây

const TRAFFIC = {
  list: [],
  PHASES: [
    { x: 'g', y: 'r', d: 10 }, { x: 'y', y: 'r', d: 3 }, { x: 'r', y: 'r', d: 2 },
    { x: 'r', y: 'g', d: 8 }, { x: 'r', y: 'y', d: 3 }, { x: 'r', y: 'r', d: 2 }
  ],
  HELMETS: ['#e63946', '#f1f1f1', '#3a86ff', '#ffb703', '#2a9d8f', '#ff006e', '#fb8500'],
  SHIRTS: ['#e76f51', '#457b9d', '#f4a261', '#90be6d', '#f8f9fa', '#b5838d', '#6d597a', '#43aa8b', '#577590'],
  MOTO_COLORS: ['#c1121f', '#222222', '#3a86ff', '#e9e9e9', '#6a4c93', '#2a9d8f', '#d4a017'],
  CAR_COLORS: ['#c1121f', '#f1f1f1', '#262626', '#3a86ff', '#6c757d', '#e9c46a', '#2a9d8f', '#8d99ae', '#7b2cbf'],

  reset() { TRAFFIC.list = []; },

  lightState(I, axis) { return TRAFFIC.PHASES[I.phase][axis]; },

  updateLights(m, dt) {
    for (const I of m.inters) {
      I.t += dt;
      if (I.t >= TRAFFIC.PHASES[I.phase].d) { I.t = 0; I.phase = (I.phase + 1) % TRAFFIC.PHASES.length; }
      I.occ = { x: false, y: false };
    }
    for (const v of TRAFFIC.list) {
      if (v.state === 'leave' || v.state === 'stopped') continue;
      for (const I of m.inters) {
        if (v.x > I.x0 - 2 && v.x < I.x1 + 2 && v.y > I.y0 - 2 && v.y < I.y1 + 2) I.occ[v.axis] = true;
      }
    }
  },

  /* ---------------- SINH PHƯƠNG TIỆN ---------------- */
  spawnAll(m, shift, dt) {
    if (TRAFFIC.list.length > 64) return;
    for (const L of m.lanes) {
      L.timer -= dt;
      if (L.timer > 0 || L.noSpawn) continue;
      let base;
      if (L.wrong) {
        if (!shift.p.wrongway) { L.timer = 999; continue; }
        base = 3.5 / shift.p.wrongway;
      } else if (m.kind === 'highway') base = 2.6;
      else if (L.axis === 'y') base = 4.6;
      else if (L.oneway) base = 4.4;
      else base = 3.0;
      L.timer = U.range(0.6, 1.4) * base / (L.wrong ? 1 : shift.density);
      const s0 = L.dir > 0 ? -30 : L.len + 30;
      const blocked = TRAFFIC.list.some(v => v.lane === L && Math.abs(v.s - s0) < 44);
      if (blocked) { L.timer = 0.4; continue; }
      TRAFFIC.list.push(TRAFFIC.make(L, shift, s0));
    }
  },

  make(L, shift, s0) {
    const p = shift.p;
    const kind = L.wrong ? 'moto' : U.weighted(shift.mix);
    const v = {
      kind: kind, veh: kind === 'moto' ? 'moto' : 'car', lane: L, axis: L.axis, dir: L.dir, s: s0, off: 0, shift: 0,
      state: 'drive', speed: 0, t: U.range(0, 10), seen: false, ranRed: false, redWitnessed: false,
      measured: null, radarShown: 0, stopped: false, handled: false
    };
    v.len = kind === 'moto' ? 16 : kind === 'car' ? 24 : kind === 'bus' ? 36 : 34;
    v.wid = kind === 'moto' ? 8 : kind === 'car' ? 12 : 14;
    /* hồ sơ vi phạm */
    if (kind === 'moto') {
      v.helmet = !U.chance(p.helmet);
      v.pass = U.chance(p.carry2) ? 2 : U.chance(p.passenger) ? 1 : 0;
      v.passHelmet = v.pass > 0 ? !U.chance(p.passHelmet) : true;
      if (v.pass === 2) v.len = 19;
    } else { v.helmet = true; v.pass = 0; v.passHelmet = true; }
    v.phone = U.chance(p.phone);
    v.runRed = U.chance(p.runRed);
    const lim = L.limit;
    v.cruiseKmh = lim - U.range(4, 13);
    if (shift.radar && U.chance(p.speed)) {
      const tiers = v.veh === 'moto' ? [[6, 9], [12, 18], [24, 36]] : [[6, 9], [12, 18], [23, 32], [38, 50]];
      const tr = U.pick(tiers);
      v.cruiseKmh = lim + U.int(tr[0], tr[1]);
      v.speeder = true;
    }
    if (kind === 'truck' || kind === 'bus') v.cruiseKmh = Math.min(v.cruiseKmh, lim + 12);
    /* chuyên đề: tải trọng, chiều cao xếp hàng (xe tải); số người (xe khách) */
    v.overPct = null; v.height = 0; v.heightLimit = 0; v.busSeats = 0; v.busExcess = 0; v.busPeople = 0;
    if (kind === 'truck') {
      v.capT = U.pick([5, 8, 10, 15]);
      if (U.chance(p.overload || 0)) { const tr = U.pick([[13, 27], [33, 47], [55, 95], [105, 140]]); v.overPct = U.int(tr[0], tr[1]); }
      else v.overPct = U.int(-35, 8);
      v.heightLimit = 4.2;
      v.height = U.chance(p.oversize || 0) ? Math.round((4.2 + U.range(0.3, 1.0)) * 10) / 10 : Math.round(U.range(2.6, 4.0) * 10) / 10;
      if (v.overPct > 30) v.cruiseKmh = Math.min(v.cruiseKmh, lim - 12);
    }
    if (kind === 'bus') {
      v.busSeats = U.pick([29, 45]);
      v.busExcess = U.chance(p.busOver || 0) ? U.int(3, Math.floor(v.busSeats * 0.35)) : 0;
      v.busPeople = v.busExcess ? v.busSeats + v.busExcess : v.busSeats - U.int(0, 9);
    }
    v.alc = 0;
    if (U.chance(p.alcohol)) {
      const lv = U.weighted({ 1: 4, 2: 3, 3: 3 });
      v.alc = lv === '1' ? U.range(0.05, 0.24) : lv === '2' ? U.range(0.27, 0.39) : U.range(0.42, 0.8);
      v.alc = Math.round(v.alc * 1000) / 1000;
    }
    v.weave = DATA.alcoholLevel(v.alc) >= 2 && U.chance(0.6);
    v.lic = U.chance(p.noLic) ? 'none' : U.chance(p.noCarryLic) ? 'forgot' : U.chance(p.vneid) ? 'vneid' : 'ok';
    v.reg = U.chance(p.noCarryReg) ? 'forgot' : 'ok';
    v.ins = U.chance(p.noIns) ? U.pick(['none', 'expired']) : 'ok';
    v.react = U.weighted(shift.react);
    /* tuần tra theo phạm vi: mô tô chỉ xử lý xe mô tô; ô tô chỉ xử lý ô tô */
    if ((shift.scope === 'moto' && kind !== 'moto') || (shift.scope === 'car' && kind === 'moto')) TRAFFIC.strip(v, lim);
    v.flee = U.chance(shift.flee || 0);
    const female = U.chance(0.35);
    const N = DATA.NAMES;
    v.driver = {
      name: U.pick(N.ho) + ' ' + (female ? U.pick(N.demNu) : U.pick(N.demNam)) + ' ' + (female ? U.pick(N.tenNu) : U.pick(N.tenNam)),
      age: U.int(19, 62), female: female
    };
    const pc = U.pick(DATA.PROVINCE_CODES);
    v.plate = kind === 'moto'
      ? pc + '-' + U.pick(['B1', 'F1', 'H1', 'K1', 'D1', 'AA']) + ' ' + U.int(100, 999) + '.' + U.pad(U.int(0, 99))
      : pc + U.pick(['A', 'C', 'D', 'G', 'K']) + '-' + U.int(100, 999) + '.' + U.pad(U.int(0, 99));
    v.speed = v.cruiseKmh * KPX * 0.8;
    v.spr = TRAFFIC.sprite(v);
    TRAFFIC.pos(v);
    return v;
  },

  /* Xoá mọi vi phạm (phương tiện ngoài phạm vi chuyên đề) */
  strip(v, lim) {
    v.helmet = true; v.pass = 0; v.passHelmet = true; v.phone = false; v.runRed = false;
    if (v.kind === 'moto') v.len = 16;
    if (v.speeder) { v.speeder = false; v.cruiseKmh = lim - U.range(4, 13); }
    v.alc = 0; v.weave = false; v.lic = 'ok'; v.reg = 'ok'; v.ins = 'ok';
    if (v.overPct != null) v.overPct = Math.min(v.overPct, 5);
    if (v.height > v.heightLimit) v.height = 3.8;
    v.busExcess = 0; if (v.busPeople > v.busSeats) v.busPeople = v.busSeats;
  },

  /* toạ độ thế giới từ (s, lệch ngang) */
  pos(v) {
    const L = v.lane;
    const rn = L.axis === 'x' ? L.dir : -L.dir;
    let across = L.pos + v.shift + rn * v.off;
    if (v.weave && v.state === 'drive') across += Math.sin(v.t * 1.7) * 3;
    if (L.axis === 'x') { v.x = v.s; v.y = across; } else { v.x = across; v.y = v.s; }
  },

  front(v) { return v.s + v.dir * v.len / 2; },

  leaderOf(v) {
    let best = null, bd = 1e9;
    for (const o of TRAFFIC.list) {
      if (o === v || o.lane !== v.lane) continue;
      if (o.state === 'leave' || o.state === 'flee') continue;
      if ((o.state === 'pullover' || o.state === 'stopped') && o.off > 5) continue;
      const d = (o.s - v.s) * v.dir;
      if (d > 0 && d < bd) { bd = d; best = o; }
    }
    return best ? { v: best, d: bd } : null;
  },

  laneFree(L, s, skip) {
    return !TRAFFIC.list.some(o => o !== skip && o.lane === L && o.state !== 'leave' && Math.abs(o.s - s) < 34);
  },

  /* ---------------- CẬP NHẬT ---------------- */
  update(m, dt, cam, onExit) {
    for (const v of TRAFFIC.list) {
      v.t += dt;
      const L = v.lane;
      let target = v.cruiseKmh * KPX * (v.boost || 1);
      if (v.state === 'drive') {
        const ld = TRAFFIC.leaderOf(v);
        if (ld) {
          const gap = ld.d - (v.len + ld.v.len) / 2 - 6;
          if (gap < 40 && ld.v.speed < v.speed - 5 && !L.wrong) {
            /* thử chuyển làn để vượt */
            const alt = m.lanes.find(o => o !== L && o.axis === L.axis && o.dir === L.dir && !o.wrong && !o.noSpawn && Math.abs(o.pos - L.pos) <= 17);
            const nearStop = L.stops.some(S => { const d = (S.at - TRAFFIC.front(v)) * v.dir; return d > -v.len && d < 60; });
            if (alt && !nearStop && TRAFFIC.laneFree(alt, v.s, v) && (!v.lcCool || v.t > v.lcCool)) {
              v.shift += L.pos - alt.pos; v.lane = alt; v.lcCool = v.t + 2;
            }
          }
          target = Math.min(target, Math.max(0, gap * 2.2));
        }
        /* đèn tín hiệu */
        const f = TRAFFIC.front(v);
        for (const S of v.lane.stops) {
          const dist = (S.at - f) * v.dir;
          if (dist < -2) {
            continue;
          }
          const st = TRAFFIC.lightState(S.inter, v.axis);
          const other = v.axis === 'x' ? 'y' : 'x';
          let mustStop = false;
          if (st === 'r' && !v.runRed) mustStop = true;
          if (st === 'y' && dist > v.speed * 0.7 + 4) mustStop = true;
          if (st === 'g' && S.inter.occ && S.inter.occ[other] && !v.runRed && dist < 30) mustStop = true;
          if (mustStop) target = Math.min(target, Math.max(0, dist * 2.4));
          break;
        }
        /* dừng tại chốt kiểm soát */
        if (v.holdAt != null) {
          const dist = (v.holdAt - f) * v.dir;
          /* phanh theo quãng đường còn lại (v² = 2·a·d) để không vượt quá điểm dừng */
          target = Math.min(target, Math.sqrt(2 * 120 * Math.max(0, dist)));
          if ((v.speed < 3 && dist < 4) || dist < -6) { v.speed = 0; target = 0; v.state = 'cpwait'; v.waitT = 0; }
        }
      } else if (v.state === 'pullover' || v.state === 'stopped') {
        target = 0;
        const want = Math.abs(v.lane.curb - v.lane.pos) - v.wid / 2 - 1 + (v.lane.axis === 'x' ? 0 : 0);
        if (v.off < want) v.off = Math.min(want, v.off + 18 * dt);
        if (v.state === 'pullover' && v.speed < 1 && v.off >= want - 0.5) { v.state = 'stopped'; v.stoppedAt = v.t; }
      } else if (v.state === 'leave') {
        target = v.cruiseKmh * KPX * 0.9;
      } else if (v.state === 'flee') {
        target = v.cruiseKmh * KPX * 1.8;
      } else if (v.state === 'cpwait') {
        target = 0;
      } else if (v.state === 'crash') {
        target = 0; v.speed = 0;
      }
      const acc = v.state === 'pullover' ? 70 : 45, dec = 160;
      if (v.speed < target) v.speed = Math.min(target, v.speed + acc * dt);
      else v.speed = Math.max(target, v.speed - dec * dt);
      const prevFront = TRAFFIC.front(v);
      v.s += v.dir * v.speed * dt;
      if (Math.abs(v.shift) > 0.1) v.shift -= Math.sign(v.shift) * Math.min(Math.abs(v.shift), 22 * dt); else v.shift = 0;
      /* phát hiện vượt đèn đỏ */
      if (v.state === 'drive' || v.state === 'flee') {
        const nf = TRAFFIC.front(v);
        for (const S of v.lane.stops) {
          if ((S.at - prevFront) * v.dir > 0 && (S.at - nf) * v.dir <= 0 && TRAFFIC.lightState(S.inter, v.axis) === 'r') {
            v.ranRed = true;
            if (TRAFFIC.inView(v, cam)) { v.redWitnessed = true; v.redFlash = 4; }
          }
        }
      }
      if (v.redFlash) v.redFlash = Math.max(0, v.redFlash - dt);
      TRAFFIC.pos(v);
      if (TRAFFIC.inView(v, cam)) v.seen = true;
      if ((v.dir > 0 && v.s > L.len + 50) || (v.dir < 0 && v.s < -50)) v.dead = true;
    }
    const alive = [];
    for (const v of TRAFFIC.list) { if (v.dead) onExit(v); else alive.push(v); }
    TRAFFIC.list = alive;
  },

  inView(v, cam) {
    return v.x > cam.x - 8 && v.x < cam.x + cam.w + 8 && v.y > cam.y - 8 && v.y < cam.y + cam.h + 8;
  },

  /* Các lỗi thực tế của phương tiện (sự thật) */
  truth(v, shift) {
    const P = v.veh === 'moto' ? 'm_' : 'c_';
    const out = [];
    if (v.veh === 'moto') {
      if (!v.helmet) out.push('m_helmet');
      if (v.pass >= 1 && !v.passHelmet) out.push('m_pass_helmet');
      if (v.pass === 2) out.push('m_carry2');
      if (v.lane.wrong || v.wrongReport) out.push('m_wrongway');
    }
    if (v.phone) out.push(P + 'phone');
    if (v.ranRed) out.push(P + 'redlight');
    if (v.measured != null) {
      const tier = DATA.speedTier(v.veh, v.measured - v.lane.limit);
      if (tier) out.push(P + 'speed' + tier);
    }
    const al = DATA.alcoholLevel(v.alc);
    if (al) out.push(P + 'alc' + al);
    if (v.lic === 'none') out.push(P + 'nolicense');
    if (v.lic === 'forgot') out.push(P + 'nocarry_lic');
    if (v.reg === 'forgot') out.push(P + 'nocarry_reg');
    if (v.ins !== 'ok') out.push(P + 'noins');
    if (v.kind === 'truck') {
      const lt = DATA.loadTier(v.overPct);
      if (lt) out.push('c_load' + lt);
      if (v.height > v.heightLimit) out.push('c_height');
    }
    if (v.kind === 'bus' && v.busExcess > 0) out.push('c_bus_over');
    return out;
  },

  /* Lỗi quan sát được từ bên ngoài (dùng tính "bỏ lọt") */
  visibleViolations(v) {
    const t = [];
    if (v.veh === 'moto') {
      if (!v.helmet) t.push('m_helmet');
      if (v.pass >= 1 && !v.passHelmet) t.push('m_pass_helmet');
      if (v.pass === 2) t.push('m_carry2');
      if (v.lane.wrong || v.wrongReport) t.push('m_wrongway');
    }
    if (v.phone) t.push('phone');
    if (v.redWitnessed) t.push('redlight');
    if (v.measured != null && DATA.speedTier(v.veh, v.measured - v.lane.limit)) t.push('speed');
    if (v.kind === 'truck' && DATA.loadTier(v.overPct)) t.push('load');
    if (v.kind === 'truck' && v.height > v.heightLimit) t.push('height');
    if (v.kind === 'bus' && v.busExcess > 0) t.push('bus');
    return t;
  },

  /* Dấu hiệu vi phạm nhìn thấy được (dùng cho gợi ý) */
  signs(v) {
    const t = [];
    if (v.veh === 'moto') {
      if (!v.helmet) t.push('⛑ Người lái không đội mũ bảo hiểm');
      if (v.pass >= 1 && !v.passHelmet) t.push('⛑ Người ngồi sau không đội mũ');
      if (v.pass === 2) t.push('👥 Chở 3 người');
    }
    if (v.phone) t.push('📱 Dùng điện thoại khi lái');
    if (v.lane.wrong || v.wrongReport) t.push('⛔ Đi ngược chiều');
    if (v.redWitnessed) t.push('📷 Vượt đèn đỏ');
    if (v.measured != null && DATA.speedTier(v.veh, v.measured - v.lane.limit)) t.push('📡 Quá tốc độ');
    if (v.weave) t.push('〰 Lạng lách, nghi có cồn');
    if (v.kind === 'truck' && DATA.loadTier(v.overPct)) t.push('⚖ Xe tải chở hàng nặng, chạy ì ạch');
    if (v.kind === 'truck' && v.height > v.heightLimit) t.push('📏 Hàng xếp cao vượt thành thùng');
    if (v.kind === 'bus' && v.busExcess > 0) t.push('🚌 Xe khách đông, có người đứng ở cửa');
    return t;
  },

  /* ---------------- SPRITE PHƯƠNG TIỆN (nhìn từ trên, hướng sang phải) ---------------- */
  sprite(v) {
    const L = v.len, W = v.wid;
    const cv = document.createElement('canvas');
    cv.width = L + 2; cv.height = W + 2;
    const g = cv.getContext('2d');
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    r(1, 1 + 1, L, W, 'rgba(0,0,0,0.28)'); // bóng
    if (v.kind === 'moto') {
      const col = U.pick(TRAFFIC.MOTO_COLORS);
      r(0, 3, 3, 2, '#141414'); r(L - 3, 3, 3, 2, '#141414');
      r(2, 2, L - 5, 4, col); r(3, 3, L - 8, 2, '#2b2b2b');
      r(L - 5, 0, 1, 8, '#9a9a9a'); r(L - 5, 0, 1, 1, '#e0e0e0'); r(L - 5, 7, 1, 1, '#e0e0e0');
      r(L - 2, 3, 1, 2, '#fff6b0');
      const drawPerson = (x, helm, helmCol, shirt) => {
        r(x, 1, 4, 6, shirt);
        if (helm) {
          r(x, 2, 4, 4, helmCol); r(x + 1, 2, 1, 1, '#ffffff'); r(x + 3, 2, 1, 4, '#1a1a1a');
        } else {
          r(x, 2, 4, 4, '#2b1d14'); r(x + 3, 3, 1, 2, '#e0ac69'); r(x + 1, 2, 1, 1, '#4a3526');
        }
      };
      if (v.pass === 2) drawPerson(2, v.passHelmet, U.pick(TRAFFIC.HELMETS), U.pick(TRAFFIC.SHIRTS));
      if (v.pass >= 1) drawPerson(L - 13, v.passHelmet, U.pick(TRAFFIC.HELMETS), U.pick(TRAFFIC.SHIRTS));
      const shirt = U.pick(TRAFFIC.SHIRTS);
      drawPerson(L - 9, v.helmet, U.pick(TRAFFIC.HELMETS), shirt);
      r(L - 6, 1, 2, 1, '#e0ac69'); r(L - 6, 6, 2, 1, '#e0ac69');
      if (v.phone) { r(L - 7, 0, 2, 2, '#5ef2ff'); r(L - 7, 0, 1, 1, '#ffffff'); }
    } else if (v.kind === 'car') {
      const col = U.pick(TRAFFIC.CAR_COLORS);
      r(3, 0, 5, 1, '#111'); r(L - 8, 0, 5, 1, '#111'); r(3, W - 1, 5, 1, '#111'); r(L - 8, W - 1, 5, 1, '#111');
      r(0, 1, L, W - 2, col); r(0, 1, 1, 1, 'rgba(0,0,0,0)');
      g.clearRect(0, 1, 1, 1); g.clearRect(0, W - 2, 1, 1); g.clearRect(L - 1, 1, 1, 1); g.clearRect(L - 1, W - 2, 1, 1);
      r(L - 9, 2, 3, W - 4, '#1c2a3a'); r(L - 9, 2, 1, W - 4, '#3d5a78');
      r(3, 2, 2, W - 4, '#1c2a3a');
      r(5, 2, L - 14, W - 4, 'rgba(0,0,0,0.12)');
      r(6, 3, L - 16, 1, 'rgba(255,255,255,0.25)');
      r(L - 1, 2, 1, 2, '#fff6b0'); r(L - 1, W - 4, 1, 2, '#fff6b0');
      r(0, 2, 1, 2, '#c1121f'); r(0, W - 4, 1, 2, '#c1121f');
      if (v.phone) { r(L - 8, 3, 2, 2, '#5ef2ff'); r(L - 8, 3, 1, 1, '#ffffff'); }
    } else if (v.kind === 'bus') {
      const col = U.pick(['#f1f1f1', '#e9c46a', '#2a9d8f', '#3a86ff', '#c1121f']);
      r(5, 0, 5, 1, '#111'); r(5, W - 1, 5, 1, '#111'); r(L - 9, 0, 5, 1, '#111'); r(L - 9, W - 1, 5, 1, '#111');
      r(0, 1, L, W - 2, col);
      g.clearRect(0, 1, 1, 1); g.clearRect(0, W - 2, 1, 1); g.clearRect(L - 1, 1, 1, 1); g.clearRect(L - 1, W - 2, 1, 1);
      for (let i = 3; i < L - 5; i += 4) { r(i, 1, 3, 1, '#1c2a3a'); r(i, W - 2, 3, 1, '#1c2a3a'); }
      r(L - 3, 2, 2, W - 4, '#1c2a3a'); r(L - 3, 2, 1, W - 4, '#3d5a78');
      r(10, 4, 8, W - 8, 'rgba(255,255,255,0.35)'); r(11, 5, 6, W - 10, '#9aa5b1'); // máy lạnh trên nóc
      r(2, 3, 30, 1, 'rgba(0,0,0,0.12)');
      r(L - 1, 2, 1, 2, '#fff6b0'); r(L - 1, W - 4, 1, 2, '#fff6b0');
      r(0, 2, 1, 2, '#c1121f'); r(0, W - 4, 1, 2, '#c1121f');
      if (v.busExcess > 0) { r(L - 7, W - 2, 3, 1, '#e0ac69'); r(L - 7, W - 1, 1, 1, '#2b1d14'); r(L - 5, W - 1, 1, 1, '#2b1d14'); } // người đứng ở cửa
      if (v.phone) { r(L - 5, 3, 2, 2, '#5ef2ff'); r(L - 5, 3, 1, 1, '#ffffff'); }
    } else {
      const cab = U.pick(['#1d4e89', '#c1121f', '#2a9d8f', '#e9c46a']);
      const box = U.pick(['#d9d9d9', '#b56576', '#6d6875', '#e76f51']);
      r(4, 0, 5, 1, '#111'); r(4, W - 1, 5, 1, '#111'); r(14, 0, 5, 1, '#111'); r(14, W - 1, 5, 1, '#111'); r(L - 7, 0, 4, 1, '#111'); r(L - 7, W - 1, 4, 1, '#111');
      r(0, 1, L - 10, W - 2, box);
      for (let i = 3; i < L - 11; i += 4) r(i, 1, 1, W - 2, 'rgba(0,0,0,0.15)');
      if (DATA.loadTier(v.overPct)) {
        /* hàng chất đầy, vun cao */
        r(1, 2, L - 12, W - 4, '#8d6e63');
        for (let i = 2; i < L - 12; i += 3) r(i, 3 + (i % 2), 2, W - 7, '#a1887f');
        r(3, 4, L - 16, W - 8, '#6d4c41');
      }
      if (v.height > v.heightLimit) {
        /* hàng xếp cao: khối hàng sẫm màu, có dây chằng */
        r(1, 1, L - 12, W - 2, '#4e6e8e');
        for (let i = 2; i < L - 12; i += 5) r(i, 1, 1, W - 2, '#ffd23f');
        r(1, 1, L - 12, 1, '#2f4356'); r(1, W - 2, L - 12, 1, '#2f4356');
      }
      r(L - 10, 1, 1, W - 2, '#333');
      r(L - 9, 1, 9, W - 2, cab); r(L - 4, 2, 2, W - 4, '#1c2a3a');
      r(L - 1, 2, 1, 2, '#fff6b0'); r(L - 1, W - 4, 1, 2, '#fff6b0');
      if (v.phone) { r(L - 5, 3, 2, 2, '#5ef2ff'); r(L - 5, 3, 1, 1, '#ffffff'); }
    }
    return cv;
  },

  angle(v) {
    if (v.axis === 'x') return v.dir > 0 ? 0 : Math.PI;
    return v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  },

  draw(g, cam) {
    for (const v of TRAFFIC.list) {
      if (!TRAFFIC.inView(v, { x: cam.x - 30, y: cam.y - 30, w: cam.w + 60, h: cam.h + 60 })) continue;
      TRAFFIC.drawOne(g, v, Math.round(v.x - cam.x), Math.round(v.y - cam.y), 1);
      if (v.redFlash > 0 && Math.floor(v.redFlash * 4) % 2 === 0) {
        MAP.pixelText(g, '!', Math.round(v.x - cam.x) - 1, Math.round(v.y - cam.y) - 16, '#ff3b30');
      }
      if ((v.state === 'pullover' || v.state === 'stopped' || v.state === 'crash') && Math.floor(v.t * 3) % 2 === 0) {
        g.fillStyle = '#ffb703';
        g.fillRect(Math.round(v.x - cam.x) - 1, Math.round(v.y - cam.y) - 1, 2, 2);
      }
    }
  },

  drawOne(g, v, x, y, scale) {
    g.save();
    g.translate(x, y);
    g.rotate(TRAFFIC.angle(v) + (v.crashAngle || 0));
    g.scale(scale, scale);
    g.drawImage(v.spr, -Math.floor(v.len / 2) - 1, -Math.floor(v.wid / 2) - 1);
    g.restore();
  }
};
