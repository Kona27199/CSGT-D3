'use strict';
/* =========================================================================
 * ĐỒ HỌA PIXEL CHI TIẾT
 * Mọi hình được vẽ ở độ phân giải RS lần (mỗi đơn vị thế giới = RS điểm ảnh),
 * nên toạ độ trong file này có thể dùng bước 0,5 để thêm chi tiết.
 * ========================================================================= */
const RS = 2;

const SPR = {
  /* tạo canvas đã scale sẵn: vẽ theo đơn vị thế giới */
  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * RS); c.height = Math.ceil(h * RS);
    const g = c.getContext('2d');
    g.scale(RS, RS);
    return [c, g];
  },
  rect(g) { return (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); }; },

  /* làm sáng (+) / tối (−) màu hex */
  sh(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, k = Math.abs(f);
    r = Math.round(r + (t - r) * k); gg = Math.round(gg + (t - gg) * k); b = Math.round(b + (t - b) * k);
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  },

  wheel(r, x, y, w, h) {
    r(x, y, w, h, '#151515');
    r(x + 0.5, y, w - 1, 0.5, '#3a3a3a');
  },

  /* ---------------- NGƯỜI TRÊN XE MÁY (nhìn từ trên) ---------------- */
  rider(r, x, helm, hc, shirt) {
    const sd = SPR.sh(shirt, -0.3), sl = SPR.sh(shirt, 0.25);
    r(x, 1, 4, 6, shirt); r(x + 0.5, 1, 3, 0.5, sl); r(x, 6.5, 4, 0.5, sd); r(x, 1.5, 0.5, 5, sd);
    if (helm) {
      r(x + 0.25, 2.25, 3.5, 3.5, hc);
      r(x + 0.25, 5.25, 3.5, 0.5, SPR.sh(hc, -0.35));
      r(x + 0.75, 2.5, 1.25, 0.75, 'rgba(255,255,255,0.8)');
      r(x + 3.25, 2.75, 0.75, 2.5, '#151515');
      r(x + 3.4, 3, 0.35, 0.75, '#6b8fb3');
    } else {
      r(x + 0.25, 2.25, 3.5, 3.5, '#2b1d14');
      r(x + 0.75, 2.75, 1.5, 0.5, '#4a3526'); r(x + 1, 3.75, 1.75, 0.5, '#3b2a1d');
      r(x + 3.25, 3, 0.75, 2, '#e0ac69'); r(x + 3.5, 3.5, 0.5, 1, '#c68642');
    }
  },

  /* ---------------- PHƯƠNG TIỆN (hướng sang phải) ---------------- */
  vehicle(v) {
    const L = v.len, W = v.wid;
    const [cv, g] = SPR.canvas(L + 2, W + 2);
    g.translate(1, 1);
    const r = SPR.rect(g);
    r(0.5, 1.5, L, W - 0.5, 'rgba(0,0,0,0.26)');
    if (v.kind === 'moto') SPR.moto(r, v, L, W);
    else if (v.kind === 'amb') {
      SPR.car(r, v, L, W, '#f7f7f7');
      r(1, W / 2 - 0.5, L - 2, 1, '#d62828');
      r(8, W / 2 - 2.5, 5, 1.5, '#d62828'); r(9.75, W / 2 - 4, 1.5, 5, '#d62828');
    }
    else if (v.kind === 'car') SPR.car(r, v, L, W, U.pick(TRAFFIC.CAR_COLORS));
    else if (v.kind === 'bus') SPR.bus(r, v, L, W);
    else SPR.truck(r, v, L, W);
    return cv;
  },

  moto(r, v, L, W) {
    const col = v.robber ? '#2b2b2b' : U.pick(TRAFFIC.MOTO_COLORS), dk = SPR.sh(col, -0.35), lt = SPR.sh(col, 0.35);
    SPR.wheel(r, 0, 2.5, 3, 3); r(1, 3.5, 1, 1, '#8a8a8a');
    SPR.wheel(r, L - 3, 2.5, 3, 3); r(L - 2, 3.5, 1, 1, '#8a8a8a');
    r(2.5, 2.5, L - 5, 3, col); r(2.5, 2.5, L - 5, 0.5, lt); r(2.5, 5, L - 5, 0.5, dk);
    r(L - 5, 2, 2, 4, col); r(L - 5, 2, 2, 0.5, lt); r(L - 5, 5.5, 2, 0.5, dk);
    r(1.5, 5.5, 5, 0.75, '#c0c0c0'); r(1.5, 5.5, 1, 0.75, '#5e5e5e');
    r(4, 3, Math.max(3, L - 11), 2, '#232323'); r(4, 3, Math.max(3, L - 11), 0.5, '#3d3d3d');
    r(L - 5.5, 0, 0.75, 8, '#8a8a8a'); r(L - 5.5, 0, 0.75, 1, '#222'); r(L - 5.5, 7, 0.75, 1, '#222');
    r(L - 6.75, -0.25, 1.25, 0.75, '#cfd8dc'); r(L - 6.75, 7.5, 1.25, 0.75, '#cfd8dc');
    r(L - 1, 3, 1, 2, '#fff3a0'); r(L - 0.5, 3.25, 0.5, 1.5, '#ffffff');
    r(0, 3.25, 0.5, 1.5, '#d62828');
    if (v.pass === 2) SPR.rider(r, 1, v.passHelmet, U.pick(TRAFFIC.HELMETS), U.pick(TRAFFIC.SHIRTS));
    if (v.pass >= 1) SPR.rider(r, L - 14, v.passHelmet, v.robber ? '#111111' : U.pick(TRAFFIC.HELMETS), v.robber ? '#1c1c1c' : U.pick(TRAFFIC.SHIRTS));
    const shirt = v.robber ? '#1c1c1c' : v.racer ? U.pick(['#ff006e', '#3a86ff', '#ffbe0b']) : U.pick(TRAFFIC.SHIRTS);
    SPR.rider(r, L - 10, v.helmet, v.robber ? '#111111' : U.pick(TRAFFIC.HELMETS), shirt);
    if (v.robber) { r(L - 15.5, 0.5, 2, 2.5, '#c77dff'); r(L - 15, 1, 1, 1, '#e0aaff'); } // túi xách cướp được
    r(L - 7, 1, 1.75, 0.75, shirt); r(L - 7, 6.25, 1.75, 0.75, shirt);
    r(L - 5.75, 0.75, 0.75, 0.75, '#e0ac69'); r(L - 5.75, 6.5, 0.75, 0.75, '#e0ac69');
    if (v.phone) { r(L - 7.5, -0.25, 1.75, 1.25, '#5ef2ff'); r(L - 7.5, -0.25, 0.5, 0.5, '#ffffff'); r(L - 8, 0.75, 1, 0.75, '#e0ac69'); }
  },

  car(r, v, L, W, col, patrol) {
    const dk = SPR.sh(col, -0.32), lt = SPR.sh(col, 0.3), md = SPR.sh(col, -0.1);
    [3, L - 8].forEach(x => { SPR.wheel(r, x, 0, 5, 1); SPR.wheel(r, x, W - 1, 5, 1); });
    r(1, 0.75, L - 2, W - 1.5, col); r(0, 1.5, L, W - 3, col);
    r(0, 1.5, 0.5, W - 3, dk); r(L - 0.5, 1.5, 0.5, W - 3, dk); r(1, 0.75, L - 2, 0.5, dk); r(1, W - 1.25, L - 2, 0.5, dk);
    if (patrol) {
      r(0, 1.75, L, 0.75, '#1d4fa3'); r(0, W - 2.5, L, 0.75, '#1d4fa3');
      r(0, 2.5, L, 0.5, '#ffd23f'); r(0, W - 3, L, 0.5, '#ffd23f');
    }
    r(L - 7, 3, 5, 0.5, lt); r(L - 7, 4.5, 5, 0.5, md); r(L - 7, W - 5, 5, 0.5, md);
    r(L - 10, 2.25, 3, W - 4.5, '#1d2b3c'); r(L - 9.5, 2.75, 0.5, 2, '#6b8fb3'); r(L - 9, 3.5, 0.5, 1.5, '#4d6f91');
    r(6, 2.25, L - 16, W - 4.5, md); r(6.5, 2.75, L - 17, 0.5, lt);
    r(3.5, 2.75, 2.5, W - 5.5, '#1d2b3c'); r(4, 3.25, 0.5, 1.5, '#6b8fb3');
    r(6, 1.5, L - 15, 0.5, '#24364a'); r(6, W - 2, L - 15, 0.5, '#24364a');
    r(L - 9, 0, 1, 0.75, dk); r(L - 9, W - 0.75, 1, 0.75, dk);
    r(L - 1, 2, 1, 1.5, '#fff3a0'); r(L - 1, W - 3.5, 1, 1.5, '#fff3a0'); r(L - 0.5, 4.5, 0.5, W - 9, '#333');
    r(0, 2, 0.75, 1.5, '#d62828'); r(0, W - 3.5, 0.75, 1.5, '#d62828');
    r(Math.round(L / 2), 0.75, 0.5, 0.75, dk); r(Math.round(L / 2), W - 1.5, 0.5, 0.75, dk);
    if (v && v.phone) { r(L - 10, 2.5, 1, 1, '#5ef2ff'); r(L - 10, 2.5, 0.5, 0.5, '#fff'); }
  },

  truck(r, v, L, W) {
    const cab = U.pick(['#1d4e89', '#c1121f', '#2a9d8f', '#e9c46a', '#f1f1f1']);
    const bedType = U.pick(['plank', 'container', 'tarp']);
    const box = bedType === 'plank' ? '#9c6b3c' : bedType === 'tarp' ? '#4f7a3a' : U.pick(['#d9d9d9', '#b56576', '#6d6875', '#e76f51', '#457b9d']);
    [3, 7.5, 13, 17.5, L - 7].forEach(x => { SPR.wheel(r, x, 0, 3.5, 1); SPR.wheel(r, x, W - 1, 3.5, 1); });
    r(0, 1, L - 10, W - 2, box);
    r(0, 1, L - 10, 0.5, SPR.sh(box, -0.35)); r(0, W - 1.5, L - 10, 0.5, SPR.sh(box, -0.35)); r(0, 1, 0.5, W - 2, SPR.sh(box, -0.35));
    if (bedType === 'plank') for (let y = 2.5; y < W - 2; y += 2) r(0.5, y, L - 11, 0.5, '#7d532c');
    else if (bedType === 'container') { for (let x = 1.5; x < L - 11; x += 1.5) r(x, 1.5, 0.5, W - 3, SPR.sh(box, -0.15)); r(0.5, 1.5, L - 11, 0.5, SPR.sh(box, 0.25)); }
    else { for (let x = 3; x < L - 11; x += 4) r(x, 1, 0.5, W - 2, '#2f4f23'); r(0.5, 1.5, L - 11, 0.75, '#6a9a4f'); }
    if (DATA.loadTier(v.overPct)) {
      r(0.5, 1.5, L - 11, W - 3, '#8d6e63');
      for (let i = 0; i * 3 + 1 < L - 12; i++) r(1 + i * 3, 2.5 + (i % 2) * 0.5, 2.5, W - 5 - (i % 2), '#a1887f');
      r(3, 4, L - 16, W - 8, '#6d4c41'); r(4, 5, L - 18, 1, '#5d4037');
      r(0, 0.5, L - 10, 0.5, '#a1887f'); r(0, W - 1, L - 10, 0.5, '#a1887f');
    }
    if (v.height > v.heightLimit) {
      r(0.25, 0.75, L - 10.5, W - 1.5, '#3f6a8f'); r(0.25, 0.75, L - 10.5, 0.75, '#5b88b0');
      for (let x = 2; x < L - 11; x += 4) r(x, 0.75, 0.5, W - 1.5, '#ffd23f');
      r(0.25, W / 2 - 0.25, L - 10.5, 0.5, '#2f4f6f');
    }
    r(L - 10, 2, 1, W - 4, '#2b2b2b');
    const ck = SPR.sh(cab, -0.3), cl = SPR.sh(cab, 0.3);
    r(L - 9, 1, 9, W - 2, cab); r(L - 9, 1, 9, 0.5, cl); r(L - 9, W - 1.5, 9, 0.5, ck); r(L - 9, 1, 0.5, W - 2, ck);
    r(L - 7, 2, 3, W - 4, SPR.sh(cab, -0.12)); r(L - 6.5, 2.5, 2, 0.5, cl);
    r(L - 3.5, 2, 2, W - 4, '#1d2b3c'); r(L - 3, 2.5, 0.5, 2, '#6b8fb3');
    r(L - 4, 0, 1, 1, '#222'); r(L - 4, W - 1, 1, 1, '#222');
    r(L - 1, 2, 1, 1.5, '#fff3a0'); r(L - 1, W - 3.5, 1, 1.5, '#fff3a0');
    r(0, 1.5, 0.5, 1.5, '#d62828'); r(0, W - 3, 0.5, 1.5, '#d62828');
    if (v.phone) { r(L - 4, 3, 1, 1, '#5ef2ff'); }
  },

  bus(r, v, L, W) {
    const col = U.pick(['#f1f1f1', '#e9c46a', '#2a9d8f', '#3a86ff', '#c1121f', '#f4a261']);
    const acc = U.pick(['#1d4fa3', '#c1121f', '#2a9d8f', '#ff7b00']);
    const dk = SPR.sh(col, -0.3), lt = SPR.sh(col, 0.25);
    [5, 9.5, L - 9].forEach(x => { SPR.wheel(r, x, 0, 4, 1); SPR.wheel(r, x, W - 1, 4, 1); });
    r(0.5, 0.75, L - 1, W - 1.5, col); r(0, 1.25, L, W - 2.5, col);
    r(0, 1.25, 0.5, W - 2.5, dk); r(L - 0.5, 1.25, 0.5, W - 2.5, dk);
    for (let x = 2; x < L - 4; x += 3) { r(x, 1, 2.5, 1, '#1d2b3c'); r(x, W - 2, 2.5, 1, '#1d2b3c'); r(x + 0.25, 1, 0.5, 0.5, '#6b8fb3'); }
    r(1, 2.25, L - 4, W - 4.5, lt);
    r(1, W / 2 - 0.5, L - 4, 1, acc);
    r(12, 3.5, 10, W - 7, '#b0bec5'); for (let x = 12.75; x < 22; x += 1.5) r(x, 4, 0.5, W - 8, '#78909c');
    r(5, 4, 3, W - 8, '#90a4ae'); r(25, 4, 3, W - 8, '#90a4ae');
    r(L - 2.5, 2, 2, W - 4, '#1d2b3c'); r(L - 2, 2.5, 0.5, 2.5, '#6b8fb3');
    r(L - 1, 1.5, 1, 1.5, '#fff3a0'); r(L - 1, W - 3, 1, 1.5, '#fff3a0');
    r(0, 1.5, 0.5, 1.5, '#d62828'); r(0, W - 3, 0.5, 1.5, '#d62828');
    if (v.busExcess > 0) {
      r(L - 8, W - 1.5, 3.5, 1.25, '#e0ac69');
      r(L - 8, W - 1, 1, 1, '#2b1d14'); r(L - 6.5, W - 1, 1, 1, '#2b1d14'); r(L - 5, W - 0.75, 1, 0.75, '#2b1d14');
    }
    if (v.phone) r(L - 3, 3, 1, 1, '#5ef2ff');
  },

  /* ---------------- XE TUẦN TRA CSGT ---------------- */
  patrol(veh) {
    const L = veh === 'car' ? 26 : 18, W = veh === 'car' ? 13 : 9;
    const [cv, g] = SPR.canvas(L + 2, W + 2);
    g.translate(1, 1);
    const r = SPR.rect(g);
    r(0.5, 1.5, L, W - 0.5, 'rgba(0,0,0,0.3)');
    if (veh === 'car') {
      SPR.car(r, null, L, W, '#f4f4f4', true);
      r(L - 6, W / 2 - 1, 3, 2, '#ffd23f'); r(L - 5.5, W / 2 - 0.5, 2, 1, '#c1121f'); // phù hiệu trên nắp capô
    } else {
      SPR.wheel(r, 0, 3, 3, 3); r(1, 4, 1, 1, '#8a8a8a');
      SPR.wheel(r, L - 3, 3, 3, 3); r(L - 2, 4, 1, 1, '#8a8a8a');
      r(2, 2.5, L - 5, 4, '#f4f4f4'); r(2, 4.25, L - 5, 0.5, '#1d4fa3'); r(2, 2.5, L - 5, 0.5, '#ffffff'); r(2, 6, L - 5, 0.5, '#c9c9c9');
      r(0.5, 1, 4, 7, '#e8e8e8'); r(0.5, 1, 4, 0.75, '#1d4fa3'); r(0.5, 7.25, 4, 0.75, '#1d4fa3'); r(1, 3.5, 3, 2, '#ffd23f');
      r(L - 5.5, 0, 0.75, 9, '#8a8a8a'); r(L - 6.75, -0.25, 1.25, 0.75, '#cfd8dc'); r(L - 6.75, 8.5, 1.25, 0.75, '#cfd8dc');
      r(L - 1, 3.5, 1, 2, '#fff3a0');
      r(L - 10, 1, 4, 7, '#d8b24a'); r(L - 10, 1, 4, 0.5, '#f0cf6a'); r(L - 10, 7.5, 4, 0.5, '#a8862f');
      r(L - 9.75, 2.5, 3.5, 4, '#f7f7f7'); r(L - 9.25, 2.75, 1.25, 0.75, '#ffffff'); r(L - 6.75, 3, 0.75, 3, '#151515');
      r(L - 7.25, 1, 1.75, 0.75, '#d8b24a'); r(L - 7.25, 7.25, 1.75, 0.75, '#d8b24a');
      r(L - 5.75, 0.75, 0.75, 0.75, '#ffffff'); r(L - 5.75, 7.5, 0.75, 0.75, '#ffffff');
    }
    return cv;
  },

  /* ---------------- CHIẾN SĨ CSGT ĐỨNG CHỐT (nhìn 3/4) ---------------- */
  _officer: {},
  officer(face, step) {
    const key = face + step;
    if (SPR._officer[key]) return SPR._officer[key];
    const [cv, g] = SPR.canvas(14, 20);
    g.translate(1, 2);
    const r = SPR.rect(g);
    const pants = '#3d5a2a', pantsD = '#2c4320', shoe = '#141414';
    r(1.5, 16, 10, 2, 'rgba(0,0,0,0.3)');
    const leg = (x, len) => { r(x, 12, 3, len, pants); r(x, 12, 0.5, len, pantsD); r(x, 12 + len, 3, 1, shoe); r(x + 0.5, 12 + len, 1, 0.5, '#3a3a3a'); };
    if (step === 0) { leg(3, 3); leg(6.5, 2); } else if (step === 1) { leg(3, 2); leg(6.5, 3); } else { leg(3, 3); leg(6.5, 3); }
    const shirt = '#d8b24a', shirtD = '#b8923a', shirtL = '#ecc960';
    r(2, 7, 9, 5.5, shirt); r(2, 7, 9, 0.5, shirtL); r(2, 12, 9, 0.5, shirtD); r(2, 7, 0.5, 5.5, shirtD);
    r(2, 11, 9, 1, '#5b3f22'); r(6, 11, 1, 1, '#e0c060');
    r(1.5, 7, 2, 1, '#2f5d34'); r(9.5, 7, 2, 1, '#2f5d34'); // cầu vai
    if (face === 'down') {
      r(6, 7, 1, 4, shirtD); r(4, 8, 1, 1, '#c0392b'); r(8, 8, 1, 1, '#c0392b');
      r(3.5, 9, 1.5, 1.25, shirtD); r(8, 9, 1.5, 1.25, shirtD); // túi áo
      r(8.25, 8.25, 1, 0.75, '#ffd23f');                        // phù hiệu
    }
    const glove = '#f5f5f5';
    if (face === 'left') { r(1, 8, 2, 4, shirt); r(1, 11.5, 2, 1, glove); }
    else if (face === 'right') { r(10, 8, 2, 4, shirt); r(10, 11.5, 2, 1, glove); r(12, 7, 0.75, 5, '#f5f5f5'); r(12, 8, 0.75, 0.75, '#222'); r(12, 10, 0.75, 0.75, '#222'); }
    else { r(0, 8, 2, 4, shirt); r(11, 8, 2, 4, shirt); r(0, 12, 2, 1, glove); r(11, 12, 2, 1, glove); r(12.5, 8.5, 0.75, 5, '#f5f5f5'); r(12.5, 9.5, 0.75, 0.75, '#222'); r(12.5, 11.5, 0.75, 0.75, '#222'); }
    const skin = '#f1c27d', skinD = '#d9a866';
    r(3, 2.5, 7, 5, skin); r(3, 7, 7, 0.5, skinD);
    if (face === 'down') { r(4.25, 4.5, 1, 1, '#1a1a1a'); r(7.75, 4.5, 1, 1, '#1a1a1a'); r(4.25, 4.25, 1, 0.25, '#2b1d14'); r(7.75, 4.25, 1, 0.25, '#2b1d14'); r(5.5, 6.25, 2, 0.5, '#b86b4b'); r(3, 5, 0.5, 1, skinD); r(9.5, 5, 0.5, 1, skinD); }
    else if (face === 'left') { r(3.25, 4.5, 1, 1, '#1a1a1a'); r(7.5, 2.5, 2.5, 4.5, '#2b1d14'); r(6.5, 4, 1, 1.5, skinD); }
    else if (face === 'right') { r(8.75, 4.5, 1, 1, '#1a1a1a'); r(3, 2.5, 2.5, 4.5, '#2b1d14'); r(5.5, 4, 1, 1.5, skinD); }
    else { r(3, 2.5, 7, 4.5, '#2b1d14'); r(4, 3, 3, 0.5, '#4a3526'); }
    /* mũ kêpi */
    r(2, -0.5, 9, 3, '#2f5d34'); r(3, -1.5, 7, 1, '#2f5d34'); r(3.5, -1.5, 4, 0.5, '#3f7a45');
    r(2, 2, 9, 0.75, '#c0392b');
    if (face === 'down') { r(5.75, -0.5, 1.5, 1.5, '#ffd23f'); r(6.25, 0, 0.5, 0.5, '#c0392b'); r(2, 2.75, 9, 0.75, '#1b3a1f'); }
    if (face === 'left') r(0.5, 2.75, 3.5, 0.75, '#1b3a1f');
    if (face === 'right') r(9, 2.75, 3.5, 0.75, '#1b3a1f');
    SPR._officer[key] = cv;
    return cv;
  },

  /* ---------------- NGƯỜI ĐI BỘ (tình huống hỗ trợ) ---------------- */
  _ped: {},
  pedestrian(kind) {
    if (SPR._ped[kind]) return SPR._ped[kind];
    const [cv, g] = SPR.canvas(8, 12);
    const r = SPR.rect(g);
    r(1, 10.5, 6, 1.5, 'rgba(0,0,0,0.3)');
    if (kind === 'child') {
      r(2.5, 8, 1.25, 2.5, '#3a3a6a'); r(4.25, 8, 1.25, 2.5, '#3a3a6a');
      r(2, 4.5, 4, 4, '#ff6b9a'); r(2, 4.5, 4, 0.5, '#ff9fbf');
      r(2.25, 1, 3.5, 3.75, '#f1c27d'); r(2, 0.5, 4, 1.5, '#2b1d14');
      r(3, 2.5, 0.5, 0.5, '#111'); r(4.5, 2.5, 0.5, 0.5, '#111'); r(3.5, 3.75, 1, 0.5, '#b86b4b');
    } else {
      r(2.5, 8, 1.25, 2.5, '#4a4a4a'); r(4.25, 8, 1.25, 2.5, '#4a4a4a');
      r(1.75, 4, 4.5, 4.5, '#6d597a'); r(1.75, 4, 4.5, 0.5, '#8d779a');
      r(6.5, 4.5, 0.5, 6, '#8a6239');
      r(2.25, 1.5, 3.5, 3, '#e8b98a');
      r(0.5, 0.5, 7, 1.5, '#e9d8a6'); r(2, -0.5, 4, 1.5, '#e9d8a6'); r(3.5, -1, 1, 1, '#d4c08a'); // nón lá
      r(3, 2.75, 0.5, 0.5, '#111'); r(4.5, 2.75, 0.5, 0.5, '#111');
    }
    SPR._ped[kind] = cv;
    return cv;
  },

  /* ---------------- XE MÁY ĐỖ TRÊN VỈA HÈ (nhìn từ trên, dựng dọc) ---------------- */
  parked(g, pk) {
    const rnd = U.rng(Math.floor(pk.x * 7 + pk.y * 13));
    const col = ['#c1121f', '#222222', '#3a86ff', '#e9e9e9', '#6a4c93', '#2a9d8f', '#d4a017'][Math.floor(rnd() * 7)];
    const x = pk.x, y = pk.y, up = pk.up;
    const r = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    r(0.5, 1, 4, 12, 'rgba(0,0,0,0.25)');
    r(1, 0, 2, 3, '#151515'); r(1, 10, 2, 3, '#151515');
    r(0.5, 2.5, 3, 8, col); r(0.5, 2.5, 0.75, 8, SPR.sh(col, 0.35)); r(3, 2.5, 0.5, 8, SPR.sh(col, -0.35));
    r(1, 4.5, 2, 4, '#232323');
    r(-1, up ? 2.5 : 9.5, 6, 0.75, '#8a8a8a');
    r(1.25, up ? 0 : 12.5, 1.5, 0.5, up ? '#fff3a0' : '#d62828');
  },

  /* ---------------- CÂY 2.5D (tán cao, có thể đung đưa) ---------------- */
  _tree: {},
  treeSprite(kind) {
    if (SPR._tree[kind]) return SPR._tree[kind];
    const [cv, g] = SPR.canvas(20, 28);
    const r = SPR.rect(g);
    if (kind === 'bamboo') {
      for (let i = 0; i < 6; i++) { const x = 4 + i * 2.2; r(x, 6 + (i % 2) * 2, 0.75, 20 - (i % 2) * 2, i % 2 ? '#7e9a3a' : '#97b04a'); for (let y = 9; y < 26; y += 4) r(x - 0.25, y, 1.25, 0.5, '#5e7a2a'); }
      const cl = [[2, 4], [7, 1], [12, 3], [4, 9], [11, 8], [7, 6], [14, 11], [1, 12]];
      cl.forEach(([a, b], i) => { r(a, b, 6, 6, i % 2 ? '#3f7d2a' : '#4f8f2e'); r(a + 1, b - 1, 1, 3, '#6eaa3c'); r(a + 4, b, 1, 3, '#6eaa3c'); r(a - 0.5, b + 2.5, 2, 1, '#6eaa3c'); r(a + 2.5, b + 2.5, 1, 1, '#8cc657'); });
    } else if (kind === 'palm') {
      r(9, 9, 2, 19, '#7a5a35'); r(9, 9, 0.75, 19, '#5e4428'); for (let y = 11; y < 27; y += 2.5) r(9, y, 2, 0.5, '#5e4428');
      const fr = [[-9, -1], [9, -1], [-6, -6], [6, -6], [0, -8], [-7, 4], [7, 4], [-3, 6], [3, 6]];
      fr.forEach(([dx, dy]) => { for (let k = 0; k < 6; k++) { const t = k / 5; r(10 + dx * t - 0.9, 8 + dy * t - 0.75, 1.8, 1.5, k > 3 ? '#6abf55' : k > 1 ? '#3f9a3f' : '#2f7a2f'); } });
      r(9, 7, 3, 3, '#8b5a2b'); r(9.5, 7.5, 1, 1, '#a9743a'); r(11, 9, 1.5, 1.5, '#6b8e23');
    } else {
      const street = kind === 'street';
      r(8.5, 14, 3, 14, '#6b4a2b'); r(8.5, 14, 1, 14, '#4f361f'); r(10.5, 18, 0.75, 6, '#8a6239');
      if (street) { r(5.5, 25.5, 9, 2.5, '#8d8478'); r(6.5, 26, 7, 1.5, '#5b4a3a'); }
      const base = street ? ['#2b6a3a', '#3b8a48', '#58ad5a', '#7ccb6e'] : ['#2e6b2e', '#3f8a3a', '#5aa84c', '#7cc35e'];
      r(1.5, 4, 17, 11, base[0]); r(3.5, 1.5, 13, 16, base[0]); r(2.5, 2.5, 15, 14, base[0]);
      r(3, 3, 13, 9, base[1]); r(5, 1.5, 10, 12, base[1]);
      r(5, 2, 5, 4, base[2]); r(11.5, 4, 4, 3, base[2]); r(3.5, 7, 3, 3, base[2]); r(9, 8, 3, 2.5, base[2]);
      r(6, 2.5, 2, 1.25, base[3]); r(12, 4.5, 1.5, 1, base[3]); r(4, 7.5, 1, 1, base[3]);
      r(3, 14, 14, 2.5, SPR.sh(base[0], -0.25)); r(5, 16, 10, 1, SPR.sh(base[0], -0.35));
    }
    SPR._tree[kind] = cv;
    return cv;
  },

  /* ---------------- NGƯỜI ĐI BỘ TRÊN VỈA HÈ (nhìn 3/4) ---------------- */
  _walker: {},
  walker(style, frame, rain) {
    const key = style.id + frame + (rain ? 'r' : '');
    if (SPR._walker[key]) return SPR._walker[key];
    const [cv, g] = SPR.canvas(8, 13);
    const r = SPR.rect(g);
    r(1.5, 11.5, 5, 1.5, 'rgba(0,0,0,0.28)');
    const pants = style.pants, shoe = '#1a1a1a';
    if (frame === 0) { r(2.25, 8.5, 1.5, 3, pants); r(4.25, 8.5, 1.5, 2.25, pants); r(2.25, 11.25, 1.5, 0.75, shoe); r(4.25, 10.5, 1.5, 0.75, shoe); }
    else { r(2.25, 8.5, 1.5, 2.25, pants); r(4.25, 8.5, 1.5, 3, pants); r(2.25, 10.5, 1.5, 0.75, shoe); r(4.25, 11.25, 1.5, 0.75, shoe); }
    r(1.5, 4.5, 5, 4.5, style.shirt); r(1.5, 4.5, 5, 0.5, SPR.sh(style.shirt, 0.25)); r(1.5, 8.5, 5, 0.5, SPR.sh(style.shirt, -0.3));
    r(0.75, 5, 1, 3, style.shirt); r(6.25, 5, 1, 3, style.shirt); r(0.75, 7.75, 1, 0.75, '#e0ac69'); r(6.25, 7.75, 1, 0.75, '#e0ac69');
    if (style.bag) r(5.5, 5, 1.75, 3, style.bag);
    r(2.25, 1.5, 3.5, 3.25, '#e8b98a'); r(2.75, 2.75, 0.5, 0.5, '#111'); r(4.75, 2.75, 0.5, 0.5, '#111');
    if (style.hat === 'non') { r(0.5, 0.75, 7, 1.25, '#e9d8a6'); r(2, -0.25, 4, 1.25, '#e9d8a6'); r(3.5, -0.75, 1, 0.75, '#d4c08a'); }
    else if (style.hat === 'helmet') { r(2, 0.5, 4, 1.75, '#ffd23f'); r(1.75, 2, 4.5, 0.5, '#d4a017'); }
    else { r(2.25, 1, 3.5, 1.25, style.hair || '#2b1d14'); if (style.long) r(2, 1.5, 0.75, 3.5, style.hair || '#2b1d14'), r(5.25, 1.5, 0.75, 3.5, style.hair || '#2b1d14'); }
    if (rain) { r(0.25, 3.5, 7.5, 6.5, 'rgba(120,180,255,0.45)'); r(0.25, 3.5, 7.5, 0.5, 'rgba(200,230,255,0.6)'); }
    SPR._walker[key] = cv;
    return cv;
  },

  /* ---------------- CÂY ---------------- */
  tree(g, x, y, kind) {
    const r = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    if (kind === 'bamboo') {
      r(1, 11, 14, 4, 'rgba(0,0,0,0.25)');
      const cl = [[2, 3], [6, 1], [10, 3], [4, 7], [9, 7], [6, 5]];
      cl.forEach(([a, b], i) => {
        r(a, b, 5, 5, i % 2 ? '#3f7d2a' : '#4f8f2e');
        r(a + 1, b - 1, 1, 3, '#6eaa3c'); r(a + 3, b, 1, 3, '#6eaa3c'); r(a - 0.5, b + 2, 2, 1, '#6eaa3c');
        r(a + 2, b + 2, 1, 1, '#8cc657');
      });
      r(7, 10, 0.75, 4, '#8a9a3a'); r(5, 10, 0.75, 3.5, '#8a9a3a');
      return;
    }
    if (kind === 'palm') {
      r(2, 11, 12, 4, 'rgba(0,0,0,0.22)');
      r(7, 7, 2, 7, '#7a5a35'); r(7, 7, 0.75, 7, '#5e4428');
      const fr = [[-6, -1], [6, -1], [-4, -4], [4, -4], [0, -6], [-5, 3], [5, 3]];
      fr.forEach(([dx, dy]) => {
        for (let k = 0; k < 5; k++) {
          const t = k / 4;
          r(8 + dx * t - 0.75, 6 + dy * t - 0.75, 1.75, 1.5, k > 2 ? '#5aa84c' : '#2f7a2f');
        }
      });
      r(7, 5, 2.5, 2.5, '#8b5a2b'); r(7.5, 5.5, 1, 1, '#a9743a');
      return;
    }
    r(1.5, 11, 14, 4.5, 'rgba(0,0,0,0.25)');
    r(7, 9, 2.5, 5, '#6b4a2b'); r(7, 9, 0.75, 5, '#4f361f');
    r(1.5, 2.5, 13, 8.5, '#2e6b2e'); r(3, 0.5, 10, 12, '#2e6b2e'); r(2, 1.5, 12, 10, '#2e6b2e');
    r(2.5, 2, 10, 6.5, '#3f8a3a'); r(4, 1, 7.5, 8.5, '#3f8a3a');
    r(4, 1.5, 4, 3, '#5aa84c'); r(9, 3, 3, 2, '#5aa84c'); r(3, 5, 2, 2, '#4d9a42');
    r(5, 2, 1.5, 1, '#7cc35e'); r(9.5, 3.5, 1, 0.75, '#7cc35e');
    r(3, 9, 9, 1.5, '#255a25');
  },

  /* ---------------- VẬT TRANG TRÍ ---------------- */
  prop(g, p) {
    const x = p.x, y = p.y;
    const r = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    if (p.type === 'stall') {
      r(0, 12, 16, 3, 'rgba(0,0,0,0.25)');
      r(1, 6, 14, 7, '#8d6e63'); r(1, 6, 14, 1, '#a1887f');
      const c = p.c || '#e63946';
      for (let i = 0; i < 4; i++) r(i * 4, 0, 4, 7, i % 2 ? '#f1f1f1' : c);
      r(0, 6.5, 16, 0.75, 'rgba(0,0,0,0.25)');
      r(2, 8, 3, 3, '#f4a261'); r(6, 8, 3, 3, '#90be6d'); r(10, 8, 3, 3, '#e9c46a');
      r(2.5, 8.5, 1, 1, '#ffd29a'); r(6.5, 8.5, 1, 1, '#b5e48c');
    } else if (p.type === 'container') {
      const c = p.c || '#c1121f';
      r(1, 2, p.w || 30, 12, 'rgba(0,0,0,0.28)');
      r(0, 0, p.w || 30, 12, c);
      for (let i = 1; i < (p.w || 30); i += 1.5) r(i, 0.5, 0.5, 11, SPR.sh(c, -0.18));
      r(0, 0, p.w || 30, 0.75, SPR.sh(c, 0.3)); r(0, 11.25, p.w || 30, 0.75, SPR.sh(c, -0.35));
    } else if (p.type === 'haystack') {
      r(1, 9, 14, 4, 'rgba(0,0,0,0.22)');
      r(2, 3, 12, 8, '#d9b44a'); r(4, 1, 8, 11, '#d9b44a'); r(5, 2, 6, 3, '#ecd27a');
      for (let i = 3; i < 13; i += 2) r(i, 4 + (i % 3), 0.5, 3, '#b8923a');
    } else if (p.type === 'boat') {
      r(0, 3, 22, 6, '#6b4a2b'); r(1, 2, 20, 1, '#8a6239'); r(2, 4, 18, 4, '#4f361f'); r(8, 3.5, 6, 5, '#d9b44a');
      r(20, 4, 3, 4, '#6b4a2b');
    } else if (p.type === 'scale') {
      r(0, 0, 40, 16, '#7d848b'); r(1, 1, 38, 14, '#9ea4aa');
      for (let i = 0; i < 40; i += 4) { r(i, 0, 2, 1, '#ffd23f'); r(i + 2, 0, 2, 1, '#1a1a1a'); r(i, 15, 2, 1, '#ffd23f'); r(i + 2, 15, 2, 1, '#1a1a1a'); }
      r(42, 2, 10, 10, '#e3d9c6'); r(42, 2, 10, 3, '#1d4fa3'); r(44, 7, 3, 3, '#5a7fa8');
    } else if (p.type === 'chimney') {
      r(1, 1, 8, 8, 'rgba(0,0,0,0.25)');
      r(0, 0, 7, 7, '#8b8f94'); r(1, 1, 5, 5, '#3a3d42'); r(0, 0, 7, 1, '#c84b3a'); r(0, 3, 7, 1, '#f1f1f1');
    } else if (p.type === 'gate') {
      r(0, 0, 5, 5, '#e3d9c6'); r(0, 0, 5, 1.5, '#1d4fa3'); r(p.w - 5, 0, 5, 5, '#e3d9c6'); r(p.w - 5, 0, 5, 1.5, '#1d4fa3');
      r(5, 1, p.w - 10, 1.5, 'rgba(29,79,163,0.55)');
    } else if (p.type === 'pond') {
      r(0, 0, p.w, p.h, '#3c7fb3'); r(1, 1, p.w - 2, p.h - 2, '#4a8fc2');
      for (let i = 2; i < p.w - 3; i += 5) r(i, 2 + (i % 4), 3, 0.5, '#8cc3e8');
      r(2, p.h - 3, 3, 2, '#3f8a3a'); r(p.w - 5, 2, 3, 2, '#3f8a3a'); r(p.w - 4.5, 2.5, 1, 1, '#f48fb1');
    } else if (p.type === 'pole') {
      r(0, 0, 1.5, 1.5, '#5a5a5a');
    } else if (p.type === 'bench') {
      r(0, 0, 10, 3, '#8a6239'); r(0, 0, 10, 0.75, '#a77b4c');
    }
  }
};
