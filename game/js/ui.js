'use strict';
/* Giao diện DOM: menu, hộp thoại, HUD, thẻ quan sát, tổng kết, sổ tay */
const UI = {
  $(id) { return document.getElementById(id); },

  /* ---------------- HỘP THOẠI ---------------- */
  modal(title, html) {
    const m = UI.$('modal');
    m.classList.remove('hidden');
    m.innerHTML = '<div class="m-box"><h3 class="m-title">' + U.esc(title) + '</h3><div class="m-body">' + html + '</div></div>';
    m.scrollTop = 0;
    return m.querySelector('.m-box');
  },
  closeModal() { const m = UI.$('modal'); m.classList.add('hidden'); m.innerHTML = ''; },
  isModal() { return !UI.$('modal').classList.contains('hidden'); },

  choices(parent, opts, cb) {
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'btn choice';
      b.innerHTML = '<span class="k">' + (i + 1) + '</span> ' + U.esc(o.t);
      b.onclick = () => {
        wrap.querySelectorAll('button').forEach(x => { x.disabled = true; });
        b.classList.add(o.ok ? 'picked-ok' : 'picked-bad');
        cb(o);
      };
      wrap.appendChild(b);
    });
    parent.appendChild(wrap);
    return wrap;
  },

  feedback(parent, ok, note, next) {
    const d = document.createElement('div');
    d.className = 'fb ' + (ok ? 'ok' : 'bad');
    d.innerHTML = '<b>' + (ok ? '✔ Đúng.' : '✖ Chưa đúng.') + '</b> ' + U.esc(note || '');
    const b = document.createElement('button');
    b.className = 'btn primary sm';
    b.textContent = 'Tiếp →';
    b.onclick = () => { AUDIO.click(); b.remove(); next(); };
    d.appendChild(b);
    parent.appendChild(d);
    b.focus();
  },

  toast(msg, cls) {
    const t = UI.$('toast');
    const d = document.createElement('div');
    d.className = 't ' + (cls || '');
    d.textContent = msg;
    t.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3200);
  },

  dialogSeq(speaker, lines, done) {
    let i = 0;
    const show = () => {
      const box = UI.modal('💬 ' + speaker, '');
      const body = box.querySelector('.m-body');
      body.innerHTML = '<div class="npc"><canvas class="face" width="16" height="16"></canvas><p>' + U.esc(lines[i]) + '</p></div>';
      UI.drawCaptain(body.querySelector('canvas'));
      const row = document.createElement('div');
      row.className = 'row-end';
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = i < lines.length - 1 ? 'Tiếp (' + (i + 1) + '/' + lines.length + ') →' : 'Bắt đầu tuần tra ▶';
      b.onclick = () => { AUDIO.click(); i++; if (i < lines.length) show(); else { UI.closeModal(); done(); } };
      row.appendChild(b);
      if (i < lines.length - 1) {
        const s = document.createElement('button');
        s.className = 'btn sm'; s.textContent = 'Bỏ qua';
        s.onclick = () => { UI.closeModal(); done(); };
        row.insertBefore(s, b);
      }
      body.appendChild(row);
      b.focus();
    };
    show();
  },

  drawCaptain(cv) {
    const g = cv.getContext('2d');
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    r(0, 0, 16, 16, '#243b55');
    r(3, 5, 10, 8, '#f1c27d');
    r(2, 1, 12, 4, '#2f5d34'); r(2, 4, 12, 1, '#c0392b'); r(7, 2, 2, 1, '#ffd23f'); r(1, 5, 14, 1, '#1b3a1f');
    r(5, 8, 1, 1, '#111'); r(10, 8, 1, 1, '#111'); r(6, 11, 4, 1, '#a0522d');
    r(2, 13, 12, 3, '#d8b24a'); r(7, 13, 2, 3, '#b8923a');
  },

  /* ---------------- MÀN HÌNH ---------------- */
  screen(html) {
    const s = UI.$('screen');
    s.innerHTML = html;
    s.classList.remove('hidden');
    s.scrollTop = 0;
    return s;
  },
  hideScreen() { UI.$('screen').classList.add('hidden'); },

  title() {
    G.attract();
    UI.hud(false);
    const rk = SAVE.rank();
    const next = rk.next ? ' · còn ' + (rk.next.xp - SAVE.data.xp) + ' XP lên ' + rk.next.name : '';
    const today = U.dateSeed();
    const db = SAVE.data.dailyBest[today];
    const s = UI.screen(
      '<div class="panel title">' +
      '<div class="badge"><canvas id="badgeCv" width="24" height="24"></canvas></div>' +
      '<h1>CSGT<span>CA TUẦN TRA</span></h1>' +
      '<p class="rank">🎖 ' + rk.cur.name + ' · ' + SAVE.data.xp + ' XP' + next + '</p>' +
      '<p class="dim">Chế độ: <b>' + DATA.MODES[SAVE.data.mode || 'cp'].name + '</b> (đổi trong "Chọn ca tuần tra")</p>' +
      '<div class="menu">' +
      '<button class="btn primary" data-a="shifts">▶ Chọn ca tuần tra</button>' +
      '<button class="btn" data-a="free">🎲 Tuần tra tự do</button>' +
      '<button class="btn" data-a="daily">📅 Thử thách hôm nay' + (db != null ? ' · kỷ lục ' + db : '') + '</button>' +
      '<button class="btn" data-a="book">📘 Sổ tay pháp luật</button>' +
      '<button class="btn" data-a="help">❔ Hướng dẫn chơi</button>' +
      '<button class="btn" data-a="sound">' + (SAVE.data.sound ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt') + '</button>' +
      '</div>' +
      '<p class="tip">💡 ' + U.esc(DATA.TIPS[Math.floor(Math.random() * DATA.TIPS.length)]) + '</p>' +
      '</div>');
    UI.drawBadge(UI.$('badgeCv'));
    s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      AUDIO.init(); AUDIO.click();
      const a = b.dataset.a;
      if (a === 'shifts') UI.shifts();
      else if (a === 'free') G.start(DATA.makeFreeShift(U.rng(Date.now() & 0xffffffff), false), Date.now() & 0xffffffff);
      else if (a === 'daily') G.start(DATA.makeFreeShift(U.rng(today), true), today);
      else if (a === 'book') UI.handbook(UI.title);
      else if (a === 'help') UI.help(UI.title);
      else if (a === 'sound') { SAVE.data.sound = !SAVE.data.sound; SAVE.store(); UI.title(); }
    });
    const first = s.querySelector('.btn.primary'); if (first) first.focus();
  },

  drawBadge(cv) {
    const g = cv.getContext('2d');
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    r(4, 2, 16, 18, '#c0392b'); r(6, 20, 12, 2, '#c0392b'); r(9, 22, 6, 2, '#c0392b');
    r(6, 4, 12, 14, '#e84a3b'); r(8, 18, 8, 2, '#e84a3b');
    const star = [[11, 6, 2, 2], [10, 8, 4, 2], [7, 10, 10, 2], [9, 12, 6, 2], [8, 14, 3, 2], [13, 14, 3, 2]];
    star.forEach(a => r(a[0], a[1], a[2], a[3], '#ffd23f'));
  },

  shifts() {
    const md = SAVE.data.mode || 'cp';
    let html = '<div class="panel mid"><h2>Chọn ca tuần tra</h2>' +
      '<div class="modes">' + Object.keys(DATA.MODES).map(k => '<button class="mode ' + (k === md ? 'on' : '') + '" data-m="' + k + '"><b>' + DATA.MODES[k].icon + ' ' + DATA.MODES[k].name + '</b><span>' + DATA.MODES[k].desc + '</span></button>').join('') + '</div>' +
      '<div class="shifts">';
    for (const sh of DATA.SHIFTS) {
      const un = SAVE.unlocked(sh.id), st = SAVE.data.stars[sh.id] || 0, best = SAVE.data.best[sh.id];
      html += '<button class="shift ' + (un ? '' : 'locked') + '" data-id="' + sh.id + '"' + (un ? '' : ' disabled') + '>' +
        '<div class="s-top"><b>' + U.esc(sh.name) + '</b><span class="stars">' + '★'.repeat(st) + '<i>' + '★'.repeat(3 - st) + '</i></span></div>' +
        '<div class="s-desc">' + (un ? U.esc(sh.desc) : '🔒 Đạt ít nhất 1 sao ở ca trước để mở khóa.') + '</div>' +
        '<div class="s-meta">⏰ ' + sh.time + ' · ' + Math.round(sh.duration / 60 * 10) / 10 + ' phút' + (best != null ? ' · Kỷ lục: ' + best : '') + '</div>' +
        '</button>';
    }
    html += '</div><div class="row-end"><button class="btn" data-a="back">← Quay lại</button></div></div>';
    const s = UI.screen(html);
    s.querySelectorAll('.mode[data-m]').forEach(b => b.onclick = () => { AUDIO.click(); SAVE.data.mode = b.dataset.m; SAVE.store(); UI.shifts(); });
    s.querySelectorAll('.shift[data-id]').forEach(b => b.onclick = () => {
      AUDIO.click();
      const sh = DATA.SHIFTS.find(x => x.id === +b.dataset.id);
      G.start(sh, Date.now() & 0xffffffff);
    });
    s.querySelector('[data-a=back]').onclick = () => { AUDIO.click(); UI.title(); };
  },

  handbook(back) {
    const tbl = veh => {
      let h = '<table class="book"><tr><th>Hành vi vi phạm</th><th>Mức phạt tiền</th><th>Bổ sung</th><th>Căn cứ</th></tr>';
      for (const id in DATA.VIOLATIONS) {
        const V = DATA.VIOLATIONS[id];
        if (V.veh !== veh) continue;
        h += '<tr><td>' + U.esc(V.name) + '</td><td class="nw">' + U.money(V.fine[0]) + '<br>– ' + U.money(V.fine[1]) + '</td><td>' + U.esc(V.extra || '—') + '</td><td>' + U.esc(V.basis) + (V.verify ? ' <span class="vf" title="Cần đối chiếu văn bản gốc">⚠</span>' : '') + '</td></tr>';
      }
      return h + '</table>';
    };
    const proc =
      '<ol class="proc">' +
      '<li><b>Phát hiện:</b> quan sát trực tiếp hoặc qua phương tiện, thiết bị kỹ thuật (máy đo tốc độ, camera).</li>' +
      '<li><b>Dừng phương tiện:</b> ra hiệu lệnh rõ ràng, bảo đảm an toàn. Chỉ dừng khi phát hiện vi phạm hoặc theo kế hoạch kiểm soát.</li>' +
      '<li><b>Tiếp cận:</b> chào theo điều lệnh, thông báo lý do dừng phương tiện.</li>' +
      '<li><b>Kiểm soát:</b> giấy tờ (bản giấy hoặc qua ứng dụng VNeID), nồng độ cồn, phương tiện.</li>' +
      '<li><b>Kết luận & xử lý:</b> xác định đúng hành vi, căn cứ; lập biên bản khi có vi phạm.</li>' +
      '<li><b>Ứng xử:</b> chuẩn mực, kiên quyết từ chối mọi hình thức hối lộ, không nể nang quen biết.</li>' +
      '</ol>' +
      '<p class="dim">Tham khảo: Luật Trật tự, an toàn giao thông đường bộ 2024; Thông tư 73/2024/TT-BCA quy định công tác tuần tra, kiểm soát, xử lý vi phạm pháp luật về trật tự, an toàn giao thông đường bộ của CSGT.</p>';
    const s = UI.screen(
      '<div class="panel wide"><h2>📘 Sổ tay pháp luật</h2>' +
      '<div class="tabs"><button class="tab on" data-t="moto">Xe mô tô, xe máy</button><button class="tab" data-t="car">Xe ô tô</button><button class="tab" data-t="proc">Quy trình</button></div>' +
      '<div id="bookBody">' + tbl('moto') + '</div>' +
      '<p class="legal">' + U.esc(DATA.LEGAL_NOTE) + '</p>' +
      '<div class="row-end"><button class="btn" data-a="back">← Quay lại</button></div></div>');
    s.querySelectorAll('.tab').forEach(t => t.onclick = () => {
      AUDIO.click();
      s.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      UI.$('bookBody').innerHTML = t.dataset.t === 'proc' ? proc : tbl(t.dataset.t);
    });
    s.querySelector('[data-a=back]').onclick = () => { AUDIO.click(); back(); };
  },

  help(back) {
    const s = UI.screen(
      '<div class="panel wide"><h2>❔ Hướng dẫn chơi</h2>' +
      '<h4>Điều khiển</h4><ul>' +
      '<li><b>Máy tính:</b> Mũi tên / W A S D để điều khiển xe tuần tra · <b>SPACE</b> hoặc <b>E</b>: ra hiệu lệnh dừng xe / xử lý tai nạn · <b>ESC</b> hoặc <b>P</b>: tạm dừng · Phím số <b>1–3</b> để chọn nhanh đáp án.</li>' +
      '<li><b>Điện thoại:</b> kéo cần điều khiển bên trái để lái xe tuần tra, nút <b>DỪNG XE</b> bên phải. Chế độ chốt: bấm nút trên bảng quan sát.</li></ul>' +
      '<h4>Chế độ Chốt kiểm soát</h4><ul>' +
      '<li>Từng phương tiện vào chốt, dừng trước mặt và hiện phóng to ở bảng quan sát. Quan sát mũ bảo hiểm, số người, điện thoại, tốc độ, tin báo.</li>' +
      '<li><b>DỪNG XE</b> (Space) nếu có dấu hiệu vi phạm, <b>CHO QUA</b> (C) nếu không. Cho qua đúng: <b>+5</b> · Bỏ lọt: <b>−10</b>.</li></ul>' +
      '<h4>Chế độ Tuần tra lưu động (mô tô / ô tô)</h4><ul>' +
      '<li><b>🏍 Mô tô:</b> tuần tra trên phố, xử lý vi phạm của xe mô tô, xe máy (mũ bảo hiểm, chở quá số người, điện thoại, vượt đèn đỏ, đi ngược chiều, tốc độ, nồng độ cồn, giấy tờ).</li>' +
      '<li><b>🚓 Ô tô:</b> tuần tra trên quốc lộ theo chuyên đề: xe tải quá tải (cân tải trọng), quá khổ (đo chiều cao xếp hàng), xe khách chở quá số người (kiểm đếm), nồng độ cồn người điều khiển ô tô.</li>' +
      '<li>Điều khiển xe tuần tra bằng phím mũi tên / W A S D hoặc cần điều khiển. Xe có dấu hiệu vi phạm ở gần hiện biểu tượng <b style="color:#ffd23f">!</b>. Bám theo phương tiện, khung vàng khóa mục tiêu. Thẻ quan sát (góc phải) phóng to phương tiện: mũ bảo hiểm, số người, điện thoại (chấm xanh sáng), tốc độ (nếu có máy đo).</li>' +
      '<li>Dấu <b style="color:#ff3b30">!</b> nhấp nháy trên xe: tổ công tác vừa ghi nhận xe vượt đèn đỏ.</li>' +
      '<li>Mỗi lần dừng xe có 3 bước: <b>Tiếp cận</b> → <b>Kiểm tra</b> (giấy tờ, tra cứu, đo nồng độ cồn) → <b>Kết luận theo bằng chứng</b>: mỗi bằng chứng chọn đúng lỗi và mức phạt, hoặc "Không vi phạm".</li>' +
      '<li>Mỗi ca, tình huống được sinh ngẫu nhiên: lỗi ẩn (không bằng lái, bảo hiểm hết hạn, nồng độ cồn…), thái độ người vi phạm khác nhau.</li></ul>' +
      '<h4>Tình huống đặc biệt</h4><ul>' +
      '<li>Trong ca sẽ phát sinh ngẫu nhiên: <b>🚑 tai nạn</b> (va chạm, xe tải lật, tự ngã), <b>🦹 cướp giật</b>, <b>🚨 truy nã</b>, <b>🏍 đua xe trái phép</b>, <b>🤝 hỗ trợ nhân dân</b> (xe cấp cứu, xe chết máy, trẻ lạc, cụ già qua đường).</li>' +
      '<li>Tuần tra: theo <b style="color:#ff3b30">mũi tên đỏ</b> đến hiện trường rồi bấm SPACE. Truy nã: tìm đúng biển số trong dòng xe rồi dừng xe. Chốt: nhận tin qua bộ đàm, xử lý ngay; xe truy nã sẽ đi qua chốt.</li>' +
      '<li>Mỗi câu xử lý đúng +20, sai −10. Để quá thời gian: bị trừ điểm.</li></ul>' +
      '<h4>Nhiệm vụ trong ca</h4><ul><li>Mỗi ca có 3 nhiệm vụ ngẫu nhiên (góc trái màn hình), hoàn thành được thưởng 30–60 điểm.</li></ul>' +
      '<h4>Tính điểm</h4><ul>' +
      '<li>Kết luận đúng lỗi và mức phạt: <b>+20</b> · Đúng "Không vi phạm": <b>+5</b> · Đúng lỗi, sai mức phạt: <b>−10</b> · Sai hoặc bỏ sót: <b>−15</b> · Đúng quy trình, ứng xử chuẩn mực: <b>+10</b></li>' +
      '<li>Từ chối hối lộ: <b>+30</b> · Nhận hối lộ: <b>kết thúc ca, 0 sao</b></li>' +
      '<li>Dừng xe không có căn cứ: <b>−10</b> · (Tuần tra) để lọt xe có vi phạm rõ ràng đã đi ngang qua gần mình: <b>−5</b></li>' +
      '<li>Mỗi lượt kiểm tra tiêu tốn thời gian ca trực. Hãy chọn đúng mục tiêu!</li></ul>' +
      '<div class="row-end"><button class="btn" data-a="back">← Quay lại</button></div></div>');
    s.querySelector('[data-a=back]').onclick = () => { AUDIO.click(); back(); };
  },

  summary(r) {
    const st = r.stats;
    const acc = st.correct + st.missed + st.wrong > 0 ? Math.round(st.correct / (st.correct + st.missed + st.wrong) * 100) : 0;
    const rk = SAVE.rank();
    let html = '<div class="panel wide"><h2>' + (r.failed ? '⛔ Ca trực thất bại' : '📋 Tổng kết ca trực') + '</h2>' +
      '<p class="dim">' + U.esc(r.shift.name) + ' · ' + DATA.MODES[r.mode].name + '</p>';
    if (r.failed) html += '<p class="fb bad">Nhận hối lộ là hành vi phạm tội và vi phạm nghiêm trọng điều lệnh CAND. Người chiến sĩ CSGT phải luôn liêm chính!</p>';
    html += '<div class="stars big">' + '★'.repeat(r.stars) + '<i>' + '★'.repeat(3 - r.stars) + '</i></div>' +
      '<div class="score-big">' + r.score + ' điểm' + (r.newBest && r.score > 0 ? ' <span class="nb">KỶ LỤC MỚI!</span>' : '') + '</div>' +
      '<div class="stat-grid">' +
      '<div><b>' + st.stops + '</b><span>Lượt dừng xe</span></div>' +
      '<div><b>' + st.correct + '</b><span>Lỗi xác định đúng</span></div>' +
      '<div><b>' + st.missed + '</b><span>Lỗi bỏ sót</span></div>' +
      '<div><b>' + st.wrong + '</b><span>Kết luận sai</span></div>' +
      '<div><b>' + st.escaped + '</b><span>Để lọt vi phạm</span></div>' +
      '<div><b>' + acc + '%</b><span>Độ chính xác</span></div>' +
      '<div><b>' + st.procOk + '/' + (st.procOk + st.procBad) + '</b><span>Ứng xử chuẩn mực</span></div>' +
      '<div><b>' + (r.failed ? '✖' : st.bribeRefused > 0 ? '✔ ' + st.bribeRefused : '✔') + '</b><span>Liêm chính</span></div>' +
      '</div>';
    if (r.missions && r.missions.length) {
      html += '<div class="mis-sum"><b>🎯 Nhiệm vụ trong ca</b>' + r.missions.map(m => '<div class="' + (m.done ? 'ok' : 'dim') + '">' + (m.done ? '✔ ' : '✖ ') + U.esc(m.def.text) + (m.done ? ' (+' + m.def.reward + ')' : '') + '</div>').join('') + '</div>';
    }
    if (st.passOk) html += '<p class="dim">Cho qua đúng (không vi phạm): ' + st.passOk + ' phương tiện</p>';
    if (st.fineMax > 0) html += '<p class="fine">Tổng mức phạt các biên bản lập đúng: ' + U.money(st.fineMin) + ' – ' + U.money(st.fineMax) + '</p>';
    html += '<p class="rank">🎖 ' + rk.cur.name + ' · ' + SAVE.data.xp + ' XP' + (r.promoted ? ' <span class="nb">THĂNG CẤP!</span>' : '') + '</p>';
    if (r.log.length) {
      html += '<details><summary>Nhật ký ca trực (' + r.log.length + ')</summary><table class="log">';
      for (const l of r.log) html += '<tr><td>' + U.esc(l.plate) + '</td><td>' + U.esc(l.text) + '</td><td class="' + (l.pts >= 0 ? 'ok' : 'bad') + '">' + (l.pts >= 0 ? '+' : '') + l.pts + '</td></tr>';
      html += '</table></details>';
    }
    html += '<div class="row-end">' +
      '<button class="btn" data-a="menu">☰ Menu</button>' +
      '<button class="btn" data-a="again">↻ Chơi lại (tình huống mới)</button>' +
      (r.nextShift ? '<button class="btn primary" data-a="next">Ca tiếp theo ▶</button>' : '') +
      '</div></div>';
    const s = UI.screen(html);
    s.querySelector('[data-a=menu]').onclick = () => { AUDIO.click(); UI.title(); };
    s.querySelector('[data-a=again]').onclick = () => {
      AUDIO.click();
      const sh = r.shift;
      if (sh.id === 'free') G.start(DATA.makeFreeShift(U.rng(Date.now() & 0xffffffff), false), Date.now() & 0xffffffff, r.mode);
      else if (sh.id === 'daily') G.start(sh, U.dateSeed(), r.mode);
      else G.start(sh, Date.now() & 0xffffffff, r.mode);
    };
    const n = s.querySelector('[data-a=next]');
    if (n) n.onclick = () => { AUDIO.click(); G.start(r.nextShift, Date.now() & 0xffffffff, r.mode); };
  },

  pauseMenu() {
    const box = UI.modal('⏸ Tạm dừng', '');
    const body = box.querySelector('.m-body');
    body.innerHTML = '<div class="menu">' +
      '<button class="btn primary" data-a="resume">▶ Tiếp tục</button>' +
      '<button class="btn" data-a="book">📘 Sổ tay pháp luật</button>' +
      '<button class="btn" data-a="sound">' + (SAVE.data.sound ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt') + '</button>' +
      '<button class="btn" data-a="quit">☰ Kết thúc ca, về menu</button></div>';
    body.querySelector('[data-a=resume]').onclick = () => { UI.closeModal(); G.resume(); };
    body.querySelector('[data-a=sound]').onclick = () => { SAVE.data.sound = !SAVE.data.sound; SAVE.store(); UI.pauseMenu(); };
    body.querySelector('[data-a=book]').onclick = () => { UI.closeModal(); UI.handbook(() => { UI.hideScreen(); UI.pauseMenu(); }); };
    body.querySelector('[data-a=quit]').onclick = () => { UI.closeModal(); UI.title(); };
    body.querySelector('[data-a=resume]').focus();
  },

  /* ---------------- HUD ---------------- */
  hud(on) {
    UI.$('hud').classList.toggle('hidden', !on);
    UI.$('touch').classList.toggle('hidden', !on || !G.touch);
    if (!on) UI.banner(null);
    if (!on) { UI.$('card').classList.add('hidden'); UI.$('hint').classList.add('hidden'); UI.cpPanel(null); }
  },
  _cache: {},
  set(id, html) {
    if (UI._cache[id] === html) return;
    UI._cache[id] = html;
    UI.$(id).innerHTML = html;
  },
  updateHud() {
    const sh = G.shift;
    const [hh, mm] = sh.time.split(':').map(Number);
    const gm = hh * 60 + mm + Math.floor((sh.duration - G.timeLeft) * (240 / sh.duration));
    const clock = U.pad(Math.floor(gm / 60) % 24) + ':' + U.pad(gm % 60);
    const tl = Math.max(0, Math.ceil(G.timeLeft));
    UI.set('hudL', '<b>' + U.esc(sh.short) + '</b><span>🕒 ' + clock + ' · còn ' + Math.floor(tl / 60) + ':' + U.pad(tl % 60) + '</span>');
    UI.set('hudR', '<b>' + G.score + '</b><span>điểm · ' + G.stats.stops + ' lượt</span>');
    const pct = Math.max(0, G.timeLeft / sh.duration * 100);
    UI.$('timebar').style.width = pct + '%';
  },

  updateCard(v) {
    const card = UI.$('card');
    if (!v) { if (!card.classList.contains('hidden')) card.classList.add('hidden'); UI._cardV = null; return; }
    card.classList.remove('hidden');
    if (UI._cardV !== v) {
      UI._cardV = v;
      const cv = UI.$('cardCv');
      const sc = v.kind === 'truck' ? 3 : 4;
      cv.width = (v.len + 2) * sc; cv.height = (v.wid + 2) * sc;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(v.spr, 0, 0, cv.width, cv.height);
    }
    let t = '<b>' + U.esc(v.plate) + '</b> · ' + (v.kind === 'moto' ? 'Xe máy' : v.kind === 'car' ? 'Ô tô' : v.kind === 'bus' ? 'Xe khách' : 'Xe tải');
    if (G.shift.radar) {
      const k = Math.round(v.speed / KPX);
      t += '<div class="radar ' + (k >= v.lane.limit + 5 ? 'bad' : '') + '">📡 ' + k + ' km/h <small>(tối đa ' + v.lane.limit + ')</small></div>';
    }
    const sg = TRAFFIC.signs(v);
    t += sg.length ? '<div class="signs"><b>Dấu hiệu:</b>' + sg.map(x => '<div class="bad">' + x + '</div>').join('') + '</div>' : '<div class="dim">Chưa thấy dấu hiệu vi phạm</div>';
    UI.set('cardTxt', t);
  },

  cpPanel(v, frac) {
    const P = UI.$('cpPanel');
    if (!v) { if (!P.classList.contains('hidden')) P.classList.add('hidden'); UI._cpV = null; return; }
    if (UI._cpV !== v) {
      UI._cpV = v;
      P.classList.remove('hidden');
      const cv = UI.$('cpCv');
      const sc = v.kind === 'moto' ? 8 : v.kind === 'car' ? 6 : 4;
      cv.width = (v.len + 2) * sc; cv.height = (v.wid + 2) * sc;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(v.spr, 0, 0, cv.width, cv.height);
      let t = '<div><b class="plate">' + U.esc(v.plate) + '</b> ' + (v.kind === 'moto' ? 'Xe máy' : v.kind === 'car' ? 'Ô tô con' : 'Ô tô tải') + '</div>';
      if (v.pass) t += '<div>Trên xe: ' + (1 + v.pass) + ' người</div>';
      if (v.measured != null) t += '<div class="radar ' + (v.measured >= v.lane.limit + 5 ? 'bad' : 'ok') + '">📡 ' + v.measured + ' km/h <small>(tối đa ' + v.lane.limit + ')</small></div>';
      if (v.redWitnessed) t += '<div class="bad">📻 Tin báo: xe vừa vượt đèn đỏ ở ngã tư phía trước</div>';
      if (v.wrongReport) t += '<div class="bad">📻 Tin báo: xe vừa đi ngược chiều vào đường một chiều</div>';
      if (v.weave) t += '<div class="bad">〰 Xe chạy lạng lách, không vững tay lái</div>';
      if (G.shift.hints) {
        const sg = TRAFFIC.signs(v);
        t += '<div class="hintbox">💡 Gợi ý: ' + (sg.length ? sg.join(' · ') + ' → nên DỪNG XE' : 'không thấy dấu hiệu vi phạm → có thể CHO QUA') + '</div>';
      } else {
        t += '<div class="dim">Quan sát: mũ bảo hiểm · số người · điện thoại (chấm xanh sáng)</div>';
      }
      if (G.shift.checkpoint) t += '<div class="dim">Chốt nồng độ cồn theo kế hoạch: dừng kiểm tra mọi phương tiện.</div>';
      UI.$('cpInfo').innerHTML = t;
      UI.$('cpStop').onclick = () => { AUDIO.init(); G.act = true; };
      UI.$('cpPass').onclick = () => { AUDIO.init(); G.pass = true; };
    }
    UI.$('cpTimerBar').style.width = Math.round(frac * 100) + '%';
  },

  banner(html) {
    const b = UI.$('evBanner');
    if (!b) return;
    if (!html) { b.classList.add('hidden'); UI._cache.evBanner = null; return; }
    b.classList.remove('hidden');
    UI.set('evBanner', html);
  },

  hint(msg) {
    const h = UI.$('hint');
    if (!msg) { h.classList.add('hidden'); UI._cache.hint = null; return; }
    h.classList.remove('hidden');
    UI.set('hint', msg);
  }
};
