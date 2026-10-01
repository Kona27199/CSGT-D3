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

  lightState(I, axis) {
    if (I.round) return 'g';
    if (I.rail) return I.st === 'g' ? 'g' : I.st === 'y' ? 'y' : 'r';
    return TRAFFIC.PHASES[I.phase][axis];
  },

  /* Đường ngang: g (mở) → y (đèn đỏ nhấp nháy, chuông, chắn đang hạ) → r (chắn đóng, tàu qua) → o (chắn đang mở) */
  TRAIN_V: 95,
  updateRail(m, I, dt) {
    I.t += dt;
    const tr = I.train;
    if (tr) {
      tr.y += tr.dir * TRAFFIC.TRAIN_V * dt;
      if ((tr.dir > 0 && tr.y - tr.len > m.ph + 60) || (tr.dir < 0 && tr.y + tr.len < -60)) I.train = null;
    }
    if (I.st === 'g' && I.t >= I.next) {
      I.st = 'y'; I.t = 0;
      const dir = U.chance(0.5) ? 1 : -1, len = 5 * 36, lead = TRAFFIC.TRAIN_V * 8;
      I.train = { x: m.rails[0].x, dir: dir, len: len, y: dir > 0 ? I.y0 - lead : I.y1 + lead, cars: 5 };
      if (G.mode === 'play' && Math.abs(PLAYER.x - I.x0) < 300) AUDIO.beep();
    } else if (I.st === 'y' && I.t >= 5) { I.st = 'r'; I.t = 0; }
    else if (I.st === 'r') {
      const t = I.train;
      const clear = !t || (t.dir > 0 ? t.y - t.len > I.y1 + 8 : t.y + t.len < I.y0 - 8);
      if (clear && I.t > 1) { I.st = 'o'; I.t = 0; }
    } else if (I.st === 'o' && I.t >= 1.6) { I.st = 'g'; I.t = 0; I.next = U.range(18, 32) * (DATA.hasMod(G.shift, 'jam') ? 0.7 : 1); }
  },
  /* mức hạ cần chắn: 0 = dựng đứng, 1 = hạ hết */
  barrierDown(I) {
    if (I.st === 'y') return U.clamp((I.t - 2) / 3, 0, 1);
    if (I.st === 'r') return 1;
    if (I.st === 'o') return U.clamp(1 - I.t / 1.6, 0, 1);
    return 0;
  },

  updateLights(m, dt) {
    for (const I of m.inters) {
      if (I.rail) { TRAFFIC.updateRail(m, I, dt); I.occ = { x: false, y: false }; continue; }
      if (I.round) {
        I.occ = { x: false, y: false }; I.near = { x: false, y: false };
        /* luân phiên: hướng nào chờ quá lâu thì được ưu tiên vào vòng xuyến một lúc (tránh tắc cứng) */
        I.prioT = (I.prioT || 0) - dt;
        if (I.prioT <= 0) I.prio = null;
        if (!I.prio) {
          const w = { x: 0, y: 0 };
          for (const v of TRAFFIC.list) if (v.ywaitI === I) w[v.axis] = Math.max(w[v.axis], v.ywait || 0);
          const ax = w.x > w.y ? 'x' : 'y';
          if (w[ax] > 2.5) { I.prio = ax; I.prioT = 3.5; for (const v of TRAFFIC.list) if (v.ywaitI === I) v.ywait = 0; }
        }
        continue;
      }
      I.t += dt;
      if (I.t >= TRAFFIC.PHASES[I.phase].d) { I.t = 0; I.phase = (I.phase + 1) % TRAFFIC.PHASES.length; }
      I.occ = { x: false, y: false };
    }
    for (const v of TRAFFIC.list) {
      if (v.state === 'leave' || v.state === 'stopped') continue;
      for (const I of m.inters) {
        if (v.x > I.x0 - 2 && v.x < I.x1 + 2 && v.y > I.y0 - 2 && v.y < I.y1 + 2) I.occ[v.axis] = true;
      }
      /* vòng xuyến: xe đang chạy tới sát vạch nhường đường (chưa dừng) cũng là xe phải được nhường */
      if (v.state === 'drive' && v.speed > 12) for (const S of v.lane.stops) {
        if (!S.inter.round) continue;
        const d = (S.at - TRAFFIC.front(v)) * v.dir;
        if (d > -2 && d < 60) S.inter.near[v.axis] = true;
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
      } else if (L.emer) {
        const pe = (shift.p.shoulder || 0) + (shift.p.estop || 0);
        if (!pe) { L.timer = 999; continue; }
        base = 14 / pe;
      } else if (m.kind === 'highway' || m.kind === 'expressway') base = 2.5;
      else if (L.axis === 'y') base = m.kind === 'newtown' ? 3.2 : 4.6;
      else if (L.oneway) base = 4.4;
      else base = 3.0;
      L.timer = U.range(0.6, 1.4) * base / (L.wrong || L.emer ? 1 : shift.density * (DATA.hasMod(shift, 'jam') ? 1.7 : 1));
      const s0 = L.dir > 0 ? -30 : L.len + 30;
      const blocked = TRAFFIC.list.some(v => v.lane === L && Math.abs(v.s - s0) < 44);
      if (blocked) { L.timer = 0.4; continue; }
      TRAFFIC.list.push(TRAFFIC.make(L, shift, s0));
    }
  },

  make(L, shift, s0) {
    const p = shift.p;
    let kind = L.wrong ? 'moto' : U.weighted(shift.mix);
    if (L.emer && kind === 'moto') kind = 'car';
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
    /* đường cao tốc: tốc độ tối thiểu, xe máy đi nhầm, làn dừng khẩn cấp */
    const mk = MAP.cur ? MAP.cur.kind : '';
    v.minKmh = L.min || 0;
    if (L.min && !v.speeder) v.cruiseKmh = Math.max(v.cruiseKmh, L.min + U.range(8, 22));
    if (L.min && kind !== 'moto' && !v.speeder && U.chance(p.slow || 0)) { v.slow = true; v.cruiseKmh = L.min - U.int(8, 18); }
    if (mk === 'expressway' && kind === 'moto') { v.xway = true; v.cruiseKmh = U.range(45, 58); }
    if (L.emer) {
      const pe = (p.shoulder || 0) + (p.estop || 0);
      if (U.chance((p.estop || 0) / Math.max(0.01, pe))) {
        const r = U.weighted({ breakdown: 55, rest: 15, toilet: 12, photo: 9, phone: 9 });
        v.estop = { reason: r, hazard: r === 'breakdown' ? U.chance(0.72) : U.chance(0.35) };
        v.stopAt = L.dir > 0 ? U.range(0.3, 0.85) * L.len : U.range(0.15, 0.7) * L.len;
        v.parkT = U.range(30, 48); v.phone = false;
        v.cruiseKmh = U.range(55, 70);
      } else { v.emerDrive = true; v.cruiseKmh = U.range(70, 95); }
    }
    if (DATA.hasMod(shift, 'jam')) v.cruiseKmh *= 0.8;
    /* khu đô thị mới: vòng xuyến, đường ngang */
    v.noYield = U.chance(p.noYield || 0);
    v.railRun = U.chance(p.railRun || 0);
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
    v.noYield = false; v.railRun = false;
    if (v.slow) { v.slow = false; v.cruiseKmh = v.minKmh + U.range(8, 22); }
  },

  /* toạ độ thế giới từ (s, lệch ngang) */
  pos(v) {
    const L = v.lane;
    const rn = L.axis === 'x' ? L.dir : -L.dir;
    let across = L.pos + v.shift + rn * v.off;
    if (v.weave && (v.state === 'drive' || v.state === 'flee')) across += Math.sin(v.t * 1.7) * 3;
    /* vòng xuyến: xe đi vòng quanh đảo tròn ngược chiều kim đồng hồ (phần đường bên phải) */
    v.bendD = 0;
    const RB = L.rb;
    if (RB) {
      const u = (v.s - RB.c) / RB.H;
      if (u > -1 && u < 1) {
        const d = L.pos - RB.ac, ad = Math.abs(d), sg = Math.sign(d) || 1, T2 = ad < 16 ? 38 : 50;
        const amp = (T2 - ad) * sg, cs = Math.cos(Math.PI * u / 2);
        across += amp * cs * cs;
        v.bendD = -amp * Math.PI / (2 * RB.H) * Math.sin(Math.PI * u);
      }
    }
    if (L.axis === 'x') { v.x = v.s; v.y = across; } else { v.x = across; v.y = v.s; }
  },

  front(v) { return v.s + v.dir * v.len / 2; },

  leaderOf(v) {
    let best = null, bd = 1e9;
    const acr = o => o.axis === 'x' ? o.y : o.x;
    for (const o of TRAFFIC.list) {
      if (o === v) continue;
      if (o.lane !== v.lane) {
        /* xe chạy trên làn khẩn cấp: tránh xe đang dừng ở lề phía trước */
        if (!v.lane.emer || o.axis !== v.axis || o.dir !== v.dir || !(o.state === 'pullover' || o.state === 'stopped' || o.state === 'crash') || Math.abs(acr(o) - acr(v)) > 10) continue;
        const d0 = (o.s - v.s) * v.dir;
        if (d0 > 0 && d0 < bd) { bd = d0; best = o; }
        continue;
      }
      if (o.state === 'leave' || o.state === 'flee') continue;
      if ((o.state === 'pullover' || o.state === 'stopped') && o.off > 5) continue;
      const d = (o.s - v.s) * v.dir;
      if (d > 0 && d < bd) { bd = d; best = o; }
    }
    return best ? { v: best, d: bd } : null;
  },

  /* xe máy cố tình không nhường đường: luồn qua hàng xe đang chờ trước vòng xuyến để chen vào */
  squeeze(v, ld) {
    if (!v.noYield || v.kind !== 'moto' || ld.v.lane !== v.lane || ld.v.speed > 4 || ld.d > 70) return false;
    const near = v.lane.stops.some(S => { if (!S.inter.round) return false; const d = (S.at - TRAFFIC.front(ld.v)) * v.dir; return d > -6 && d < 90; });
    if (!near) return false;
    v.shift = (v.axis === 'x' ? -v.dir : v.dir) * 6;
    return true;
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
        if (ld && TRAFFIC.squeeze(v, ld)) { /* luồn lách qua hàng xe đang chờ */ }
        else if (ld) {
          const gap = ld.d - (v.len + ld.v.len) / 2 - 6;
          if (gap < 40 && ld.v.speed < v.speed - 5 && !L.wrong) {
            /* thử chuyển làn để vượt */
            const alt = m.lanes.find(o => o !== L && o.axis === L.axis && o.dir === L.dir && !o.wrong && !o.noSpawn && !o.emer && Math.abs(o.pos - L.pos) <= 17);
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
          if (S.inter.rail) {
            if (st === 'r') mustStop = true;
            else if (st === 'y' && !v.railRun && dist > 6) mustStop = true;
          } else {
            if (st === 'r' && !v.runRed) mustStop = true;
            if (st === 'y' && dist > v.speed * 0.7 + 4) mustStop = true;
            if (st === 'g' && S.inter.occ && S.inter.occ[other] && !v.runRed && !(S.inter.round && v.noYield) && dist < 30) mustStop = true;
            if (S.inter.round && S.inter.prio && S.inter.prio !== v.axis && !v.noYield && dist < 30) mustStop = true;
            if (S.inter.round) { if (mustStop && v.speed < 6) { v.ywait = (v.ywait || 0) + dt; v.ywaitI = S.inter; } else if (!mustStop) v.ywaitI = null; }
          }
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
        /* dừng trên làn dừng khẩn cấp */
        if (v.stopAt != null) {
          const dist = (v.stopAt - f) * v.dir;
          target = Math.min(target, Math.sqrt(2 * 90 * Math.max(0, dist)));
          if (!v.parked && v.speed < 3 && dist < 4) v.parked = true;
          if (v.parked) {
            target = 0; v.speed = 0; v.parkT -= dt;
            if (v.parkT <= 0) { v.parked = false; v.stopAt = null; v.mergeOut = true; }
          }
        }
      } else if (v.state === 'pullover' || v.state === 'stopped') {
        target = 0;
        const want = Math.abs(v.lane.curb - v.lane.pos) - v.wid / 2 - 1 + (v.lane.axis === 'x' ? 0 : 0);
        if (v.off < want) v.off = Math.min(want, v.off + 18 * dt);
        if (v.state === 'pullover' && v.speed < 1 && v.off >= want - 0.5) { v.state = 'stopped'; v.stoppedAt = v.t; }
      } else if (v.state === 'leave') {
        target = v.cruiseKmh * KPX * 0.9;
        if (v.lane.emer) v.mergeOut = true;
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
      if (v.mergeOut && v.lane.emer) {
        const alt = m.lanes.find(o => o.axis === v.lane.axis && o.dir === v.lane.dir && !o.emer && Math.abs(o.pos - v.lane.pos) <= 17);
        if (alt && TRAFFIC.laneFree(alt, v.s, v)) { v.shift += v.lane.pos - alt.pos + (v.lane.axis === 'x' ? v.lane.dir : -v.lane.dir) * v.off; v.off = 0; v.lane = alt; v.mergeOut = false; }
        else if (v.state === 'drive') target = Math.min(target, 8);
      }
      const prevFront = TRAFFIC.front(v);
      v.s += v.dir * v.speed * dt;
      if (Math.abs(v.shift) > 0.1) v.shift -= Math.sign(v.shift) * Math.min(Math.abs(v.shift), 22 * dt); else v.shift = 0;
      /* phát hiện vượt đèn đỏ */
      if (v.state === 'drive' || v.state === 'flee') {
        const nf = TRAFFIC.front(v);
        for (const S of v.lane.stops) {
          if (!((S.at - prevFront) * v.dir > 0 && (S.at - nf) * v.dir <= 0)) continue;
          const I = S.inter, st = TRAFFIC.lightState(I, v.axis);
          if (I.rail) {
            if (st !== 'g') { v.railX = true; if (TRAFFIC.inView(v, cam)) { v.railSeen = true; v.redFlash = 4; } }
          } else if (I.round) {
            const oa = v.axis === 'x' ? 'y' : 'x';
            if (v.noYield && I.occ && (I.occ[oa] || (I.near && I.near[oa]))) { v.cutIn = true; if (TRAFFIC.inView(v, cam)) { v.yieldSeen = true; v.redFlash = 4; } }
          } else if (st === 'r') {
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
    for (const v of TRAFFIC.list) {
      if (!v.dead) { alive.push(v); continue; }
      if (EVENTS.onExit(v)) { if (!v.dead) alive.push(v); continue; }
      onExit(v);
    }
    TRAFFIC.list = alive;
  },

  /* dừng trên làn khẩn cấp trái quy định: không do sự cố, hoặc không bật đèn khẩn cấp */
  estopBad(v) { return !!v.estop && (v.estop.reason !== 'breakdown' || !v.estop.hazard); },

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
      if (v.xway) out.push('m_expressway');
    }
    if (v.veh === 'car') {
      if (v.emerDrive) out.push('c_emerlane');
      if (TRAFFIC.estopBad(v)) out.push('c_estop');
      if (v.minKmh && v.measured != null && v.measured < v.minKmh) out.push('c_minspeed');
    }
    if (v.cutIn) out.push(P + 'noyield');
    if (v.railX) out.push(P + 'rail');
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
      if (v.xway) t.push('m_expressway');
    }
    if (v.emerDrive) t.push('emerlane');
    if (v.estop && !v.estop.hazard) t.push('estop');
    if (v.veh === 'car' && v.minKmh && v.measured != null && v.measured < v.minKmh) t.push('minspeed');
    if (v.yieldSeen) t.push('noyield');
    if (v.railSeen) t.push('rail');
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
    if (v.xway) t.push('🚫 Xe máy đi vào đường cao tốc');
    if (v.emerDrive) t.push('🛣 Chạy trên làn dừng khẩn cấp');
    if (v.estop && (v.parked || v.state === 'stopped')) t.push('🅿 Dừng trên làn dừng khẩn cấp · ' + (v.estop.hazard ? 'có bật đèn khẩn cấp' : 'KHÔNG bật đèn khẩn cấp'));
    if (v.veh === 'car' && v.minKmh && v.measured != null && v.measured < v.minKmh) t.push('🐢 Chạy dưới tốc độ tối thiểu');
    if (v.yieldSeen) t.push('↻ Không nhường đường trong vòng xuyến');
    if (v.railSeen) t.push('🚆 Vượt đường ngang khi đèn đỏ đã bật');
    if (v.measured != null && DATA.speedTier(v.veh, v.measured - v.lane.limit)) t.push('📡 Quá tốc độ');
    if (v.weave) t.push('〰 Lạng lách, nghi có cồn');
    if (v.kind === 'truck' && DATA.loadTier(v.overPct)) t.push('⚖ Xe tải chở hàng nặng, chạy ì ạch');
    if (v.kind === 'truck' && v.height > v.heightLimit) t.push('📏 Hàng xếp cao vượt thành thùng');
    if (v.kind === 'bus' && v.busExcess > 0) t.push('🚌 Xe khách đông, có người đứng ở cửa');
    return t;
  },

  /* ---------------- SPRITE PHƯƠNG TIỆN (nhìn từ trên, hướng sang phải) ---------------- */
  sprite(v) { return SPR.vehicle(v); },

  angle(v) {
    if (v.bendD) return v.axis === 'x' ? Math.atan2(v.bendD * v.dir, v.dir) : Math.atan2(v.dir, v.bendD * v.dir);
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
      if (v.estop && v.estop.hazard && (v.parked || v.state === 'stopped') && Math.floor(v.t * 2.5) % 2 === 0) {
        const x = Math.round(v.x - cam.x), y = Math.round(v.y - cam.y), hl = v.len / 2, hw = v.wid / 2;
        g.fillStyle = '#ffb000';
        for (const [a, b] of [[-hl, -hw], [hl - 1.5, -hw], [-hl, hw - 1.5], [hl - 1.5, hw - 1.5]]) g.fillRect(x + a, y + b, 1.5, 1.5);
      }
      if ((v.state === 'pullover' || v.state === 'stopped' || v.state === 'crash') && Math.floor(v.t * 3) % 2 === 0) {
        g.fillStyle = '#ffb703';
        g.fillRect(Math.round(v.x - cam.x) - 1, Math.round(v.y - cam.y) - 1, 2, 2);
      }
    }
  },

  /* tàu hỏa (vẽ trên lớp xe) */
  drawTrains(g, m, cam) {
    for (const I of m.inters) {
      const tr = I.train;
      if (!tr) continue;
      const x = Math.round(tr.x - cam.x);
      for (let k = 0; k < tr.cars; k++) {
        const y0 = tr.dir > 0 ? tr.y - k * 36 - 34 : tr.y + k * 36;
        const y = Math.round(y0 - cam.y);
        if (y > cam.h + 40 || y < -80) continue;
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 6, y + 2, 14, 34);
        g.fillStyle = k === 0 ? '#1d4fa3' : '#2a64c4'; g.fillRect(x - 7, y, 14, 34);
        g.fillStyle = '#f1f1f1'; g.fillRect(x - 7, y + 4, 14, 2); g.fillRect(x - 7, y + 28, 14, 2);
        g.fillStyle = '#ffd23f'; g.fillRect(x - 7.5, y + 15, 1, 6); g.fillRect(x + 6.5, y + 15, 1, 6);
        g.fillStyle = '#9fc3e6'; for (let w = y + 8; w < y + 26; w += 5) { g.fillRect(x - 7, w, 1, 3); g.fillRect(x + 6, w, 1, 3); }
        if (k === 0) { g.fillStyle = '#fff3a0'; g.fillRect(x - 4, tr.dir > 0 ? y + 33 : y, 2, 1); g.fillRect(x + 2, tr.dir > 0 ? y + 33 : y, 2, 1); }
      }
    }
  },

  drawOne(g, v, x, y, scale) {
    g.save();
    g.translate(x, y);
    g.rotate(TRAFFIC.angle(v) + (v.crashAngle || 0));
    g.scale(scale, scale);
    g.drawImage(v.spr, -Math.floor(v.len / 2) - 1, -Math.floor(v.wid / 2) - 1, v.len + 2, v.wid + 2);
    g.restore();
  }
};
