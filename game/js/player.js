'use strict';
/* Nhân vật chiến sĩ CSGT (nhìn 3/4, sprite pixel vẽ bằng code) */
const PLAYER = {
  x: 0, y: 0, face: 'down', anim: 0, moving: false, speed: 72,
  veh: null, vx: 0, vy: 0, spr: null,   // veh: null (đi bộ/đứng chốt) | 'moto' | 'car'

  reset(sp, veh) {
    PLAYER.x = sp.x; PLAYER.y = sp.y; PLAYER.face = veh ? 'right' : 'down'; PLAYER.anim = 0;
    PLAYER.veh = veh || null; PLAYER.vx = 0; PLAYER.vy = 0;
    PLAYER.spr = veh ? PLAYER.vehSprite(veh) : null;
  },

  /* Xe tuần tra CSGT nhìn từ trên xuống, hướng sang phải */
  vehSprite(veh) {
    const L = veh === 'car' ? 26 : 18, W = veh === 'car' ? 13 : 9;
    const cv = document.createElement('canvas');
    cv.width = L + 2; cv.height = W + 2;
    const g = cv.getContext('2d');
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    r(1, 2, L, W, 'rgba(0,0,0,0.3)');
    if (veh === 'car') {
      r(3, 0, 5, 1, '#111'); r(L - 8, 0, 5, 1, '#111'); r(3, W - 1, 5, 1, '#111'); r(L - 8, W - 1, 5, 1, '#111');
      r(0, 1, L, W - 2, '#f4f4f4');
      g.clearRect(0, 1, 1, 1); g.clearRect(0, W - 2, 1, 1); g.clearRect(L - 1, 1, 1, 1); g.clearRect(L - 1, W - 2, 1, 1);
      r(0, 2, L, 1, '#1d4fa3'); r(0, W - 3, L, 1, '#1d4fa3');          // sọc xanh hai bên
      r(0, 3, L, 1, '#ffd23f'); r(0, W - 4, L, 1, '#ffd23f');          // sọc vàng
      r(L - 9, 4, 3, W - 8, '#1c2a3a'); r(3, 4, 2, W - 8, '#1c2a3a');  // kính trước/sau
      r(L - 1, 4, 1, 2, '#fff6b0'); r(L - 1, W - 6, 1, 2, '#fff6b0');
      r(0, 4, 1, 2, '#c1121f'); r(0, W - 6, 1, 2, '#c1121f');
    } else {
      r(0, 3, 3, 3, '#141414'); r(L - 3, 3, 3, 3, '#141414');
      r(2, 2, L - 5, 5, '#f4f4f4'); r(2, 4, L - 5, 1, '#1d4fa3');
      r(1, 1, 4, 7, '#e0e0e0'); r(1, 1, 4, 1, '#1d4fa3'); r(1, 7, 4, 1, '#1d4fa3');   // thùng đựng sau
      r(L - 5, 0, 1, 9, '#9a9a9a');
      r(L - 2, 3, 1, 3, '#fff6b0');
      r(L - 10, 1, 4, 7, '#d8b24a');                                    // áo vàng
      r(L - 10, 2, 4, 5, '#f4f4f4'); r(L - 7, 2, 1, 5, '#1a1a1a');      // mũ bảo hiểm trắng
      r(L - 6, 1, 2, 1, '#f5f5f5'); r(L - 6, 7, 2, 1, '#f5f5f5');       // găng trắng
    }
    return cv;
  },

  /* Ô xe tuần tra được phép đi: ô tô trên lòng đường/lề; mô tô thêm vỉa hè */
  vehBlocked(nx, ny) {
    const m = MAP.cur, h = PLAYER.veh === 'car' ? 5 : 3;
    const ok = (x, y) => {
      const t = MAP.get(m, Math.floor(x / TILE), Math.floor(y / TILE));
      return t === T.ROAD || t === T.SHOULDER || (PLAYER.veh === 'moto' && t === T.WALK);
    };
    return !(ok(nx - h, ny - h) && ok(nx + h, ny - h) && ok(nx - h, ny + h) && ok(nx + h, ny + h));
  },

  updateVeh(dt, ix, iy) {
    const max = PLAYER.veh === 'car' ? 175 : 150, acc = PLAYER.veh === 'car' ? 260 : 320;
    const len = Math.hypot(ix, iy);
    const tx = len > 0.15 ? ix / Math.max(1, len) * max : 0, ty = len > 0.15 ? iy / Math.max(1, len) * max : 0;
    const step = (cur, want) => {
      const d = want - cur, a = (want === 0 ? acc * 1.4 : acc) * dt;
      return Math.abs(d) <= a ? want : cur + Math.sign(d) * a;
    };
    PLAYER.vx = step(PLAYER.vx, tx); PLAYER.vy = step(PLAYER.vy, ty);
    const m = MAP.cur;
    const nx = U.clamp(PLAYER.x + PLAYER.vx * dt, 8, m.pw - 8);
    if (!PLAYER.vehBlocked(nx, PLAYER.y)) PLAYER.x = nx; else PLAYER.vx = 0;
    const ny = U.clamp(PLAYER.y + PLAYER.vy * dt, 8, m.ph - 8);
    if (!PLAYER.vehBlocked(PLAYER.x, ny)) PLAYER.y = ny; else PLAYER.vy = 0;
    const sp = Math.hypot(PLAYER.vx, PLAYER.vy);
    PLAYER.moving = sp > 5;
    if (sp > 10) {
      if (Math.abs(PLAYER.vx) > Math.abs(PLAYER.vy)) PLAYER.face = PLAYER.vx > 0 ? 'right' : 'left';
      else PLAYER.face = PLAYER.vy > 0 ? 'down' : 'up';
    }
    PLAYER.anim += dt * 6;
  },

  drawVeh(g, cam) {
    const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[PLAYER.face];
    const x = Math.round(PLAYER.x - cam.x), y = Math.round(PLAYER.y - cam.y);
    const spr = PLAYER.spr, L = spr.width - 2, W = spr.height - 2;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.drawImage(spr, -Math.floor(L / 2) - 1, -Math.floor(W / 2) - 1);
    /* đèn ưu tiên xanh - đỏ nhấp nháy */
    const on = Math.floor(PLAYER.anim * 2) % 2 === 0;
    if (PLAYER.veh === 'car') {
      g.fillStyle = on ? '#ff2a2a' : '#5a1010'; g.fillRect(-2, -Math.floor(W / 2) + 2, 3, Math.floor(W / 2) - 2);
      g.fillStyle = on ? '#1e4fa8' : '#3aa0ff'; g.fillRect(-2, 0, 3, Math.floor(W / 2) - 2);
    } else {
      g.fillStyle = on ? '#ff2a2a' : '#3aa0ff'; g.fillRect(-Math.floor(L / 2) + 1, -1, 2, 2);
    }
    g.restore();
  },

  /* hộp va chạm ở chân: 8x6 */
  blocked(nx, ny) {
    return MAP.solidAt(nx - 4, ny - 2) || MAP.solidAt(nx + 4, ny - 2) || MAP.solidAt(nx - 4, ny + 3) || MAP.solidAt(nx + 4, ny + 3);
  },

  update(dt, ix, iy) {
    if (PLAYER.veh) { PLAYER.updateVeh(dt, ix, iy); return; }
    const len = Math.hypot(ix, iy);
    PLAYER.moving = len > 0.15;
    if (!PLAYER.moving) { PLAYER.anim = 0; return; }
    const k = Math.min(1, len);
    const vx = ix / len * PLAYER.speed * k, vy = iy / len * PLAYER.speed * k;
    const m = MAP.cur;
    const nx = U.clamp(PLAYER.x + vx * dt, 6, m.pw - 6);
    if (!PLAYER.blocked(nx, PLAYER.y)) PLAYER.x = nx;
    const ny = U.clamp(PLAYER.y + vy * dt, 10, m.ph - 6);
    if (!PLAYER.blocked(PLAYER.x, ny)) PLAYER.y = ny;
    if (Math.abs(ix) > Math.abs(iy)) PLAYER.face = ix > 0 ? 'right' : 'left';
    else PLAYER.face = iy > 0 ? 'down' : 'up';
    PLAYER.anim += dt * 8;
  },

  draw(g, cam) {
    if (PLAYER.veh) { PLAYER.drawVeh(g, cam); return; }
    const x = Math.round(PLAYER.x - cam.x) - 6, y = Math.round(PLAYER.y - cam.y) - 14;
    const r = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    const step = PLAYER.moving ? (Math.floor(PLAYER.anim) % 2) : -1;
    const F = PLAYER.face;
    r(2, 16, 9, 2, 'rgba(0,0,0,0.3)');
    /* chân */
    const pants = '#3d5a2a', shoe = '#141414';
    if (step === 0) { r(3, 12, 3, 3, pants); r(7, 12, 3, 2, pants); r(3, 15, 3, 1, shoe); r(7, 14, 3, 1, shoe); }
    else if (step === 1) { r(3, 12, 3, 2, pants); r(7, 12, 3, 3, pants); r(3, 14, 3, 1, shoe); r(7, 15, 3, 1, shoe); }
    else { r(3, 12, 3, 3, pants); r(7, 12, 3, 3, pants); r(3, 15, 3, 1, shoe); r(7, 15, 3, 1, shoe); }
    /* thân áo vàng CSGT */
    const shirt = '#d8b24a', shirtD = '#b8923a';
    r(2, 7, 9, 6, shirt); r(2, 12, 9, 1, shirtD);
    r(2, 11, 9, 1, '#6b4a2b'); r(6, 11, 1, 1, '#e0c060'); // thắt lưng
    if (F === 'down') { r(4, 8, 1, 1, '#c0392b'); r(8, 8, 1, 1, '#c0392b'); r(6, 7, 1, 4, shirtD); }
    /* tay + găng trắng + gậy chỉ huy */
    if (F === 'left') { r(1, 8, 2, 4, shirt); r(1, 11, 2, 1, '#f5f5f5'); }
    else if (F === 'right') { r(10, 8, 2, 4, shirt); r(10, 11, 2, 1, '#f5f5f5'); r(12, 8, 1, 4, '#f5f5f5'); r(12, 9, 1, 1, '#222'); }
    else { r(0, 8, 2, 4, shirt); r(11, 8, 2, 4, shirt); r(0, 12, 2, 1, '#f5f5f5'); r(11, 12, 2, 1, '#f5f5f5'); r(12, 9, 1, 4, '#f5f5f5'); r(12, 10, 1, 1, '#222'); }
    /* đầu */
    const skin = '#f1c27d';
    r(3, 3, 7, 5, skin);
    if (F === 'down') { r(4, 5, 1, 1, '#1a1a1a'); r(8, 5, 1, 1, '#1a1a1a'); r(5, 7, 3, 1, '#c68642'); }
    else if (F === 'left') { r(3, 5, 1, 1, '#1a1a1a'); r(8, 3, 2, 4, '#2b1d14'); }
    else if (F === 'right') { r(9, 5, 1, 1, '#1a1a1a'); r(3, 3, 2, 4, '#2b1d14'); }
    else { r(3, 3, 7, 4, '#2b1d14'); }
    /* mũ kêpi xanh, viền đỏ, quân hiệu vàng */
    r(2, 0, 9, 3, '#2f5d34'); r(3, -1, 7, 1, '#2f5d34');
    r(2, 2, 9, 1, '#c0392b');
    if (F === 'down') { r(6, 0, 1, 1, '#ffd23f'); r(2, 3, 9, 1, '#1b3a1f'); }
    if (F === 'left') r(1, 3, 3, 1, '#1b3a1f');
    if (F === 'right') r(9, 3, 3, 1, '#1b3a1f');
  }
};
