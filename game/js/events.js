'use strict';
/* =========================================================================
 * TÌNH HUỐNG ĐẶC BIỆT PHÁT SINH TRONG CA
 * accident: tai nạn (3 kiểu) · snatch: cướp giật · wanted: truy nã
 * race: đua xe trái phép · help: hỗ trợ nhân dân (4 kiểu)
 * Tuần tra lưu động: lái xe đến hiện trường (theo mũi tên) rồi bấm SPACE.
 * Chốt kiểm soát: nhận tin báo qua bộ đàm và xử lý ngay (truy nã đi qua chốt).
 * ========================================================================= */
const EVENTS = {
  plan: [], active: null, elapsed: 0,

  start(shift) {
    EVENTS.active = null; EVENTS.elapsed = 0; EVENTS.plan = [];
    const cfg = DATA.SHIFT_EVENTS[shift.id] || DATA.SHIFT_EVENTS.free;
    for (let i = 0; i < cfg.n; i++) {
      const at = shift.duration * (0.15 + 0.72 * (i + U.range(0.1, 0.7)) / cfg.n);
      EVENTS.plan.push({ at: at, type: U.weighted(cfg.w) });
    }
    UI.banner(null);
  },

  /* ---------- tiện ích ---------- */
  cleanShift() {
    const zero = { helmet: 0, passenger: 0, passHelmet: 0, carry2: 0, phone: 0, runRed: 0, speed: 0, alcohol: 0, noLic: 0, noCarryLic: 0, noCarryReg: 0, noIns: 0, overload: 0, oversize: 0, busOver: 0, vneid: 0.3 };
    return Object.assign({}, G.shift, { p: zero, react: { coop: 1 }, flee: 0, scope: null, radar: false });
  },
  xLanes() { return MAP.cur.lanes.filter(L => L.axis === 'x' && !L.wrong && !L.noSpawn); },
  spawn(L, s, kind, props) {
    const sh = Object.assign(EVENTS.cleanShift(), { mix: { [kind === 'amb' ? 'car' : kind]: 1 } });
    const v = TRAFFIC.make(L, sh, s);
    Object.assign(v, props || {});
    if (kind === 'amb') v.kind = 'amb';
    if (v.pass === 2) v.len = 19;
    v.spr = TRAFFIC.sprite(v);
    TRAFFIC.pos(v);
    TRAFFIC.list.push(v);
    return v;
  },
  edgeS(L) { return L.dir > 0 ? -30 : L.len + 30; },
  farSpot(minD, maxD) {
    const sp = MAP.cur.walkSpots.filter(p => { const d = Math.hypot(p.x - PLAYER.x, p.y - PLAYER.y); return d > minD && d < maxD; });
    return sp.length ? U.pick(sp) : U.pick(MAP.cur.walkSpots);
  },

  /* ---------- vòng lặp ---------- */
  update(dt) {
    EVENTS.elapsed += dt;
    const A = EVENTS.active;
    if (!A) {
      const nx = EVENTS.plan[0];
      if (nx && EVENTS.elapsed >= nx.at && !G.pendingStop && !UI.isModal() && (!G.cp || !G.cpCur || G.cpCur.state === 'cpwait' || G.cpCur.state === 'drive')) {
        EVENTS.plan.shift();
        EVENTS.trigger(nx.type);
      }
      return;
    }
    A.t += dt;
    if (A.vehicle && A.vehicle.dead) A.vehicle = null;
    const left = Math.max(0, Math.ceil(A.limit - A.t));
    UI.banner(DATA.EVENT_INFO[A.type].icon + ' ' + A.title + ' · ' + left + 's' + (A.sub ? '<small>' + A.sub + '</small>' : ''));
    if (A.t > A.limit) EVENTS.timeout();
  },

  /* toạ độ mục tiêu hiện tại của tình huống (để vẽ mũi tên, kiểm tra tiếp cận) */
  pos() {
    const A = EVENTS.active;
    if (!A) return null;
    if (A.vehicles) { const v = A.vehicles.find(o => !o.dead && TRAFFIC.list.includes(o)); return v ? { x: v.x, y: v.y } : null; }
    if (A.vehicle) return { x: A.vehicle.x, y: A.vehicle.y };
    return A.spot || null;
  },
  near() {
    const A = EVENTS.active;
    if (!A || G.cp || A.type === 'wanted') return false;
    const p = EVENTS.pos();
    return !!p && Math.hypot(p.x - PLAYER.x, p.y - PLAYER.y) < 56;
  },

  /* ---------- phát sinh ---------- */
  trigger(type) {
    const m = MAP.cur, A = { type: type, t: 0, limit: 75, title: DATA.EVENT_INFO[type].name };
    EVENTS.active = A;
    AUDIO.siren();
    if (type === 'accident') {
      A.variant = U.pick(['moto_car', 'truck', 'fall']);
      A.title = { moto_car: 'Va chạm xe máy – ô tô', truck: 'Xe tải lật, đổ hàng', fall: 'Xe máy tự ngã' }[A.variant];
      if (!G.cp) {
        const L = m.lanes[m.accidentSpot.lane], s = m.accidentSpot.s;
        TRAFFIC.list = TRAFFIC.list.filter(v => !(v.lane === L && Math.abs(v.s - s) < 60));
        const vs = [];
        if (A.variant === 'moto_car') { vs.push(EVENTS.spawn(L, s + 6, 'moto')); vs.push(EVENTS.spawn(L, s - 14, 'car')); vs[0].crashAngle = 0.6; vs[1].crashAngle = -0.25; }
        else if (A.variant === 'truck') { vs.push(EVENTS.spawn(L, s, 'truck', { overPct: 60 })); vs[0].crashAngle = 0.45; vs[0].spr = TRAFFIC.sprite(vs[0]); A.spill = true; }
        else { vs.push(EVENTS.spawn(L, s, 'moto', { helmet: false })); vs[0].crashAngle = 1.35; vs[0].spr = TRAFFIC.sprite(vs[0]); A.person = true; }
        vs.forEach(v => { v.state = 'crash'; v.speed = 0; v.stopped = true; v.event = true; TRAFFIC.pos(v); });
        A.crash = vs; A.spot = { x: vs[0].x, y: vs[0].y };
      }
      UI.toast('📻 Trung tâm chỉ huy: ' + A.title + ' trên tuyến! Tổ công tác đến hiện trường ngay!', 'bad');
    } else if (type === 'snatch') {
      A.limit = 60;
      if (!G.cp) {
        const L = U.pick(EVENTS.xLanes());
        const v = EVENTS.spawn(L, EVENTS.edgeS(L), 'moto', { pass: 1, helmet: true, passHelmet: true, robber: true, plate: '(che biển số)' });
        v.state = 'flee'; v.cruiseKmh = 48; v.special = true; v.event = true;
        A.vehicle = v; A.respawn = 3;
        A.sub = 'Xe máy che biển số, 2 đối tượng áo đen';
      }
      UI.toast('📻 Có người hô cướp giật! Hai đối tượng đi xe máy che biển số, mặc áo đen, đang bỏ chạy!', 'bad');
    } else if (type === 'wanted') {
      A.limit = 110;
      const N = DATA.NAMES;
      const name = U.pick(N.ho) + ' ' + U.pick(N.demNam) + ' ' + U.pick(N.tenNam);
      const kind = U.pick(['moto', 'car']);
      const L = G.cp ? G.cpLane : U.pick(EVENTS.xLanes());
      const v = EVENTS.spawn(L, G.cp ? -400 : EVENTS.edgeS(L), kind, { wanted: true });
      v.driver = { name: name, age: U.int(25, 50), female: false };
      if (G.cp) { TRAFFIC.list.splice(TRAFFIC.list.indexOf(v), 1); A.pendingCp = v; }
      A.vehicle = v; A.respawn = 2;
      A.title = 'Truy nã: ' + name;
      A.sub = (kind === 'moto' ? 'Xe máy' : 'Ô tô') + ' biển số ' + v.plate;
      UI.toast('📻 Thông báo truy nã: đối tượng ' + name + ', điều khiển ' + A.sub.toLowerCase() + '. Phát hiện thì dừng xe, khống chế an toàn!', 'bad');
    } else if (type === 'race') {
      A.limit = 50;
      if (!G.cp) {
        const L = U.pick(EVENTS.xLanes());
        A.vehicles = [];
        for (let i = 0; i < 4; i++) {
          const v = EVENTS.spawn(L, EVENTS.edgeS(L) - L.dir * i * 26, 'moto', { helmet: false, racer: true, weave: true });
          v.state = 'flee'; v.cruiseKmh = 52; v.special = true; v.event = true;
          A.vehicles.push(v);
        }
        A.respawn = 2;
        A.sub = 'Nhóm 4 xe máy lạng lách, không đội mũ bảo hiểm';
      }
      UI.toast('📻 Nhóm thanh niên đua xe trái phép, lạng lách trên tuyến!', 'bad');
    } else if (type === 'help') {
      A.variant = U.pick(G.cp ? ['child', 'old', 'break', 'amb'] : ['amb', 'break', 'child', 'old']);
      A.title = { amb: 'Mở đường cho xe cấp cứu', break: 'Ô tô chết máy giữa đường', child: 'Trẻ em bị lạc', old: 'Cụ già cần qua đường' }[A.variant];
      A.limit = 60;
      if (!G.cp) {
        if (A.variant === 'amb') {
          const L = U.pick(EVENTS.xLanes());
          const v = EVENTS.spawn(L, EVENTS.edgeS(L), 'amb', { amb: true });
          v.cruiseKmh = 14; v.special = true; v.event = true; A.vehicle = v; A.respawn = 1;
        } else if (A.variant === 'break') {
          const L = m.lanes[m.accidentSpot.lane], s = m.accidentSpot.s - 120;
          TRAFFIC.list = TRAFFIC.list.filter(v => !(v.lane === L && Math.abs(v.s - s) < 50));
          const v = EVENTS.spawn(L, s, 'car');
          v.state = 'crash'; v.speed = 0; v.stopped = true; v.event = true; A.crash = [v]; A.spot = { x: v.x, y: v.y };
        } else {
          A.spot = EVENTS.farSpot(140, 420);
          A.ped = A.variant;
        }
      }
      UI.toast('📻 ' + A.title + ': tổ công tác hỗ trợ ngay!');
    }
    /* chốt kiểm soát: xử lý ngay qua bộ đàm (trừ truy nã đi qua chốt) */
    if (G.cp && type !== 'wanted') { UI.cpPanel(null); EVENTS.interact(); }
  },

  /* ---------- xử lý khi đến hiện trường ---------- */
  interact() {
    const A = EVENTS.active;
    if (!A) return;
    let qs, intro;
    if (A.type === 'accident') {
      qs = [DATA.ACCIDENT[0]];
      if (A.variant === 'truck') qs.push(DATA.EVENT_Q.accident_truck);
      else if (A.variant === 'fall') qs.push(DATA.EVENT_Q.accident_fall);
      else qs.push(DATA.ACCIDENT[1]);
      qs.push(DATA.ACCIDENT[2]);
      intro = '🚑 ' + A.title + '. Tổ công tác có mặt tại hiện trường.';
    } else if (A.type === 'snatch') {
      qs = [G.cp ? DATA.EVENT_Q.snatch1_cp : DATA.EVENT_Q.snatch1, DATA.EVENT_Q.snatch2];
      intro = G.cp ? '📻 Đối tượng cướp giật đang chạy về hướng chốt!' : '🦹 Đồng chí đã áp sát xe của đối tượng cướp giật.';
    } else if (A.type === 'race') {
      qs = [DATA.EVENT_Q.race1, DATA.EVENT_Q.race2];
      intro = G.cp ? '📻 Nhóm đua xe trái phép đang chạy về phía chốt.' : '🏍 Đồng chí tiếp cận nhóm đua xe trái phép.';
    } else if (A.type === 'help') {
      qs = [DATA.EVENT_Q['help_' + { amb: 'amb', break: 'break', child: 'child', old: 'old' }[A.variant]]];
      intro = '🤝 ' + A.title + '.';
    } else return;
    EVENTS.quiz(DATA.EVENT_INFO[A.type].icon + ' ' + A.title, intro, qs, (total, allOk) => EVENTS.finish(total, allOk));
  },

  /* xe truy nã bị dừng: quy trình riêng */
  wantedStop(v) {
    const A = EVENTS.active;
    G.pause('event');
    const qs = [DATA.EVENT_Q.wanted1, DATA.EVENT_Q.wanted2];
    EVENTS.quiz('🚨 Đối tượng truy nã', '🪪 Kiểm tra căn cước: <b>' + U.esc(v.driver.name) + '</b>, xe biển số <b>' + U.esc(v.plate) + '</b>, trùng khớp thông báo truy nã.', qs, (total, allOk) => {
      v.state = 'leave'; v.dead = true;
      G.vehicleDone(v);
      G.stats.stops++;
      if (A && A.type === 'wanted') EVENTS.finish(total + 20, allOk); else G.addScore(total);
    });
  },

  /* xe truy nã qua chốt mà bị cho qua */
  wantedMissed() {
    G.addScore(-40);
    G.log.push({ plate: 'Truy nã', text: 'Để lọt đối tượng truy nã qua chốt', pts: -40 });
    UI.toast('⛔ Để lọt đối tượng truy nã qua chốt! (−40)', 'bad');
    EVENTS.clear();
  },

  quiz(title, intro, qs, done) {
    G.pause('event');
    UI.cpPanel(null);
    const box = UI.modal(title, '');
    const body = box.querySelector('.m-body');
    let i = 0, total = 0, allOk = true;
    const ask = () => {
      body.innerHTML = (i === 0 ? '<p>' + intro + '</p>' : '');
      const Q = qs[i];
      const p = document.createElement('p');
      p.className = 'q';
      p.textContent = (i + 1) + '/' + qs.length + '. ' + Q.q;
      body.appendChild(p);
      UI.choices(body, U.shuffled(Q.options), o => {
        const d = o.ok ? 20 : -10;
        total += d; if (!o.ok) allOk = false;
        if (o.ok) AUDIO.good(); else AUDIO.bad();
        UI.feedback(body, o.ok, o.ok ? 'Chính xác!' : o.note, () => {
          i++;
          if (i < qs.length) { ask(); return; }
          body.innerHTML = '<p>Hoàn thành xử lý tình huống. Điểm: <b class="' + (total >= 0 ? 'ok' : 'bad') + '">' + (total >= 0 ? '+' : '') + total + '</b></p>';
          const row = document.createElement('div');
          row.className = 'row-end';
          const b = document.createElement('button');
          b.className = 'btn primary'; b.textContent = 'Tiếp tục ▶';
          b.onclick = () => { AUDIO.click(); UI.closeModal(); G.resume(); done(total, allOk); };
          row.appendChild(b); body.appendChild(row); b.focus();
        });
      });
    };
    ask();
  },

  finish(total, allOk) {
    const A = EVENTS.active;
    if (!A) return;
    G.addScore(total);
    G.log.push({ plate: DATA.EVENT_INFO[A.type].name, text: A.title + (allOk ? ' – xử lý tốt' : ' – còn sai sót'), pts: total });
    if (total > 0) { G.tally.events++; G.tally['ev_' + A.type] = (G.tally['ev_' + A.type] || 0) + 1; }
    if (A.type === 'help' && A.vehicle) { A.vehicle.cruiseKmh = 70; A.vehicle.special = true; A.vehicle = null; }
    if (A.type === 'race' && A.vehicles) A.vehicles.forEach(v => { v.dead = true; });
    if (A.type === 'snatch' && A.vehicle) A.vehicle.dead = true;
    if (total > 0) UI.toast('🎖 ' + (A.type === 'help' ? 'Hình ảnh đẹp của người chiến sĩ CSGT! ' : 'Hoàn thành tình huống! ') + '(+' + total + ')');
    EVENTS.clear();
    MISSIONS.check();
  },

  timeout() {
    const A = EVENTS.active;
    const pen = A.type === 'help' ? -10 : A.type === 'wanted' ? -15 : -30;
    const msg = {
      accident: 'Tổ công tác khác đã phải đến xử lý vụ tai nạn',
      snatch: 'Đối tượng cướp giật đã tẩu thoát; đã thông báo đặc điểm cho các lực lượng',
      wanted: 'Đối tượng truy nã đã ra khỏi địa bàn',
      race: 'Nhóm đua xe đã chạy khỏi tuyến; đã báo trung tâm',
      help: 'Người dân đã phải chờ quá lâu'
    }[A.type];
    G.addScore(pen);
    G.log.push({ plate: DATA.EVENT_INFO[A.type].name, text: 'Không kịp xử lý', pts: pen });
    UI.toast(msg + ' (' + pen + ')', 'bad');
    EVENTS.clear();
  },

  clear() {
    const A = EVENTS.active;
    if (A) {
      (A.crash || []).forEach(v => { v.dead = true; });
      if (A.type !== 'help' && A.vehicle) A.vehicle.dead = true;
      if (A.vehicles) A.vehicles.forEach(v => { v.dead = true; });
    }
    TRAFFIC.list = TRAFFIC.list.filter(v => !v.dead);
    EVENTS.active = null;
    UI.banner(null);
  },

  /* phương tiện của tình huống chạy ra khỏi bản đồ: cho vào lại từ một làn khác */
  onExit(v) {
    const A = EVENTS.active;
    if (!A) return false;
    const mine = v === A.vehicle || (A.vehicles && A.vehicles.includes(v));
    if (!mine) return false;
    if (A.respawn > 0 && !(A.vehicles && A.vehicles.indexOf(v) > 0)) {
      A.respawn--;
      const L = U.pick(EVENTS.xLanes());
      const group = A.vehicles || [v];
      group.forEach((o, i) => {
        o.lane = L; o.dir = L.dir; o.axis = L.axis; o.s = EVENTS.edgeS(L) - L.dir * i * 26; o.dead = false; o.shift = 0; o.off = 0;
        TRAFFIC.pos(o);
      });
      return true;
    }
    return mine;
  },

  /* ---------- vẽ ---------- */
  draw(g, cam) {
    const A = EVENTS.active;
    if (!A || G.cp) return;
    const t = performance.now() / 1000;
    if (A.spill && A.crash && A.crash[0]) {
      const v = A.crash[0];
      for (let i = 0; i < 9; i++) {
        g.fillStyle = i % 2 ? '#8d6e63' : '#a1887f';
        g.fillRect(Math.round(v.x - cam.x - 14 + (i * 7) % 26), Math.round(v.y - cam.y + 6 + (i * 5) % 9), 3, 2);
      }
    }
    if (A.person && A.crash && A.crash[0]) {
      const v = A.crash[0], x = Math.round(v.x - cam.x) + 9, y = Math.round(v.y - cam.y) + 2;
      g.fillStyle = '#457b9d'; g.fillRect(x, y, 6, 3); g.fillStyle = '#2b1d14'; g.fillRect(x + 6, y, 2.5, 3);
    }
    if (A.ped) {
      const sp = A.spot, x = Math.round(sp.x - cam.x), y = Math.round(sp.y - cam.y);
      g.drawImage(SPR.pedestrian(A.ped), x - 4, y - 11, 8, 12);
      if (A.ped === 'child' && Math.floor(t * 2) % 2) { g.fillStyle = '#9fd3ff'; g.fillRect(x + 2.5, y - 6, 0.5, 1.5); }
    }
    if (A.vehicle && A.vehicle.amb) {
      const v = A.vehicle, on = Math.floor(t * 4) % 2;
      g.fillStyle = on ? '#ff2a2a' : '#3aa0ff'; g.fillRect(Math.round(v.x - cam.x) - 1, Math.round(v.y - cam.y) - 3, 2, 6);
    }
    const p = EVENTS.pos();
    if (p) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      const rr = 10 + (t * 12) % 8;
      g.strokeStyle = 'rgba(255,59,48,' + (0.9 - (rr - 10) / 10) + ')'; g.lineWidth = 0.75;
      g.strokeRect(x - rr, y - rr, rr * 2, rr * 2);
      if (Math.floor(t * 3) % 2 === 0) { g.fillStyle = '#000'; g.fillRect(x - 3, y - 22, 7, 8); g.fillStyle = '#ff3b30'; g.fillRect(x - 2, y - 21, 5, 6); MAP.pixelText(g, '!', x - 1, y - 20.5, '#ffffff'); }
    }
  },

  drawArrow(g, cam) {
    const p = EVENTS.pos();
    if (!p || G.cp || G.mode !== 'play') return;
    const ax = p.x - cam.x, ay = p.y - cam.y;
    if (ax >= 0 && ay >= 0 && ax <= cam.w && ay <= cam.h) return;
    const cx = cam.w / 2, cy = cam.h / 2, ang = Math.atan2(ay - cy, ax - cx);
    const px = U.clamp(cx + Math.cos(ang) * 1000, 10, cam.w - 10), py = U.clamp(cy + Math.sin(ang) * 1000, 14, cam.h - 10);
    g.save(); g.translate(Math.round(px), Math.round(py)); g.rotate(ang);
    g.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff3b30' : '#ffffff';
    g.fillRect(-6, -1, 7, 3); g.fillRect(0, -3, 2, 7); g.fillRect(2, -2, 2, 5); g.fillRect(4, -1, 2, 3);
    g.restore();
  }
};

/* =========================================================================
 * NHIỆM VỤ TRONG CA: 3 nhiệm vụ ngẫu nhiên phù hợp chế độ / bản đồ
 * ========================================================================= */
const MISSIONS = {
  list: [],
  sumViol(prefixes) { let n = 0; for (const k in G.tally.viol) if (prefixes.some(p => k.indexOf(p) === 0)) n += G.tally.viol[k]; return n; },
  POOL: [
    { id: 'helmet', text: 'Xử lý đúng 3 trường hợp không đội mũ bảo hiểm', need: 3, reward: 40, ok: c => c.mode !== 'car', count: () => MISSIONS.sumViol(['m_helmet', 'm_pass_helmet']) },
    { id: 'alc', text: 'Phát hiện 2 trường hợp vi phạm nồng độ cồn', need: 2, reward: 50, ok: c => c.shift.p.alcohol >= 0.05 || c.mode === 'car', count: () => MISSIONS.sumViol(['m_alc', 'c_alc']) },
    { id: 'docs', text: 'Phát hiện 3 lỗi về giấy tờ', need: 3, reward: 40, ok: () => true, count: () => MISSIONS.sumViol(['m_no', 'c_no']) },
    { id: 'load', text: 'Xử lý 2 xe quá tải hoặc quá khổ', need: 2, reward: 50, ok: c => c.mode === 'car' || c.shift.p.overload > 0, count: () => MISSIONS.sumViol(['c_load', 'c_height']) },
    { id: 'bus', text: 'Xử lý 1 xe khách chở quá số người', need: 1, reward: 40, ok: c => c.mode === 'car' || (c.shift.mix.bus || 0) > 0.02, count: () => MISSIONS.sumViol(['c_bus']) },
    { id: 'speed', text: 'Xử lý 2 xe chạy quá tốc độ', need: 2, reward: 40, ok: c => c.shift.radar, count: () => MISSIONS.sumViol(['m_speed', 'c_speed']) },
    { id: 'red', text: 'Xử lý 1 xe vượt đèn đỏ', need: 1, reward: 40, ok: c => c.mode !== 'car' && MAP.cur.inters.length > 0 && c.shift.p.runRed > 0.04, count: () => MISSIONS.sumViol(['m_redlight', 'c_redlight']) },
    { id: 'carry', text: 'Xử lý 2 xe máy chở quá số người', need: 2, reward: 40, ok: c => c.mode !== 'car' && c.shift.p.carry2 >= 0.08, count: () => MISSIONS.sumViol(['m_carry2']) },
    { id: 'event', text: 'Xử lý tốt 2 tình huống đặc biệt', need: 2, reward: 60, ok: () => EVENTS.plan.length >= 2, count: () => G.tally.events },
    { id: 'stops', text: 'Kiểm tra 6 phương tiện', need: 6, reward: 30, ok: () => true, count: () => G.stats.stops },
    { id: 'pass', text: 'Cho qua đúng 4 phương tiện không vi phạm', need: 4, reward: 30, ok: c => c.mode === 'cp' && !c.shift.checkpoint, count: () => G.stats.passOk },
    { id: 'clean', text: 'Không để lọt phương tiện vi phạm nào', need: 1, reward: 50, end: true, ok: () => true, count: () => (G.stats.escaped === 0 && G.stats.stops >= 3 ? 1 : 0) },
    { id: 'proc', text: 'Ứng xử chuẩn mực trong mọi lượt (ít nhất 4 lượt)', need: 1, reward: 40, end: true, ok: () => true, count: () => (G.stats.procBad === 0 && G.stats.stops >= 4 ? 1 : 0) }
  ],

  start(mode, shift) {
    const ctx = { mode: mode, shift: shift };
    const pool = U.shuffled(MISSIONS.POOL.filter(M => M.ok(ctx)));
    MISSIONS.list = pool.slice(0, 3).map(M => ({ def: M, done: false, cur: 0 }));
    MISSIONS.render();
  },

  check(final) {
    for (const m of MISSIONS.list) {
      if (m.done) continue;
      if (m.def.end && !final) continue;
      m.cur = Math.min(m.def.need, m.def.count());
      if (m.cur >= m.def.need) {
        m.done = true;
        G.addScore(m.def.reward);
        G.log.push({ plate: 'Nhiệm vụ', text: m.def.text, pts: m.def.reward });
        if (!final) { AUDIO.fanfare(); UI.toast('🎯 Hoàn thành nhiệm vụ: ' + m.def.text + ' (+' + m.def.reward + ')'); }
      }
    }
    MISSIONS.render();
  },

  render() {
    const el = UI.$('missions');
    if (!el) return;
    el.innerHTML = '<b>🎯 Nhiệm vụ</b>' + MISSIONS.list.map(m =>
      '<div class="' + (m.done ? 'done' : '') + '">' + (m.done ? '✔' : '○') + ' ' + U.esc(m.def.text) + (m.def.end ? '' : ' <i>' + m.cur + '/' + m.def.need + '</i>') + '</div>').join('');
  }
};
