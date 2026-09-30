'use strict';
/* Nhân vật chiến sĩ CSGT (nhìn 3/4, sprite pixel vẽ bằng code) */
const PLAYER = {
  x: 0, y: 0, face: 'down', anim: 0, moving: false, speed: 72,

  reset(sp) { PLAYER.x = sp.x; PLAYER.y = sp.y; PLAYER.face = 'down'; PLAYER.anim = 0; },

  /* hộp va chạm ở chân: 8x6 */
  blocked(nx, ny) {
    return MAP.solidAt(nx - 4, ny - 2) || MAP.solidAt(nx + 4, ny - 2) || MAP.solidAt(nx - 4, ny + 3) || MAP.solidAt(nx + 4, ny + 3);
  },

  update(dt, ix, iy) {
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
