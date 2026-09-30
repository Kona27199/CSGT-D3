'use strict';
/* Bản đồ: sinh lưới ô (tile), làn đường, giao lộ, biển báo; vẽ sẵn nền ra canvas phụ */
const TILE = 16;
const T = { GRASS: 0, WALK: 1, ROAD: 2, BUILD: 3, TREE: 4, SHOULDER: 5 };

const MAP = {
  cur: null,

  build(kind) {
    const m = kind === 'highway' ? MAP.buildHighway() : MAP.buildCity();
    m.kind = kind;
    m.pw = m.w * TILE; m.ph = m.h * TILE;
    MAP.computeStops(m);
    MAP.prerender(m);
    MAP.cur = m;
    return m;
  },

  newGrid(w, h) {
    return { w: w, h: h, tiles: new Uint8Array(w * h), buildings: [], trees: [], lanes: [], inters: [], lamps: [], signs: [], marks: [] };
  },
  set(m, x, y, t) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.tiles[y * m.w + x] = t; },
  get(m, x, y) { if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.BUILD; return m.tiles[y * m.w + x]; },
  fill(m, x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) MAP.set(m, x, y, t); },
  solidAt(px, py) {
    const m = MAP.cur, t = MAP.get(m, Math.floor(px / TILE), Math.floor(py / TILE));
    return t === T.BUILD || t === T.TREE;
  },

  /* Làn xe: axis 'x' (ngang) / 'y' (dọc); dir +1/-1; pos = tâm làn theo trục vuông góc; curb = mép lề bên phải */
  lane(m, axis, dir, pos, curb, limit, opts) {
    const L = Object.assign({ id: m.lanes.length, axis: axis, dir: dir, pos: pos, curb: curb, limit: limit, wrong: false, stops: [], timer: 0 }, opts || {});
    L.len = axis === 'x' ? m.w * TILE : m.h * TILE;
    m.lanes.push(L);
    return L;
  },

  /* Chia khu đất thành các tòa nhà, chừa lối cây xanh */
  fillBlock(m, x0, y0, x1, y1) {
    let by = y0 + 1;
    while (by + 2 <= y1 - 1) {
      let h = U.int(3, 5);
      if (by + h - 1 > y1 - 1) h = y1 - 1 - by + 1;
      if (h < 3) break;
      let bx = x0 + 1;
      while (bx + 2 <= x1 - 1) {
        let w = U.int(4, 7);
        if (bx + w - 1 > x1 - 1) w = x1 - 1 - bx + 1;
        if (w < 3) break;
        if (U.chance(0.85)) {
          MAP.fill(m, bx, by, bx + w - 1, by + h - 1, T.BUILD);
          m.buildings.push({ x: bx, y: by, w: w, h: h, c: U.pick(['#b5523b', '#8c5a3c', '#6d7f99', '#a67c52', '#7e6b8f', '#c08457', '#5f7d6e', '#9b4f4f']) });
        }
        bx += w + 1;
      }
      by += h + 2;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (MAP.get(m, x, y) === T.GRASS && U.chance(0.18)) {
        let ok = true;
        for (const L of m.lamps) if (Math.abs(L.x - (x * TILE + 8)) < 16 && Math.abs(L.y - (y * TILE + 8)) < 16) ok = false;
        if (ok) { MAP.set(m, x, y, T.TREE); m.trees.push({ x: x, y: y }); }
      }
    }
  },

  buildCity() {
    const W = 64, H = 40, m = MAP.newGrid(W, H);
    /* vỉa hè */
    MAP.fill(m, 0, 3, W - 1, 4, T.WALK); MAP.fill(m, 0, 8, W - 1, 9, T.WALK);
    MAP.fill(m, 0, 15, W - 1, 16, T.WALK); MAP.fill(m, 0, 21, W - 1, 22, T.WALK);
    MAP.fill(m, 28, 0, 29, H - 1, T.WALK); MAP.fill(m, 32, 0, 33, H - 1, T.WALK);
    /* lòng đường */
    MAP.fill(m, 0, 5, W - 1, 7, T.ROAD);     // đường một chiều (chiều Đông)
    MAP.fill(m, 0, 17, W - 1, 20, T.ROAD);   // đại lộ 4 làn
    MAP.fill(m, 30, 0, 31, H - 1, T.ROAD);   // phố dọc 2 làn
    const lim = 50;
    /* đại lộ: hàng 17-18 chiều Tây, 19-20 chiều Đông */
    MAP.lane(m, 'x', -1, 17 * TILE + 8, 17 * TILE, lim);
    MAP.lane(m, 'x', -1, 18 * TILE + 8, 17 * TILE, lim);
    MAP.lane(m, 'x', 1, 19 * TILE + 8, 21 * TILE, lim);
    MAP.lane(m, 'x', 1, 20 * TILE + 8, 21 * TILE, lim);
    /* đường một chiều: hàng 6-7 chiều Đông hợp lệ; hàng 5 = làn xe đi ngược chiều */
    MAP.lane(m, 'x', 1, 6 * TILE + 8, 8 * TILE, lim, { oneway: true });
    MAP.lane(m, 'x', 1, 7 * TILE + 8, 8 * TILE, lim, { oneway: true });
    MAP.lane(m, 'x', -1, 5 * TILE + 6, 5 * TILE, lim, { wrong: true, oneway: true });
    /* phố dọc: cột 30 đi Nam, cột 31 đi Bắc */
    MAP.lane(m, 'y', 1, 30 * TILE + 8, 30 * TILE, lim);
    MAP.lane(m, 'y', -1, 31 * TILE + 8, 32 * TILE, lim);
    /* giao lộ có đèn */
    m.inters.push({ id: 0, x0: 30 * TILE, x1: 32 * TILE, y0: 5 * TILE, y1: 8 * TILE, phase: 0, t: 0 });
    m.inters.push({ id: 1, x0: 30 * TILE, x1: 32 * TILE, y0: 17 * TILE, y1: 21 * TILE, phase: 2, t: 0 });
    /* đèn đường */
    for (let x = 2; x < W; x += 6) {
      if (x >= 27 && x <= 34) continue;
      m.lamps.push({ x: x * TILE + 8, y: 15 * TILE + 3 }); m.lamps.push({ x: x * TILE + 8, y: 22 * TILE + 13 });
      m.lamps.push({ x: x * TILE + 8, y: 4 * TILE + 3 }); m.lamps.push({ x: x * TILE + 8, y: 8 * TILE + 13 });
    }
    for (let y = 1; y < H; y += 6) {
      if ((y >= 2 && y <= 10) || (y >= 14 && y <= 23)) continue;
      m.lamps.push({ x: 29 * TILE + 13, y: y * TILE + 8 }); m.lamps.push({ x: 32 * TILE + 3, y: y * TILE + 8 });
    }
    /* biển báo */
    m.signs.push({ x: 2 * TILE + 8, y: 22 * TILE + 6, type: 'limit', v: lim });
    m.signs.push({ x: 61 * TILE + 8, y: 15 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 29 * TILE + 6, y: 1 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 32 * TILE + 10, y: 38 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 62 * TILE + 8, y: 4 * TILE + 6, type: 'noentry' });
    m.signs.push({ x: 34 * TILE + 8, y: 4 * TILE + 6, type: 'noentry' });
    m.signs.push({ x: 1 * TILE + 8, y: 8 * TILE + 10, type: 'oneway' });
    m.signs.push({ x: 27 * TILE + 8, y: 8 * TILE + 10, type: 'oneway' });
    /* khu nhà */
    const blocks = [[0, 0, 27, 2], [34, 0, 63, 2], [0, 10, 27, 14], [34, 10, 63, 14], [0, 23, 27, 39], [34, 23, 63, 39]];
    for (const b of blocks) MAP.fillBlock(m, b[0], b[1], b[2], b[3]);
    /* trường học (Ca 1) */
    m.school = { x: 4, y: 24 };
    m.spawn = { x: 29 * TILE + 8, y: 16 * TILE + 4 };
    m.accidentSpot = { lane: 2, s: 44 * TILE };
    return m;
  },

  buildHighway() {
    const W = 80, H = 30, m = MAP.newGrid(W, H);
    MAP.fill(m, 0, 11, W - 1, 11, T.SHOULDER);
    MAP.fill(m, 0, 16, W - 1, 16, T.SHOULDER);
    MAP.fill(m, 0, 12, W - 1, 15, T.ROAD);
    const lim = 60;
    MAP.lane(m, 'x', -1, 12 * TILE + 8, 11 * TILE + 2, lim);
    MAP.lane(m, 'x', -1, 13 * TILE + 8, 11 * TILE + 2, lim);
    MAP.lane(m, 'x', 1, 14 * TILE + 8, 17 * TILE - 2, lim);
    MAP.lane(m, 'x', 1, 15 * TILE + 8, 17 * TILE - 2, lim);
    for (let x = 3; x < W; x += 9) { m.lamps.push({ x: x * TILE + 8, y: 11 * TILE + 2 }); m.lamps.push({ x: x * TILE + 8, y: 16 * TILE + 14 }); }
    for (let x = 6; x < W; x += 24) {
      m.signs.push({ x: x * TILE + 8, y: 17 * TILE + 6, type: 'limit', v: lim });
      m.signs.push({ x: (x + 12) * TILE + 8, y: 10 * TILE + 8, type: 'limit', v: lim });
    }
    /* trạm kiểm soát tạm thời: dải đất rộng bên phải chiều Đông */
    MAP.fill(m, 34, 17, 46, 18, T.WALK);
    MAP.fillBlock(m, 0, 0, W - 1, 9);
    MAP.fillBlock(m, 0, 19, 33, H - 1);
    MAP.fillBlock(m, 47, 19, W - 1, H - 1);
    for (let x = 35; x <= 45; x++) for (let y = 19; y <= 21; y++) if (MAP.get(m, x, y) !== T.GRASS) MAP.set(m, x, y, T.GRASS);
    m.buildings = m.buildings.filter(b => !(b.x + b.w > 34 && b.x < 47 && b.y + b.h > 17 && b.y < 22));
    m.trees = m.trees.filter(t => MAP.get(m, t.x, t.y) === T.TREE);
    m.spawn = { x: 40 * TILE, y: 17 * TILE + 4 };
    m.accidentSpot = { lane: 2, s: 30 * TILE };
    return m;
  },

  /* Tính vạch dừng của từng làn trước mỗi giao lộ */
  computeStops(m) {
    for (const L of m.lanes) {
      L.stops = [];
      for (const I of m.inters) {
        const a0 = L.axis === 'x' ? I.x0 : I.y0, a1 = L.axis === 'x' ? I.x1 : I.y1;
        const c0 = L.axis === 'x' ? I.y0 : I.x0, c1 = L.axis === 'x' ? I.y1 : I.x1;
        if (L.pos < c0 || L.pos > c1) continue;
        L.stops.push({ inter: I, at: L.dir > 0 ? a0 - 14 : a1 + 14, a0: a0, a1: a1 });
      }
      L.stops.sort((p, q) => (p.at - q.at) * L.dir);
    }
  },

  /* ---------------- VẼ NỀN TĨNH ---------------- */
  prerender(m) {
    const cv = document.createElement('canvas');
    cv.width = m.pw; cv.height = m.ph;
    const g = cv.getContext('2d');
    const noise = (x, y, base, a, b, p) => {
      g.fillStyle = base; g.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 6; i++) {
        if (U.rand() < p) { g.fillStyle = U.rand() < 0.5 ? a : b; g.fillRect(x + U.int(0, 15), y + U.int(0, 15), 1, 1); }
      }
    };
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = MAP.get(m, tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.GRASS || t === T.TREE || t === T.BUILD) {
        noise(x, y, '#5b9a45', '#4d8a3b', '#6fae55', 0.9);
        if (U.rand() < 0.08) { g.fillStyle = U.pick(['#e8d15a', '#e87a9b', '#ffffff']); g.fillRect(x + U.int(2, 13), y + U.int(2, 13), 1, 1); }
      } else if (t === T.WALK) {
        g.fillStyle = '#b8b0a2'; g.fillRect(x, y, TILE, TILE);
        g.fillStyle = '#a69e90'; g.fillRect(x, y, TILE, 1); g.fillRect(x, y + 8, TILE, 1); g.fillRect(x, y, 1, 8); g.fillRect(x + 8, y + 8, 1, 8);
      } else if (t === T.ROAD) {
        noise(x, y, '#41444b', '#3a3d43', '#4a4d54', 0.8);
      } else if (t === T.SHOULDER) {
        noise(x, y, '#5a5d63', '#52555b', '#63666c', 0.8);
      }
    }
    /* vạch kẻ đường */
    const dashH = (y, col, x0, x1) => { g.fillStyle = col; for (let x = x0; x < x1; x += 12) g.fillRect(x, y, 7, 1); };
    const dashV = (x, col, y0, y1) => { g.fillStyle = col; for (let y = y0; y < y1; y += 12) g.fillRect(x, y, 1, 7); };
    const inBoxX = x => m.inters.some(I => x >= I.x0 - 14 && x <= I.x1 + 14);
    const inBoxY = (y, x) => m.inters.some(I => y >= I.y0 - 14 && y <= I.y1 + 14 && x >= I.x0 && x <= I.x1);
    if (m.kind === 'city' || !m.kind) {
      for (let x = 0; x < m.pw; x += 12) {
        if (inBoxX(x) || inBoxX(x + 7)) continue;
        g.fillStyle = '#e8c547'; g.fillRect(x, 19 * TILE - 2, 8, 1); g.fillRect(x, 19 * TILE + 1, 8, 1); // vạch đôi vàng
        g.fillStyle = '#d8d8d8'; g.fillRect(x, 18 * TILE, 7, 1); g.fillRect(x, 20 * TILE, 7, 1);
        g.fillRect(x, 6 * TILE, 7, 1); g.fillRect(x, 7 * TILE, 7, 1);
      }
      for (let y = 0; y < m.ph; y += 12) {
        if (inBoxY(y, 31 * TILE) || inBoxY(y + 7, 31 * TILE)) continue;
        g.fillStyle = '#e8c547'; g.fillRect(31 * TILE, y, 1, 7);
      }
      /* vạch đi bộ + vạch dừng */
      for (const I of m.inters) {
        g.fillStyle = '#e6e6e6';
        for (let y = I.y0 + 1; y < I.y1; y += 4) { g.fillRect(I.x0 - 12, y, 10, 2); g.fillRect(I.x1 + 2, y, 10, 2); }
        for (let x = I.x0 + 1; x < I.x1; x += 4) { g.fillRect(x, I.y0 - 12, 2, 10); g.fillRect(x, I.y1 + 2, 2, 10); }
      }
      for (const L of m.lanes) {
        if (L.wrong) continue;
        for (const S of L.stops) {
          g.fillStyle = '#ffffff';
          const at = S.at + (L.dir > 0 ? 1 : -3);
          if (L.axis === 'x') g.fillRect(at, L.pos - 8, 2, 16); else g.fillRect(L.pos - 8, at, 16, 2);
        }
      }
      /* mũi tên chỉ hướng trên đường một chiều */
      g.fillStyle = '#d8d8d8';
      for (let x = 6 * TILE; x < m.pw; x += 14 * TILE) {
        if (inBoxX(x) || inBoxX(x + 12)) continue;
        for (const row of [6, 7]) {
          const yy = row * TILE + 7;
          g.fillRect(x, yy, 9, 2); g.fillRect(x + 7, yy - 2, 2, 6); g.fillRect(x + 9, yy - 1, 2, 4);
        }
      }
    } else {
      /* quốc lộ */
      g.fillStyle = '#f0f0f0'; g.fillRect(0, 12 * TILE, m.pw, 1); g.fillRect(0, 16 * TILE - 1, m.pw, 1);
      for (let x = 0; x < m.pw; x += 12) {
        g.fillStyle = '#e8c547'; g.fillRect(x, 14 * TILE - 2, 8, 1); g.fillRect(x, 14 * TILE + 1, 8, 1);
      }
      dashH(13 * TILE, '#d8d8d8', 0, m.pw); dashH(15 * TILE, '#d8d8d8', 0, m.pw);
    }
    /* cây */
    for (const t of m.trees) MAP.drawTree(g, t.x * TILE, t.y * TILE);
    /* nhà */
    for (const b of m.buildings) MAP.drawBuilding(g, b);
    /* biển báo + cột đèn */
    for (const s of m.signs) MAP.drawSign(g, s);
    for (const l of m.lamps) { g.fillStyle = '#2c2f33'; g.fillRect(l.x - 1, l.y - 1, 3, 3); g.fillStyle = '#d9d2a0'; g.fillRect(l.x, l.y, 1, 1); }
    if (m.school) {
      const sx = m.school.x * TILE, sy = m.school.y * TILE;
      g.fillStyle = '#f4f4f4'; g.fillRect(sx, sy - 2, 40, 7);
      MAP.pixelText(g, 'TRUONG', sx + 2, sy - 1, '#c0392b');
    }
    m.bg = cv;
  },

  drawTree(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 3, y + 11, 12, 4);
    g.fillStyle = '#6b4a2b'; g.fillRect(x + 7, y + 9, 3, 5);
    g.fillStyle = '#2f6b2f'; g.fillRect(x + 2, y + 2, 12, 9); g.fillRect(x + 4, y, 8, 13);
    g.fillStyle = '#3f8a3a'; g.fillRect(x + 4, y + 2, 7, 6); g.fillRect(x + 3, y + 4, 2, 3);
    g.fillStyle = '#5aa84c'; g.fillRect(x + 5, y + 2, 3, 2);
  },

  drawBuilding(g, b) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, y + 3, w, h);
    const roofH = h - 12;
    g.fillStyle = b.c; g.fillRect(x, y, w, roofH);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, roofH);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y + roofH - 2, w, 2);
    for (let i = x + 6; i < x + w - 4; i += 10) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(i, y + 4, 1, roofH - 8); }
    /* mặt tiền */
    g.fillStyle = '#e3d9c6'; g.fillRect(x, y + roofH, w, 12);
    g.fillStyle = '#c9bea9'; g.fillRect(x, y + roofH + 11, w, 1);
    for (let i = x + 3; i < x + w - 5; i += 8) { g.fillStyle = '#5a7fa8'; g.fillRect(i, y + roofH + 3, 4, 4); g.fillStyle = '#9fc3e6'; g.fillRect(i, y + roofH + 3, 2, 1); }
    const dx = x + Math.floor(w / 2) - 2;
    g.fillStyle = '#6b4a2b'; g.fillRect(dx, y + roofH + 5, 5, 7);
  },

  drawSign(g, s) {
    const x = Math.round(s.x), y = Math.round(s.y);
    g.fillStyle = '#6d6d6d'; g.fillRect(x, y, 1, 6);
    if (s.type === 'limit') {
      g.fillStyle = '#d62828'; g.fillRect(x - 5, y - 13, 13, 13); g.fillRect(x - 4, y - 14, 11, 15); g.fillRect(x - 6, y - 12, 15, 11);
      g.fillStyle = '#ffffff'; g.fillRect(x - 4, y - 12, 11, 11); g.fillRect(x - 3, y - 13, 9, 13); g.fillRect(x - 5, y - 11, 13, 9);
      MAP.pixelText(g, String(s.v), x - 2, y - 9, '#111111');
    } else if (s.type === 'noentry') {
      g.fillStyle = '#d62828'; g.fillRect(x - 5, y - 11, 11, 11); g.fillRect(x - 4, y - 12, 9, 13);
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 7, 7, 3);
    } else if (s.type === 'oneway') {
      g.fillStyle = '#1d5fbf'; g.fillRect(x - 5, y - 11, 11, 11);
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 6, 6, 1); g.fillRect(x + 1, y - 8, 1, 5); g.fillRect(x + 2, y - 7, 1, 3);
    }
  },

  /* Font pixel 3x5 cho biển báo */
  FONT: {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
    '!': '010010010000010', 'T': '111010010010010', 'R': '110101110101101', 'U': '101101101101111', 'O': '111101101101111',
    'N': '101111111111101', 'G': '111100101101111', 'K': '101110100110101', 'm': '000000111111101', '/': '001001010100100', 'h': '100100111101101'
  },
  pixelText(g, str, x, y, col) {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const f = MAP.FONT[str[i]];
      if (!f) continue;
      for (let p = 0; p < 15; p++) if (f[p] === '1') g.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
    }
  },

  /* Đèn tín hiệu (vẽ mỗi khung hình) */
  drawLights(g, m, cam) {
    const done = {};
    for (const L of m.lanes) {
      if (L.wrong) continue;
      for (const S of L.stops) {
        const key = S.inter.id + L.axis + L.dir;
        if (done[key]) continue;
        done[key] = true;
        const st = TRAFFIC.lightState(S.inter, L.axis);
        let px, py;
        const off = L.dir > 0 ? 6 : -6;
        if (L.axis === 'x') { px = S.at - off; py = L.curb + (L.dir > 0 ? 5 : -12); }
        else { py = S.at - off; px = L.curb + (L.dir > 0 ? -8 : 4); }
        px = Math.round(px - cam.x); py = Math.round(py - cam.y);
        g.fillStyle = '#555'; g.fillRect(px + 1, py + 9, 1, 4);
        g.fillStyle = '#111'; g.fillRect(px - 1, py - 1, 5, 11);
        g.fillStyle = st === 'r' ? '#ff3b30' : '#4a1512'; g.fillRect(px, py, 3, 3);
        g.fillStyle = st === 'y' ? '#ffcc00' : '#4a3d0d'; g.fillRect(px, py + 3, 3, 3);
        g.fillStyle = st === 'g' ? '#34e05a' : '#0f3a18'; g.fillRect(px, py + 6, 3, 3);
      }
    }
  }
};
