'use strict';
/* Quy trình dừng xe – kiểm tra – kết luận – chấm điểm; tình huống bỏ chạy; tai nạn */
const INSPECT = {
  ctx: null,

  GROUP_LABEL: {
    visible: 'Hành vi quan sát được', event: 'Tín hiệu giao thông', speed: 'Tốc độ (máy đo)',
    alcohol: 'Nồng độ cồn', docs: 'Giấy tờ'
  },

  vehName(v) { return v.kind === 'moto' ? 'Xe mô tô' : v.kind === 'car' ? 'Xe ô tô con' : 'Xe ô tô tải'; },

  zoomCanvas(v, scale) {
    const cv = document.createElement('canvas');
    cv.width = (v.len + 2) * scale; cv.height = (v.wid + 2) * scale;
    cv.className = 'zoom';
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(v.spr, 0, 0, cv.width, cv.height);
    return cv;
  },

  dateStr(offsetDays) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return U.pad(d.getDate()) + '/' + U.pad(d.getMonth() + 1) + '/' + d.getFullYear();
  },

  /* ---------- BẮT ĐẦU: ra hiệu lệnh dừng xe ---------- */
  command(v) {
    AUDIO.whistle();
    v.stopped = true;
    if (v.flee) {
      v.state = 'flee';
      G.pause('flee');
      INSPECT.fleeModal(v);
      return;
    }
    v.state = 'pullover';
    G.pendingStop = v;
  },

  fleeModal(v) {
    const opts = U.shuffled(DATA.FLEE.options);
    const box = UI.modal('⚠ Phương tiện bỏ chạy', '');
    const body = box.querySelector('.m-body');
    body.appendChild(INSPECT.zoomCanvas(v, 5));
    const p = document.createElement('p');
    p.innerHTML = '<b>' + U.esc(INSPECT.vehName(v)) + ' ' + U.esc(v.plate) + '</b>: ' + U.esc(DATA.FLEE.say);
    body.appendChild(p);
    UI.choices(body, opts, o => {
      G.addScore(o.pts);
      G.stats.stops++;
      if (o.ok) { AUDIO.good(); G.stats.procOk++; } else { AUDIO.bad(); G.stats.procBad++; }
      G.log.push({ plate: v.plate, text: 'Bỏ chạy: ' + (o.ok ? 'xử lý đúng' : 'xử lý sai'), pts: o.pts });
      UI.feedback(body, o.ok, o.note, () => { UI.closeModal(); G.resume(); });
    });
  },

  /* ---------- BƯỚC 1: TIẾP CẬN ---------- */
  begin(v) {
    const sh = G.shift;
    const c = INSPECT.ctx = { v: v, pts: 0, notes: [], lookedUp: false, tested: false, reactDone: v.react === 'coop', released: false };
    c.truth = TRAFFIC.truth(v, sh);
    c.cue = DATA.alcoholLevel(v.alc) >= 2;
    G.pause('inspect');
    const box = UI.modal('Bước 1/3 · Tiếp cận phương tiện', '');
    const body = box.querySelector('.m-body');
    body.appendChild(INSPECT.zoomCanvas(v, 6));
    const info = document.createElement('div');
    info.className = 'info';
    let html = '<div><b>' + INSPECT.vehName(v) + '</b> · Biển số <b class="plate">' + U.esc(v.plate) + '</b></div>' +
      '<div>Người điều khiển: ' + U.esc(v.driver.name) + ', ' + v.driver.age + ' tuổi</div>';
    if (v.pass) html += '<div>Trên xe có thêm ' + v.pass + ' người ngồi sau.</div>';
    if (v.redWitnessed) html += '<div class="warn">📷 Tổ công tác đã ghi nhận phương tiện vượt đèn đỏ.</div>';
    if (v.lane.wrong) html += '<div class="warn">⛔ Phương tiện đi ngược chiều trên đường một chiều.</div>';
    if (v.measured != null) html += '<div class="warn">📡 Máy đo tốc độ ghi nhận: <b>' + v.measured + ' km/h</b> (tốc độ tối đa cho phép ' + v.lane.limit + ' km/h).</div>';
    if (c.cue) html += '<div class="warn">🍺 Người điều khiển có hơi thở nồng mùi rượu bia, mặt đỏ.</div>';
    if (v.weave) html += '<div class="warn">〰 Phương tiện chạy lạng lách, không vững tay lái.</div>';
    info.innerHTML = html;
    body.appendChild(info);
    const q = document.createElement('p');
    q.className = 'q';
    q.textContent = 'Đồng chí tiếp cận người điều khiển như thế nào?';
    body.appendChild(q);
    UI.choices(body, U.shuffled(DATA.GREETINGS), o => {
      c.pts += o.pts;
      c.greetOk = o.ok;
      c.notes.push((o.ok ? '✔ ' : '✖ ') + o.note);
      if (o.ok) AUDIO.good(); else AUDIO.bad();
      UI.feedback(body, o.ok, o.note, () => INSPECT.step2());
    });
  },

  /* ---------- BƯỚC 2: KIỂM TRA ---------- */
  step2() {
    const c = INSPECT.ctx, v = c.v;
    const box = UI.modal('Bước 2/3 · Kiểm tra giấy tờ, nồng độ cồn', '');
    const body = box.querySelector('.m-body');
    const docs = document.createElement('div');
    docs.className = 'docs';
    const licClass = v.veh === 'moto' ? 'A1' : 'B';
    const licNo = U.int(10, 99) + '0' + U.int(1000000, 9999999);
    let licHtml;
    if (v.lic === 'ok') licHtml = '<span class="ok">✔</span> GPLX hạng ' + licClass + ' số ' + licNo + ' (bản giấy), còn giá trị.';
    else if (v.lic === 'vneid') licHtml = '<span class="ok">✔</span> Xuất trình GPLX hạng ' + licClass + ' qua ứng dụng <b>VNeID</b>, thông tin hợp lệ.';
    else {
      const honest = v.lic === 'none' && U.chance(0.4);
      licHtml = '<span class="bad">✖</span> Không xuất trình được GPLX. Người điều khiển nói: <i>"' +
        (honest ? 'Em... em chưa thi bằng lái ạ.' : U.pick(['Em để quên ở nhà rồi anh ạ.', 'Em để trong cốp xe khác mất rồi.', 'Ví em để ở nhà anh ơi.'])) + '"</i>';
      licHtml += ' <button class="btn sm" id="btnLookup">🔎 Tra cứu CSDL GPLX</button><div id="lookupRes"></div>';
    }
    const regHtml = v.reg === 'ok'
      ? '<span class="ok">✔</span> Chứng nhận đăng ký xe, biển số khớp.'
      : '<span class="bad">✖</span> Không mang theo chứng nhận đăng ký xe.';
    let insHtml;
    if (v.ins === 'ok') insHtml = '<span class="ok">✔</span> GCN bảo hiểm bắt buộc TNDS, hiệu lực đến ' + INSPECT.dateStr(U.int(20, 330)) + '.';
    else if (v.ins === 'expired') insHtml = '<span class="bad">✖</span> GCN bảo hiểm bắt buộc TNDS <b>đã hết hạn</b> từ ' + INSPECT.dateStr(-U.int(5, 200)) + '.';
    else insHtml = '<span class="bad">✖</span> Không xuất trình được GCN bảo hiểm bắt buộc TNDS.';
    docs.innerHTML =
      '<h4>📄 Giấy tờ</h4>' +
      '<div class="doc">Giấy phép lái xe: ' + licHtml + '</div>' +
      '<div class="doc">Đăng ký xe: ' + regHtml + '</div>' +
      '<div class="doc">Bảo hiểm: ' + insHtml + '</div>' +
      '<h4>🍺 Nồng độ cồn</h4>' +
      '<div class="doc"><button class="btn sm" id="btnAlc">Đo nồng độ cồn</button> <span id="alcRes">' +
      (G.shift.checkpoint ? '<i>Chốt kiểm tra theo kế hoạch: cần đo cho mọi người điều khiển.</i>' : '<i>Không bắt buộc. Đo khi có dấu hiệu.</i>') + '</span></div>';
    body.appendChild(docs);
    const lk = docs.querySelector('#btnLookup');
    if (lk) lk.onclick = () => {
      AUDIO.beep(); c.lookedUp = true; lk.disabled = true;
      docs.querySelector('#lookupRes').innerHTML = v.lic === 'forgot'
        ? '<span class="ok">Hệ thống: người này CÓ GPLX hạng ' + licClass + ' còn giá trị.</span>'
        : '<span class="bad">Hệ thống: KHÔNG tìm thấy GPLX của người này.</span>';
    };
    const ab = docs.querySelector('#btnAlc');
    ab.onclick = () => {
      ab.disabled = true; AUDIO.beep(); c.tested = true;
      const res = docs.querySelector('#alcRes');
      res.innerHTML = '<i>Đang đo...</i>';
      setTimeout(() => {
        const val = v.alc.toFixed(3).replace('.', ',');
        res.innerHTML = 'Kết quả: <b class="' + (v.alc > 0 ? 'bad' : 'ok') + '">' + val + ' mg/l khí thở</b>';
      }, 700);
    };
    /* tình huống ứng xử */
    const next = document.createElement('div');
    next.className = 'row-end';
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Kết luận vi phạm →';
    btn.onclick = () => { AUDIO.click(); INSPECT.step3(); };
    if (v.react !== 'coop') {
      const R = DATA.REACTIONS[v.react];
      const ev = document.createElement('div');
      ev.className = 'event';
      ev.innerHTML = '<h4>💬 Tình huống</h4><p class="say">' + U.esc(U.pick(R.say)) + '</p>';
      body.appendChild(ev);
      btn.disabled = true;
      UI.choices(ev, U.shuffled(R.options), o => {
        c.pts += o.pts;
        c.notes.push((o.ok ? '✔ ' : '✖ ') + o.note);
        if (o.integrity) G.stats.bribeRefused++;
        if (o.ok) { AUDIO.good(); G.stats.procOk++; } else { AUDIO.bad(); G.stats.procBad++; }
        if (o.fail) { UI.feedback(ev, false, o.note, () => { UI.closeModal(); G.endShift('bribe'); }); return; }
        if (o.release) { c.released = true; UI.feedback(ev, false, o.note, () => INSPECT.finish([], null)); return; }
        UI.feedback(ev, o.ok, o.note, () => { btn.disabled = false; });
      });
    }
    next.appendChild(btn);
    body.appendChild(next);
  },

  /* ---------- BƯỚC 3: KẾT LUẬN ---------- */
  step3() {
    const c = INSPECT.ctx, v = c.v, sh = G.shift;
    const box = UI.modal('Bước 3/3 · Xác định lỗi vi phạm và xử lý', '');
    const body = box.querySelector('.m-body');
    const form = document.createElement('div');
    form.className = 'checklist';
    const groups = {};
    for (const id in DATA.VIOLATIONS) {
      const V = DATA.VIOLATIONS[id];
      if (V.veh !== v.veh) continue;
      if (V.group === 'speed' && !sh.radar) continue;
      if (V.group === 'event' && MAP.cur.kind !== 'city') continue;
      if (id === 'm_wrongway' && MAP.cur.kind !== 'city') continue;
      (groups[V.group] = groups[V.group] || []).push(id);
    }
    const order = ['visible', 'event', 'speed', 'alcohol', 'docs'];
    let html = '';
    for (const gname of order) {
      if (!groups[gname]) continue;
      html += '<fieldset><legend>' + INSPECT.GROUP_LABEL[gname] + '</legend>';
      const radio = gname === 'speed' || gname === 'alcohol';
      if (radio) html += '<label><input type="radio" name="r_' + gname + '" value="" checked> Không vi phạm</label>';
      for (const id of groups[gname]) {
        const V = DATA.VIOLATIONS[id];
        html += '<label><input type="' + (radio ? 'radio' : 'checkbox') + '" name="' + (radio ? 'r_' + gname : 'c_' + id) + '" value="' + id + '"> ' + U.esc(V.name) + '</label>';
      }
      html += '</fieldset>';
    }
    html += '<fieldset class="res"><legend>Hình thức xử lý</legend>' +
      '<label><input type="radio" name="res" value="record"> Lập biên bản vi phạm hành chính</label>' +
      '<label><input type="radio" name="res" value="free"> Không phát hiện vi phạm: cảm ơn, cho phương tiện đi tiếp</label></fieldset>';
    form.innerHTML = html;
    body.appendChild(form);
    const row = document.createElement('div');
    row.className = 'row-end';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = 'Xác nhận ✔';
    btn.onclick = () => {
      const res = form.querySelector('input[name=res]:checked');
      if (!res) { UI.toast('Chọn hình thức xử lý'); return; }
      const picked = [];
      form.querySelectorAll('input:checked').forEach(i => { if (i.name !== 'res' && i.value) picked.push(i.value); });
      AUDIO.click();
      INSPECT.finish(picked, res.value);
    };
    row.appendChild(btn);
    body.appendChild(row);
  },

  /* Lỗi nào người chơi PHẢI phát hiện được */
  required(id, c) {
    const v = c.v, V = DATA.VIOLATIONS[id];
    if (V.group === 'event') return v.redWitnessed;
    if (V.group === 'alcohol') return c.tested || c.cue || G.shift.checkpoint;
    return true;
  },

  /* ---------- CHẤM ĐIỂM ---------- */
  finish(picked, resolution) {
    const c = INSPECT.ctx, v = c.v, sh = G.shift;
    const truth = c.truth;
    const rows = [];
    let pts = c.pts, anyFound = false;
    const all = new Set(truth.concat(picked));
    for (const id of all) {
      const inT = truth.indexOf(id) >= 0, inP = picked.indexOf(id) >= 0, req = INSPECT.required(id, c);
      let st;
      if (inT && inP) { st = 'ok'; pts += 20; G.stats.correct++; anyFound = true; }
      else if (inT && !inP && req) { st = 'miss'; pts -= 15; G.stats.missed++; anyFound = true; }
      else if (inT && !inP) { st = 'hidden'; }
      else { st = 'wrong'; pts -= 20; G.stats.wrong++; }
      rows.push({ id: id, st: st });
    }
    if (!c.released) {
      const wantRecord = anyFound;
      const ok = (resolution === 'record') === wantRecord;
      pts += ok ? 10 : -10;
      c.notes.push(ok ? '✔ Hình thức xử lý phù hợp.' : (wantRecord ? '✖ Có vi phạm nhưng không lập biên bản.' : '✖ Không có vi phạm nhưng lại lập biên bản.'));
    }
    if (G.shift.checkpoint && !c.tested) {
      pts -= 10;
      c.notes.push('✖ Tại chốt kiểm tra nồng độ cồn theo kế hoạch, phải đo nồng độ cồn người điều khiển.');
    }
    if (!sh.checkpoint && TRAFFIC.visibleViolations(v).length === 0 && !v.weave && !c.cue) {
      pts -= 10;
      c.notes.push('✖ Dừng xe khi chưa phát hiện dấu hiệu vi phạm (ca này không có kế hoạch kiểm soát chung).');
    }
    G.addScore(pts);
    G.stats.stops++;
    if (c.greetOk) G.stats.procOk++; else G.stats.procBad++;
    /* mức phạt các lỗi đã lập biên bản đúng */
    let fmin = 0, fmax = 0;
    for (const r of rows) if (r.st === 'ok') { fmin += DATA.VIOLATIONS[r.id].fine[0]; fmax += DATA.VIOLATIONS[r.id].fine[1]; }
    G.stats.fineMin += fmin; G.stats.fineMax += fmax;
    G.log.push({ plate: v.plate, text: rows.filter(r => r.st === 'ok').length + ' lỗi đúng, ' + rows.filter(r => r.st === 'miss').length + ' bỏ sót, ' + rows.filter(r => r.st === 'wrong').length + ' sai', pts: pts });
    if (pts >= 0) AUDIO.good(); else AUDIO.bad();
    INSPECT.showResult(rows, pts, fmin, fmax);
  },

  showResult(rows, pts, fmin, fmax) {
    const c = INSPECT.ctx, v = c.v;
    const box = UI.modal('Kết quả xử lý · ' + v.plate, '');
    const body = box.querySelector('.m-body');
    const ICON = { ok: ['✔', 'ok', 'Xác định đúng'], miss: ['✖', 'bad', 'Bỏ sót'], wrong: ['⚠', 'bad', 'Kết luận sai (không vi phạm)'], hidden: ['○', 'dim', 'Chưa phát hiện (không bắt buộc)'] };
    let html = '';
    if (!rows.length) html += '<p>Phương tiện không có vi phạm.</p>';
    else {
      html += '<table class="res-tbl"><tr><th></th><th>Hành vi</th><th>Mức phạt / Căn cứ (NĐ 168/2024)</th></tr>';
      for (const r of rows) {
        const V = DATA.VIOLATIONS[r.id], I = ICON[r.st];
        html += '<tr class="' + I[1] + '"><td title="' + I[2] + '">' + I[0] + '</td><td>' + U.esc(V.name) + '<div class="sub">' + I[2] + '</div></td><td>' +
          U.money(V.fine[0]) + ' – ' + U.money(V.fine[1]) + (V.extra ? '<div class="sub">' + U.esc(V.extra) + '</div>' : '') +
          '<div class="sub">' + U.esc(V.basis) + (V.verify ? ' ⚠' : '') + '</div></td></tr>';
      }
      html += '</table>';
    }
    if (fmax > 0) html += '<p class="fine">Tổng mức phạt theo các lỗi xác định đúng: <b>' + U.money(fmin) + ' – ' + U.money(fmax) + '</b></p>';
    html += '<ul class="notes">' + c.notes.map(n => '<li>' + U.esc(n) + '</li>').join('') + '</ul>';
    html += '<p class="pts ' + (pts >= 0 ? 'ok' : 'bad') + '">Điểm lượt này: ' + (pts >= 0 ? '+' : '') + pts + '</p>';
    body.innerHTML = html;
    const row = document.createElement('div');
    row.className = 'row-end';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = 'Tiếp tục tuần tra ▶';
    btn.onclick = () => {
      AUDIO.click();
      UI.closeModal();
      v.state = 'leave';
      G.timeLeft = Math.max(0, G.timeLeft - 6);
      G.resume();
    };
    row.appendChild(btn);
    body.appendChild(row);
  },

  /* ---------- TAI NẠN GIAO THÔNG ---------- */
  accident() {
    G.pause('accident');
    const box = UI.modal('🚑 Xử lý vụ tai nạn giao thông', '');
    const body = box.querySelector('.m-body');
    let i = 0, total = 0;
    const ask = () => {
      body.innerHTML = '';
      const Q = DATA.ACCIDENT[i];
      const p = document.createElement('p');
      p.className = 'q';
      p.textContent = (i + 1) + '/' + DATA.ACCIDENT.length + '. ' + Q.q;
      body.appendChild(p);
      UI.choices(body, U.shuffled(Q.options), o => {
        const d = o.ok ? 20 : -10;
        total += d;
        if (o.ok) AUDIO.good(); else AUDIO.bad();
        UI.feedback(body, o.ok, o.ok ? 'Chính xác!' : o.note, () => {
          i++;
          if (i < DATA.ACCIDENT.length) ask();
          else {
            G.addScore(total);
            G.stats.accident = total;
            G.log.push({ plate: 'Tai nạn', text: 'Xử lý hiện trường', pts: total });
            G.clearAccident();
            body.innerHTML = '<p>Hoàn thành xử lý hiện trường. Điểm: <b class="' + (total >= 0 ? 'ok' : 'bad') + '">' + (total >= 0 ? '+' : '') + total + '</b></p>';
            const row = document.createElement('div');
            row.className = 'row-end';
            const b = document.createElement('button');
            b.className = 'btn primary'; b.textContent = 'Tiếp tục ▶';
            b.onclick = () => { UI.closeModal(); G.resume(); };
            row.appendChild(b); body.appendChild(row);
          }
        });
      });
    };
    ask();
  }
};
