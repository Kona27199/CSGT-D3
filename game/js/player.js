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
  vehSprite(veh) { return SPR.patrol(veh); },

  /* Ô xe tuần tra được phép đi: ô tô trên lòng đường/lề; mô tô thêm vỉa hè */
  vehBlocked(nx, ny) {
    const m = MAP.cur, h = PLAYER.veh === 'car' ? 5 : 3;
    const ok = (x, y) => {
      const t = MAP.get(m, Math.floor(x / TILE), Math.floor(y / TILE));
      return t === T.ROAD || t === T.SHOULDER || (PLAYER.veh === 'moto' && (t === T.WALK || t === T.DIRT || t === T.YARD));
    };
    if (m.island && Math.hypot(nx - m.island.x, ny - m.island.y) < m.island.r + h) return true;
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
    const spr = PLAYER.spr, L = spr.width / RS - 2, W = spr.height / RS - 2;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.drawImage(spr, -Math.floor(L / 2) - 1, -Math.floor(W / 2) - 1, L + 2, W + 2);
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
    const step = PLAYER.moving ? (Math.floor(PLAYER.anim) % 2) : -1;
    const spr = SPR.officer(PLAYER.face, step);
    g.drawImage(spr, Math.round(PLAYER.x - cam.x) - 7, Math.round(PLAYER.y - cam.y) - 16, 14, 20);
  }
};
