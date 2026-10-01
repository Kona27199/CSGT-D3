'use strict';
/* =========================================================================
 * HOẠT CẢNH SỐNG ĐỘNG: người đi bộ, cây đung đưa, khói – bụi – mưa bắn,
 * mặt nước lăn tăn, đàn chim bay
 * ========================================================================= */
const LIFE = {
  peds: [], parts: [], birds: [], t: 0, birdT: 8,

  STYLES: [
    { id: 'a', shirt: '#457b9d', pants: '#2b2d42' },
    { id: 'b', shirt: '#f4f4f4', pants: '#1d3557', bag: '#c1121f' },
    { id: 'c', shirt: '#e76f51', pants: '#3d405b', long: true },
    { id: 'd', shirt: '#90be6d', pants: '#5a4a3a', hat: 'non' },
    { id: 'e', shirt: '#f2cc8f', pants: '#264653', long: true, hair: '#3b2a1d' },
    { id: 'f', shirt: '#b5838d', pants: '#2b2d42', hat: 'non' },
    { id: 'w', shirt: '#2d5f9a', pants: '#1f3d63', hat: 'helmet' },
    { id: 'x', shirt: '#6d597a', pants: '#3a3a3a', bag: '#2a9d8f' }
  ],

  walkable(t) { return t === T.WALK || t === T.DIRT || t === T.YARD; },

  init(m, shift) {
    LIFE.peds = []; LIFE.parts = []; LIFE.birds = []; LIFE.t = 0; LIFE.birdT = U.range(4, 10);
    const n = { city: 34, industrial: 26, rural: 14, highway: 6 }[m.kind] || 10;
    const spots = m.walkSpots.filter(p => LIFE.walkable(MAP.get(m, Math.floor(p.x / TILE), Math.floor(p.y / TILE))));
    for (let i = 0; i < n && spots.length; i++) {
      const sp = U.pick(spots);
      const tx = Math.floor(sp.x / TILE), ty = Math.floor(sp.y / TILE);
      const horiz = LIFE.walkable(MAP.get(m, tx - 1, ty)) || LIFE.walkable(MAP.get(m, tx + 1, ty));
      let style = U.pick(LIFE.STYLES);
      if (m.kind === 'industrial' && U.chance(0.6)) style = LIFE.STYLES[6];
      if (m.kind !== 'industrial' && style.id === 'w') style = LIFE.STYLES[0];
      LIFE.peds.push({
        x: sp.x + U.range(-5, 5), y: sp.y + U.range(-4, 4), ax: horiz ? 'x' : 'y', d: U.chance(0.5) ? 1 : -1,
        sp: U.range(7, 13), style: style, f: U.range(0, 10), pause: 0
      });
    }
  },

  update(dt, cam) {
    LIFE.t += dt;
    const m = MAP.cur;
    for (const p of LIFE.peds) {
      if (p.pause > 0) { p.pause -= dt; continue; }
      if (U.rand() < dt * 0.04) { p.pause = U.range(1, 4); continue; }
      const nx = p.x + (p.ax === 'x' ? p.d * p.sp * dt : 0), ny = p.y + (p.ax === 'y' ? p.d * p.sp * dt : 0);
      const ahead = MAP.get(m, Math.floor((nx + (p.ax === 'x' ? p.d * 4 : 0)) / TILE), Math.floor((ny + (p.ax === 'y' ? p.d * 4 : 0)) / TILE));
      if (!LIFE.walkable(ahead)) { p.d = -p.d; continue; }
      p.x = nx; p.y = ny; p.f += dt * p.sp * 0.35;
    }
    /* khói ống xả xe tải, xe khách; bụi đường đất; ống khói nhà máy; mưa bắn */
    for (const v of TRAFFIC.list) {
      if (!TRAFFIC.inView(v, cam)) continue;
      if ((v.kind === 'truck' || v.kind === 'bus') && v.speed > 5 && U.rand() < dt * 3) {
        const bx = v.axis === 'x' ? v.x - v.dir * v.len / 2 : v.x, by = v.axis === 'y' ? v.y - v.dir * v.len / 2 : v.y + 3;
        LIFE.parts.push({ x: bx, y: by, vx: -v.dir * 4 * (v.axis === 'x'), vy: -3, life: 1.4, max: 1.4, s: 1.5, c: '120,120,120', a: 0.45, grow: 2.2 });
      }
      if (m.kind === 'rural' && v.speed > 20 && U.rand() < dt * 1.5) {
        LIFE.parts.push({ x: v.x - (v.axis === 'x' ? v.dir * v.len / 2 : 0), y: v.y + 4, vx: 0, vy: -1, life: 1, max: 1, s: 2, c: '190,160,110', a: 0.3, grow: 3 });
      }
    }
    for (const pr of m.props) {
      if (pr.type !== 'chimney' || U.rand() > dt * 4) continue;
      LIFE.parts.push({ x: pr.x + 3.5 + U.range(-1, 1), y: pr.y + 2, vx: 3 + U.range(0, 2), vy: -9, life: 3.5, max: 3.5, s: 2, c: '210,210,215', a: 0.5, grow: 3 });
    }
    if (G.shift && G.shift.weather === 'rain') {
      for (let i = 0; i < 6; i++) if (U.rand() < dt * 40) LIFE.parts.push({ x: cam.x + U.rand() * cam.w, y: cam.y + U.rand() * cam.h, vx: 0, vy: 0, life: 0.35, max: 0.35, s: 0.5, c: '190,215,245', a: 0.6, grow: 6, ring: true });
    }
    for (const q of LIFE.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    LIFE.parts = LIFE.parts.filter(q => q.life > 0);
    if (LIFE.parts.length > 400) LIFE.parts.splice(0, LIFE.parts.length - 400);
    /* chim bay ban ngày */
    if (G.shift && G.shift.light !== 'night' && G.shift.weather !== 'rain') {
      LIFE.birdT -= dt;
      if (LIFE.birdT <= 0) {
        LIFE.birdT = U.range(12, 25);
        const fromLeft = U.chance(0.5), y0 = U.range(10, cam.h * 0.6);
        for (let i = 0; i < U.int(3, 6); i++) LIFE.birds.push({ x: fromLeft ? -10 - i * 6 : cam.w + 10 + i * 6, y: y0 + (i % 2 ? 4 : -4) * Math.ceil(i / 2), vx: (fromLeft ? 1 : -1) * U.range(26, 34), ph: U.rand() * 6 });
      }
    }
    for (const b of LIFE.birds) { b.x += b.vx * dt; b.ph += dt * 10; }
    LIFE.birds = LIFE.birds.filter(b => b.x > -40 && b.x < cam.w + 40);
  },

  /* mặt nước lăn tăn (vẽ trên nền) */
  drawWater(g, cam) {
    const m = MAP.cur, t = LIFE.t;
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(m.w - 1, Math.floor((cam.x + cam.w) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(m.h - 1, Math.floor((cam.y + cam.h) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (MAP.get(m, tx, ty) !== T.WATER) continue;
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k * 0.33 + (tx * 7 + ty * 13) % 10 / 10) % 1;
        const a = Math.sin(ph * Math.PI);
        g.fillStyle = 'rgba(200,235,255,' + (a * 0.6).toFixed(2) + ')';
        g.fillRect(tx * TILE + ((tx * 5 + k * 6) % 13) + ph * 2 - cam.x, ty * TILE + ((ty * 3 + k * 5) % 14) - cam.y, 2.5, 0.5);
      }
    }
  },

  drawPeds(g, cam) {
    const rain = G.shift && G.shift.weather === 'rain';
    for (const p of LIFE.peds) {
      if (p.x < cam.x - 10 || p.x > cam.x + cam.w + 10 || p.y < cam.y - 14 || p.y > cam.y + cam.h + 4) continue;
      const fr = p.pause > 0 ? 0 : Math.floor(p.f) % 2;
      g.drawImage(SPR.walker(p.style, fr, rain), Math.round((p.x - cam.x - 4) * 2) / 2, Math.round((p.y - cam.y - 11) * 2) / 2, 8, 13);
    }
  },

  /* cây vẽ mỗi khung hình, tán lay nhẹ theo gió */
  drawTrees(g, cam) {
    const m = MAP.cur, t = LIFE.t, wind = G.shift && G.shift.weather === 'rain' ? 1.2 : 0.5;
    for (const tr of m.trees) {
      const x = tr.x * TILE, y = tr.y * TILE;
      if (x < cam.x - 24 || x > cam.x + cam.w + 8 || y < cam.y - 16 || y > cam.y + cam.h + 16) continue;
      const sway = Math.round(Math.sin(t * 1.3 + tr.x * 0.7 + tr.y) * wind * 2) / 2;
      g.drawImage(SPR.treeSprite(tr.k), x - 2 + sway - cam.x, y - 12 - cam.y, 20, 28);
    }
  },

  drawParts(g, cam) {
    for (const q of LIFE.parts) {
      const k = q.life / q.max, s = q.s + (1 - k) * q.grow;
      const x = q.x - cam.x, y = q.y - cam.y;
      if (x < -10 || y < -10 || x > cam.w + 10 || y > cam.h + 10) continue;
      if (q.ring) { g.strokeStyle = 'rgba(' + q.c + ',' + (q.a * k).toFixed(2) + ')'; g.lineWidth = 0.4; g.strokeRect(x - s / 2, y - s / 4, s, s / 2); continue; }
      g.fillStyle = 'rgba(' + q.c + ',' + (q.a * k).toFixed(2) + ')';
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
  },

  drawBirds(g) {
    g.fillStyle = 'rgba(30,30,40,0.85)';
    for (const b of LIFE.birds) {
      const up = Math.sin(b.ph) > 0;
      g.fillRect(b.x - 2, b.y + (up ? -1 : 0.5), 1.5, 0.75); g.fillRect(b.x - 0.5, b.y, 1, 0.75); g.fillRect(b.x + 0.5, b.y + (up ? -1 : 0.5), 1.5, 0.75);
    }
  }
};
