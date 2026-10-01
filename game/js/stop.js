'use strict';
/* Quy trình dừng xe – kiểm tra – kết luận – chấm điểm; tình huống bỏ chạy; tai nạn */
const INSPECT = {
  ctx: null,

  GROUP_LABEL: {
    visible: 'Hành vi quan sát được', event: 'Tín hiệu giao thông', speed: 'Tốc độ (máy đo)',
    alcohol: 'Nồng độ cồn', docs: 'Giấy tờ'
  },

  vehName(v) { return v.kind === 'moto' ? 'Xe mô tô' : v.kind === 'car' ? 'Xe ô tô con' : v.kind === 'bus' ? 'Xe ô tô khách' : 'Xe ô tô tải'; },

  /* Bắt buộc đo nồng độ cồn: chốt theo kế hoạch hoặc chuyên đề tuần tra ô tô */
  mustTest(v) { return G.shift.checkpoint || (G.shift.scope === 'car' && v.veh === 'car'); },
  /* Chuyên đề tuần tra ô tô: được dừng ô tô để kiểm soát theo kế hoạch */
  planned(v) { return G.shift.checkpoint || (G.shift.scope === 'car' && v.veh === 'car'); },
  dec(n, d) { return n.toFixed(d).replace('.', ','); },

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
    if (PLAYER.veh) {
      AUDIO.siren();
      UI.toast('📢 Loa: "Xe biển số ' + v.plate + ', đề nghị giảm tốc độ, dừng xe vào lề bên phải!"');
    } else AUDIO.whistle();
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
      UI.feedback(body, o.ok, o.note, () => { UI.closeModal(); G.resume(); G.vehicleDone(v); });
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
    if (v.lane.wrong || v.wrongReport) html += '<div class="warn">⛔ Phương tiện đi ngược chiều trên đường một chiều' + (v.wrongReport ? ' (tổ công tác phía trước thông báo)' : '') + '.</div>';
    if (v.measured != null) html += '<div class="warn">📡 Máy đo tốc độ ghi nhận: <b>' + v.measured + ' km/h</b> (tốc độ tối đa cho phép ' + v.lane.limit + ' km/h).</div>';
    if (c.cue) html += '<div class="warn">🍺 Người điều khiển có hơi thở nồng mùi rượu bia, mặt đỏ.</div>';
    if (v.kind === 'truck') html += '<div>Xe tải: khối lượng hàng chuyên chở cho phép ' + v.capT + ' tấn (theo GCN kiểm định).</div>';
    if (v.kind === 'bus') html += '<div>Xe khách tuyến cố định (cự ly dưới 300 km), ' + v.busSeats + ' chỗ theo GCN kiểm định.</div>';
    TRAFFIC.signs(v).filter(x => /^(⚖|📏|🚌)/.test(x)).forEach(x => { html += '<div class="warn">' + U.esc(x) + '</div>'; });
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
      (G.shift.checkpoint ? '<i>Chốt kiểm tra theo kế hoạch: cần đo cho mọi người điều khiển.</i>' : INSPECT.mustTest(v) ? '<i>Chuyên đề nồng độ cồn: cần đo cho người điều khiển ô tô.</i>' : '<i>Không bắt buộc. Đo khi có dấu hiệu.</i>') + '</span></div>' +
      (v.kind === 'truck' ? '<h4>🚚 Kiểm tra tải trọng, kích thước</h4>' +
        '<div class="doc"><button class="btn sm" id="btnWeigh">⚖ Cân kiểm tra tải trọng</button> <span id="weighRes"></span></div>' +
        '<div class="doc"><button class="btn sm" id="btnHeight">📏 Đo chiều cao xếp hàng</button> <span id="heightRes"></span></div>' : '') +
      (v.kind === 'bus' ? '<h4>🚌 Kiểm tra xe khách</h4>' +
        '<div class="doc"><button class="btn sm" id="btnCount">👥 Kiểm đếm hành khách</button> <span id="countRes"></span></div>' : '');
    body.appendChild(docs);
    const lk = docs.querySelector('#btnLookup');
    if (lk) lk.onclick = () => {
      AUDIO.beep(); c.lookedUp = true; lk.disabled = true;
      docs.querySelector('#lookupRes').innerHTML = v.lic === 'forgot'
        ? '<span class="ok">Hệ thống: người này CÓ GPLX hạng ' + licClass + ' còn giá trị.</span>'
        : '<span class="bad">Hệ thống: KHÔNG tìm thấy GPLX của người này.</span>';
    };
    const bw = docs.querySelector('#btnWeigh');
    if (bw) bw.onclick = () => {
      bw.disabled = true; AUDIO.beep(); c.weighed = true;
      const act = v.capT * (1 + v.overPct / 100);
      docs.querySelector('#weighRes').innerHTML = 'Hàng chuyên chở thực tế: <b>' + INSPECT.dec(act, 2) + ' tấn</b> / cho phép ' + v.capT + ' tấn → <b class="' + (v.overPct > 10 ? 'bad' : 'ok') + '">' +
        (v.overPct > 0 ? 'vượt ' + v.overPct + '%' : 'không vượt') + '</b>';
    };
    const bh = docs.querySelector('#btnHeight');
    if (bh) bh.onclick = () => {
      bh.disabled = true; AUDIO.beep(); c.measuredH = true;
      docs.querySelector('#heightRes').innerHTML = 'Chiều cao xếp hàng: <b class="' + (v.height > v.heightLimit ? 'bad' : 'ok') + '">' + INSPECT.dec(v.height, 1) + ' m</b> (giới hạn cho phép đối với xe này: ' + INSPECT.dec(v.heightLimit, 1) + ' m)';
    };
    const bc = docs.querySelector('#btnCount');
    if (bc) bc.onclick = () => {
      bc.disabled = true; AUDIO.beep(); c.counted = true;
      docs.querySelector('#countRes').innerHTML = 'Số người trên xe (không kể lái xe, phụ xe): <b class="' + (v.busExcess ? 'bad' : 'ok') + '">' + v.busPeople + '</b> / ' + v.busSeats + ' chỗ';
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
        if (o.release) { c.released = true; UI.feedback(ev, false, o.note, () => INSPECT.finish([])); return; }
        UI.feedback(ev, o.ok, o.note, () => { btn.disabled = false; });
      });
    }
    next.appendChild(btn);
    body.appendChild(next);
  },

  /* ---------- BƯỚC 3: GHÉP BẰNG CHỨNG VỚI LỖI VÀ MỨC PHẠT ---------- */
  fineStr(id) { const V = DATA.VIOLATIONS[id]; return U.money(V.fine[0]) + ' – ' + U.money(V.fine[1]) + (V.perPerson ? '/người vượt' : ''); },

  /* Một lỗi khác cùng loại xe có khung phạt khác -> dùng làm đáp án nhiễu "sai mức phạt" */
  wrongFine(id) {
    const V = DATA.VIOLATIONS[id];
    const pool = Object.keys(DATA.VIOLATIONS).filter(k => {
      const W = DATA.VIOLATIONS[k];
      return W.veh === V.veh && (W.fine[0] !== V.fine[0] || W.fine[1] !== V.fine[1]);
    });
    pool.sort((a, b) => Math.abs(DATA.VIOLATIONS[a].fine[0] - V.fine[0]) - Math.abs(DATA.VIOLATIONS[b].fine[0] - V.fine[0]));
    return pool[Math.floor(Math.random() * Math.min(3, pool.length))];
  },

  /* Danh sách bằng chứng thu thập được sau khi quan sát + kiểm tra */
  evidence(c) {
    const v = c.v, P = v.veh === 'moto' ? 'm_' : 'c_', T = c.truth;
    const has = id => T.indexOf(id) >= 0;
    const rows = [];
    const add = (icon, text, cand, always) => {
      const correct = cand.find(has) || null;
      rows.push({ icon: icon, text: text, cand: cand, correct: correct, always: always });
    };
    if (v.veh === 'moto') {
      add('⛑', 'Người điều khiển: ' + (v.helmet ? 'có đội mũ bảo hiểm, cài quai đúng quy cách' : 'KHÔNG đội mũ bảo hiểm'), ['m_helmet'], true);
      if (v.pass >= 1) {
        add('👥', 'Số người trên xe: ' + (1 + v.pass) + ' người (kể cả người điều khiển)', ['m_carry2'], true);
        add('⛑', 'Người ngồi sau: ' + (v.passHelmet ? 'có đội mũ bảo hiểm' : 'KHÔNG đội mũ bảo hiểm'), ['m_pass_helmet'], true);
      }
    }
    if (v.phone) add('📱', 'Người điều khiển dùng tay cầm, sử dụng điện thoại khi đang lái xe', [P + 'phone'], true);
    if (v.lane.wrong || v.wrongReport) add('⛔', 'Phương tiện đi ngược chiều vào đường một chiều' + (v.wrongReport ? ' (tổ công tác phía trước thông báo)' : ''), ['m_wrongway'], true);
    if (v.redWitnessed) add('📷', 'Tổ công tác/camera ghi nhận phương tiện vượt đèn đỏ', [P + 'redlight'], true);
    if (v.measured != null) {
      const tiers = Object.keys(DATA.VIOLATIONS).filter(k => k.indexOf(P + 'speed') === 0);
      add('📡', 'Tốc độ đo được: ' + v.measured + ' km/h (tốc độ tối đa cho phép ' + v.lane.limit + ' km/h)', tiers, true);
    }
    if (c.tested) {
      add('🍺', 'Kết quả đo nồng độ cồn: ' + v.alc.toFixed(3).replace('.', ',') + ' mg/l khí thở', [P + 'alc1', P + 'alc2', P + 'alc3'], true);
    }
    if (c.weighed) {
      const act = v.capT * (1 + v.overPct / 100);
      add('⚖', 'Kết quả cân: hàng chuyên chở ' + INSPECT.dec(act, 2) + ' tấn / cho phép ' + v.capT + ' tấn (' + (v.overPct > 0 ? 'vượt ' + v.overPct + '%' : 'không vượt') + ')', ['c_load1', 'c_load2', 'c_load3', 'c_load4'], true);
    }
    if (c.measuredH) add('📏', 'Chiều cao xếp hàng ' + INSPECT.dec(v.height, 1) + ' m (giới hạn cho phép đối với xe này ' + INSPECT.dec(v.heightLimit, 1) + ' m)', ['c_height'], true);
    if (c.counted) add('👥', 'Xe khách ' + v.busSeats + ' chỗ, kiểm đếm được ' + v.busPeople + ' hành khách', ['c_bus_over'], true);
    let lic;
    if (v.lic === 'ok') lic = 'xuất trình bản giấy, còn giá trị';
    else if (v.lic === 'vneid') lic = 'xuất trình qua ứng dụng VNeID, hợp lệ';
    else if (c.lookedUp) lic = 'không xuất trình được; tra cứu CSDL: ' + (v.lic === 'forgot' ? 'CÓ GPLX hợp lệ' : 'KHÔNG có GPLX');
    else lic = 'không xuất trình được (chưa tra cứu CSDL)';
    add('🪪', 'Giấy phép lái xe: ' + lic, [P + 'nolicense', P + 'nocarry_lic'], false);
    add('📄', 'Chứng nhận đăng ký xe: ' + (v.reg === 'ok' ? 'có mang theo, khớp biển số' : 'không mang theo'), [P + 'nocarry_reg'], false);
    add('🛡', 'Bảo hiểm bắt buộc TNDS: ' + (v.ins === 'ok' ? 'còn hiệu lực' : v.ins === 'expired' ? 'ĐÃ HẾT HẠN' : 'không xuất trình được'), [P + 'noins'], false);
    /* giấy tờ hợp lệ: chỉ giữ 1 dòng làm câu nhiễu cho gọn */
    const okDocs = rows.filter(r => !r.always && !r.correct);
    const keepOk = okDocs.length ? okDocs[Math.floor(Math.random() * okDocs.length)] : null;
    const out = rows.filter(r => r.always || r.correct || r === keepOk);
    /* 3 phương án cho mỗi dòng */
    for (const r of out) {
      const opt = (id, fineId) => ({ id: id, fine: id ? (fineId || id) : null });
      let opts;
      if (r.correct) {
        const others = r.cand.filter(k => k !== r.correct);
        opts = [opt(r.correct), others.length ? opt(others[Math.floor(Math.random() * others.length)]) : opt(r.correct, INSPECT.wrongFine(r.correct)), opt(null)];
        if (others.length && Math.random() < 0.5) opts[2] = opt(r.correct, INSPECT.wrongFine(r.correct));
      } else if (r.cand.length > 1) {
        const sh = U.shuffled(r.cand);
        opts = [opt(null), opt(sh[0]), opt(sh[1])];
      } else {
        opts = [opt(null), opt(r.cand[0]), opt(r.cand[0], INSPECT.wrongFine(r.cand[0]))];
      }
      r.opts = U.shuffled(opts);
    }
    return out;
  },

  optLabel(o) {
    if (!o.id) return 'Không vi phạm';
    return U.esc(DATA.VIOLATIONS[o.id].name) + ' <span class="fineopt">' + INSPECT.fineStr(o.fine) + '</span>';
  },

  step3() {
    const c = INSPECT.ctx;
    c.rows = INSPECT.evidence(c);
    const box = UI.modal('Bước 3/3 · Kết luận theo bằng chứng', '');
    const body = box.querySelector('.m-body');
    const intro = document.createElement('p');
    intro.className = 'dim';
    intro.textContent = 'Với từng bằng chứng, chọn kết luận đúng: lỗi vi phạm và mức phạt tiền (Nghị định 168/2024/NĐ-CP), hoặc "Không vi phạm".';
    body.appendChild(intro);
    const form = document.createElement('div');
    form.className = 'evidence';
    let html = '';
    c.rows.forEach((r, i) => {
      html += '<fieldset><legend>' + r.icon + ' ' + U.esc(r.text) + '</legend>';
      r.opts.forEach((o, j) => {
        html += '<label><input type="radio" name="ev' + i + '" value="' + j + '"> ' + INSPECT.optLabel(o) + '</label>';
      });
      html += '</fieldset>';
    });
    form.innerHTML = html;
    body.appendChild(form);
    const row = document.createElement('div');
    row.className = 'row-end';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = 'Xác nhận kết luận ✔';
    btn.onclick = () => {
      const ans = [];
      for (let i = 0; i < c.rows.length; i++) {
        const el = form.querySelector('input[name=ev' + i + ']:checked');
        if (!el) { UI.toast('Còn bằng chứng chưa kết luận (dòng ' + (i + 1) + ')'); return; }
        ans.push(c.rows[i].opts[+el.value]);
      }
      AUDIO.click();
      INSPECT.finish(ans);
    };
    row.appendChild(btn);
    body.appendChild(row);
  },

  /* Lỗi có BẮT BUỘC phải phát hiện hay không (khi không có dòng bằng chứng) */
  required(id, c) {
    const V = DATA.VIOLATIONS[id];
    if (V.group === 'event') return c.v.redWitnessed;
    if (V.group === 'alcohol') return c.cue || INSPECT.mustTest(c.v);
    return true;
  },

  /* ---------- CHẤM ĐIỂM ---------- */
  finish(ans) {
    const c = INSPECT.ctx, v = c.v, sh = G.shift;
    const rows = c.released ? [] : (c.rows || []);
    let pts = c.pts, fmin = 0, fmax = 0, confirmed = 0;
    const res = [];
    rows.forEach((r, i) => {
      const a = ans[i];
      let st;
      if (a.id === r.correct && (!a.id || a.fine === r.correct)) {
        st = 'ok';
        if (r.correct) { pts += 20; G.stats.correct++; confirmed++; const F = DATA.fineOf(r.correct, v); fmin += F[0]; fmax += F[1]; }
        else { pts += 5; }
      } else if (r.correct && a.id === r.correct) { st = 'fine'; pts -= 10; G.stats.wrong++; confirmed++; }
      else if (r.correct) { st = 'miss'; pts -= 15; G.stats.missed++; if (a.id) confirmed++; }
      else { st = 'wrong'; pts -= 15; G.stats.wrong++; confirmed++; }
      res.push({ r: r, a: a, st: st });
    });
    /* lỗi có thật nhưng không có dòng bằng chứng */
    const covered = new Set(rows.map(r => r.correct).filter(Boolean));
    const extra = [];
    for (const id of c.truth) {
      if (covered.has(id)) continue;
      if (c.released || INSPECT.required(id, c)) {
        pts -= 15; G.stats.missed++;
        extra.push({ id: id, st: 'miss' });
      } else extra.push({ id: id, st: 'hidden' });
    }
    if (!c.released && extra.some(e => e.st === 'miss' && DATA.VIOLATIONS[e.id].group === 'alcohol')) {
      c.notes.push('✖ Có dấu hiệu sử dụng rượu bia nhưng chưa đo nồng độ cồn.');
    }
    if (!c.released && INSPECT.mustTest(v) && !c.tested && !c.truth.some(id => DATA.VIOLATIONS[id].group === 'alcohol')) {
      pts -= 10;
      c.notes.push(sh.checkpoint ? '✖ Tại chốt kiểm tra nồng độ cồn theo kế hoạch, phải đo nồng độ cồn người điều khiển.' : '✖ Tuần tra chuyên đề: phải đo nồng độ cồn người điều khiển ô tô.');
    }
    if (!INSPECT.planned(v) && TRAFFIC.visibleViolations(v).length === 0 && !v.weave && !c.cue) {
      pts -= 10;
      c.notes.push('✖ Dừng xe khi chưa phát hiện dấu hiệu vi phạm (ca này không có kế hoạch kiểm soát chung).');
    }
    if (!c.released) c.notes.push(confirmed ? '→ Lập biên bản vi phạm hành chính đối với các lỗi đã kết luận.' : '→ Không có vi phạm: cảm ơn, chúc thượng lộ bình an, cho phương tiện đi tiếp.');
    G.addScore(pts);
    G.stats.stops++;
    if (c.greetOk) G.stats.procOk++; else G.stats.procBad++;
    G.stats.fineMin += fmin; G.stats.fineMax += fmax;
    const nOk = res.filter(x => x.st === 'ok' && x.r.correct).length;
    const nBad = res.filter(x => x.st !== 'ok').length + extra.filter(e => e.st === 'miss').length;
    G.log.push({ plate: v.plate, text: nOk + ' lỗi kết luận đúng, ' + nBad + ' sai/bỏ sót', pts: pts });
    if (pts >= 0) AUDIO.good(); else AUDIO.bad();
    INSPECT.showResult(res, extra, pts, fmin, fmax);
  },

  showResult(res, extra, pts, fmin, fmax) {
    const c = INSPECT.ctx, v = c.v;
    const box = UI.modal('Kết quả xử lý · ' + v.plate, '');
    const body = box.querySelector('.m-body');
    const ST = { ok: ['✔', 'ok', 'Đúng'], fine: ['✖', 'bad', 'Đúng lỗi nhưng SAI mức phạt'], miss: ['✖', 'bad', 'Kết luận sai lỗi hoặc bỏ sót'], wrong: ['⚠', 'bad', 'Kết luận sai (không vi phạm)'], hidden: ['○', 'dim', 'Chưa phát hiện (không bắt buộc)'] };
    const law = id => {
      const V = DATA.VIOLATIONS[id];
      const tot = V.perPerson && v.busExcess ? ' (vượt ' + v.busExcess + ' người: ' + U.money(DATA.fineOf(id, v)[0]) + ' – ' + U.money(DATA.fineOf(id, v)[1]) + ')' : '';
      return '<b>' + U.esc(V.name) + '</b><div class="sub">' + INSPECT.fineStr(id) + tot + (V.extra ? ' · ' + U.esc(V.extra) : '') + ' · ' + U.esc(V.basis) + (V.verify ? ' ⚠' : '') + '</div>';
    };
    let html = '<table class="res-tbl"><tr><th></th><th>Bằng chứng</th><th>Kết luận đúng</th></tr>';
    for (const x of res) {
      const S = ST[x.st];
      html += '<tr class="' + S[1] + '"><td title="' + S[2] + '">' + S[0] + '</td><td>' + x.r.icon + ' ' + U.esc(x.r.text) +
        (x.st !== 'ok' ? '<div class="sub">Đồng chí chọn: ' + INSPECT.optLabel(x.a) + '</div>' : '') + '<div class="sub">' + S[2] + '</div></td><td>' +
        (x.r.correct ? law(x.r.correct) : 'Không vi phạm') + '</td></tr>';
    }
    for (const e of extra) {
      const S = ST[e.st];
      html += '<tr class="' + S[1] + '"><td>' + S[0] + '</td><td><i>Không có bằng chứng</i><div class="sub">' + S[2] + '</div></td><td>' + law(e.id) + '</td></tr>';
    }
    html += '</table>';
    if (!res.length && !extra.length) html = '<p>Phương tiện không có vi phạm.</p>';
    if (fmax > 0) html += '<p class="fine">Tổng mức phạt các lỗi kết luận đúng: <b>' + U.money(fmin) + ' – ' + U.money(fmax) + '</b></p>';
    html += '<ul class="notes">' + c.notes.map(n => '<li>' + U.esc(n) + '</li>').join('') + '</ul>';
    html += '<p class="pts ' + (pts >= 0 ? 'ok' : 'bad') + '">Điểm lượt này: ' + (pts >= 0 ? '+' : '') + pts + '</p>';
    body.innerHTML = html;
    const row = document.createElement('div');
    row.className = 'row-end';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = 'Tiếp tục ▶';
    btn.onclick = () => {
      AUDIO.click();
      UI.closeModal();
      v.state = 'leave';
      G.timeLeft = Math.max(0, G.timeLeft - 6);
      G.resume();
      G.vehicleDone(v);
    };
    row.appendChild(btn);
    body.appendChild(row);
    btn.focus();
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
