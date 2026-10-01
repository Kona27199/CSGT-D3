'use strict';
/* Bản đồ: sinh lưới ô (tile), làn đường, giao lộ, biển báo; vẽ sẵn nền chi tiết ra canvas phụ (độ phân giải RS) */
const TILE = 16;
const T = { GRASS: 0, WALK: 1, ROAD: 2, BUILD: 3, TREE: 4, SHOULDER: 5, WATER: 6, PADDY: 7, DIRT: 8, YARD: 9 };

const MAP = {
  cur: null,
  NAMES: { city: 'Phố đô thị', highway: 'Quốc lộ', rural: 'Nông thôn', industrial: 'Khu công nghiệp' },

  build(kind) {
    const B = { highway: MAP.buildHighway, rural: MAP.buildRural, industrial: MAP.buildIndustrial }[kind] || MAP.buildCity;
    const m = B();
    m.kind = kind;
    m.pw = m.w * TILE; m.ph = m.h * TILE;
    MAP.decorate(m);
    MAP.computeStops(m);
    MAP.computeWalkSpots(m);
    MAP.prerender(m);
    MAP.cur = m;
    return m;
  },

  newGrid(w, h) {
    return { w: w, h: h, tiles: new Uint8Array(w * h), buildings: [], trees: [], lanes: [], inters: [], lamps: [], signs: [], props: [], bridges: [], poles: [], parked: [], manholes: [], bumps: [], windows: [] };
  },
  set(m, x, y, t) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.tiles[y * m.w + x] = t; },
  get(m, x, y) { if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.BUILD; return m.tiles[y * m.w + x]; },
  fill(m, x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) MAP.set(m, x, y, t); },
  fillIf(m, x0, y0, x1, y1, from, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (MAP.get(m, x, y) === from) MAP.set(m, x, y, t); },
  solidAt(px, py) {
    const m = MAP.cur, t = MAP.get(m, Math.floor(px / TILE), Math.floor(py / TILE));
    return t === T.BUILD || t === T.TREE || t === T.WATER;
  },

  /* Làn xe: axis 'x' (ngang) / 'y' (dọc); dir +1/-1; pos = tâm làn theo trục vuông góc; curb = mép lề bên phải */
  lane(m, axis, dir, pos, curb, limit, opts) {
    const L = Object.assign({ id: m.lanes.length, axis: axis, dir: dir, pos: pos, curb: curb, limit: limit, wrong: false, stops: [], timer: 0 }, opts || {});
    L.len = axis === 'x' ? m.w * TILE : m.h * TILE;
    m.lanes.push(L);
    return L;
  },

  addTree(m, x, y, kind) {
    if (MAP.get(m, x, y) !== T.GRASS) return;
    for (const L of m.lamps) if (Math.abs(L.x - (x * TILE + 8)) < 16 && Math.abs(L.y - (y * TILE + 8)) < 16) return;
    MAP.set(m, x, y, T.TREE);
    m.trees.push({ x: x, y: y, k: kind || 'round' });
  },

  /* Chia khu đất thành các công trình theo kiểu (style), chừa lối cây xanh */
  fillBlock(m, x0, y0, x1, y1, style, treeKind, opt) {
    opt = opt || {};
    const wMin = opt.wMin || 4, wMax = opt.wMax || 7, hMin = opt.hMin || 3, hMax = opt.hMax || 5, gap = opt.gap || 1;
    let by = y0 + 1;
    while (by + 2 <= y1 - 1) {
      let h = U.int(hMin, hMax);
      if (by + h - 1 > y1 - 1) h = y1 - 1 - by + 1;
      if (h < 3) break;
      let bx = x0 + 1;
      while (bx + 2 <= x1 - 1) {
        let w = U.int(wMin, wMax);
        if (bx + w - 1 > x1 - 1) w = x1 - 1 - bx + 1;
        if (w < 3) break;
        let free = true;
        for (let y = by; y < by + h && free; y++) for (let x = bx; x < bx + w; x++) if (MAP.get(m, x, y) !== T.GRASS) { free = false; break; }
        if (free && U.chance(opt.p || 0.85)) {
          MAP.fill(m, bx, by, bx + w - 1, by + h - 1, T.BUILD);
          const st = typeof style === 'function' ? style() : style;
          m.buildings.push({ x: bx, y: by, w: w, h: h, style: st, c: MAP.palette(st), seed: Math.floor(U.rand() * 1e6) });
        }
        bx += w + gap;
      }
      by += h + 2;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (MAP.get(m, x, y) === T.GRASS && U.chance(opt.trees != null ? opt.trees : 0.18)) MAP.addTree(m, x, y, typeof treeKind === 'function' ? treeKind() : treeKind);
    }
  },

  palette(st) {
    if (st === 'house') return U.pick(['#efd9a0', '#f2e2b8', '#e8c99a', '#f0e4c8', '#dfe7c8']);
    if (st === 'factory') return U.pick(['#9fb2c2', '#a8b8a8', '#b4a89a', '#98a8b8']);
    if (st === 'dorm') return U.pick(['#efe6d2', '#e2ead8', '#f0dcd0']);
    return U.pick(['#e8d8b0', '#cfe0e8', '#f0c9b0', '#d8e8c8', '#e8c8d8', '#f2e6c2', '#d6d0e8']);
  },

  /* ================= BẢN ĐỒ 1: PHỐ ĐÔ THỊ ================= */
  buildCity() {
    const W = 64, H = 40, m = MAP.newGrid(W, H);
    MAP.fill(m, 0, 3, W - 1, 4, T.WALK); MAP.fill(m, 0, 8, W - 1, 9, T.WALK);
    MAP.fill(m, 0, 15, W - 1, 16, T.WALK); MAP.fill(m, 0, 21, W - 1, 22, T.WALK);
    MAP.fill(m, 28, 0, 29, H - 1, T.WALK); MAP.fill(m, 32, 0, 33, H - 1, T.WALK);
    MAP.fill(m, 0, 5, W - 1, 7, T.ROAD);
    MAP.fill(m, 0, 17, W - 1, 20, T.ROAD);
    MAP.fill(m, 30, 0, 31, H - 1, T.ROAD);
    const lim = 50;
    MAP.lane(m, 'x', -1, 17 * TILE + 8, 17 * TILE, lim);
    MAP.lane(m, 'x', -1, 18 * TILE + 8, 17 * TILE, lim);
    MAP.lane(m, 'x', 1, 19 * TILE + 8, 21 * TILE, lim);
    MAP.lane(m, 'x', 1, 20 * TILE + 8, 21 * TILE, lim);
    MAP.lane(m, 'x', 1, 6 * TILE + 8, 8 * TILE, lim, { oneway: true });
    MAP.lane(m, 'x', 1, 7 * TILE + 8, 8 * TILE, lim, { oneway: true });
    MAP.lane(m, 'x', -1, 5 * TILE + 6, 5 * TILE, lim, { wrong: true, oneway: true });
    MAP.lane(m, 'y', 1, 30 * TILE + 8, 30 * TILE, lim);
    MAP.lane(m, 'y', -1, 31 * TILE + 8, 32 * TILE, lim);
    m.inters.push({ id: 0, x0: 30 * TILE, x1: 32 * TILE, y0: 5 * TILE, y1: 8 * TILE, phase: 0, t: 0 });
    m.inters.push({ id: 1, x0: 30 * TILE, x1: 32 * TILE, y0: 17 * TILE, y1: 21 * TILE, phase: 2, t: 0 });
    for (let x = 2; x < W; x += 6) {
      if (x >= 27 && x <= 34) continue;
      m.lamps.push({ x: x * TILE + 8, y: 15 * TILE + 3 }); m.lamps.push({ x: x * TILE + 8, y: 22 * TILE + 13 });
      m.lamps.push({ x: x * TILE + 8, y: 4 * TILE + 3 }); m.lamps.push({ x: x * TILE + 8, y: 8 * TILE + 13 });
    }
    for (let y = 1; y < H; y += 6) {
      if ((y >= 2 && y <= 10) || (y >= 14 && y <= 23)) continue;
      m.lamps.push({ x: 29 * TILE + 13, y: y * TILE + 8 }); m.lamps.push({ x: 32 * TILE + 3, y: y * TILE + 8 });
    }
    m.signs.push({ x: 2 * TILE + 8, y: 22 * TILE + 6, type: 'limit', v: lim });
    m.signs.push({ x: 61 * TILE + 8, y: 15 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 29 * TILE + 6, y: 1 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 32 * TILE + 10, y: 38 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 62 * TILE + 8, y: 4 * TILE + 6, type: 'noentry' });
    m.signs.push({ x: 34 * TILE + 8, y: 4 * TILE + 6, type: 'noentry' });
    m.signs.push({ x: 1 * TILE + 8, y: 8 * TILE + 10, type: 'oneway' });
    m.signs.push({ x: 27 * TILE + 8, y: 8 * TILE + 10, type: 'oneway' });
    const blocks = [[0, 0, 27, 2], [34, 0, 63, 2], [0, 10, 27, 14], [34, 10, 63, 14], [0, 23, 27, 39], [34, 23, 63, 39]];
    for (const b of blocks) MAP.fillBlock(m, b[0], b[1], b[2], b[3], 'shop', 'round');
    for (let x = 3; x < W; x += 9) if (x < 26 || x > 35) m.props.push({ type: 'bench', x: x * TILE + 3, y: 22 * TILE + 9 });
    MAP.meta(m, 3, { x: 14 * TILE, y: 21 * TILE + 10 }, { x: 12 * TILE, y: 20 * TILE + 8 }, { lane: 2, s: 44 * TILE });
    m.oneway = true;
    return m;
  },

  /* ================= BẢN ĐỒ 2: QUỐC LỘ ================= */
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
    MAP.fill(m, 34, 17, 46, 18, T.WALK);
    /* hai bên quốc lộ: ruộng lúa xen làng xóm */
    MAP.fill(m, 0, 0, W - 1, 6, T.PADDY);
    MAP.fill(m, 0, 23, W - 1, H - 1, T.PADDY);
    MAP.fillIf(m, 18, 0, 30, 6, T.PADDY, T.GRASS); MAP.fillIf(m, 54, 0, 66, 6, T.PADDY, T.GRASS);
    MAP.fillIf(m, 6, 23, 18, H - 1, T.PADDY, T.GRASS); MAP.fillIf(m, 50, 23, 62, H - 1, T.PADDY, T.GRASS);
    MAP.fillBlock(m, 0, 6, W - 1, 10, () => U.pick(['house', 'shop']), () => U.pick(['round', 'palm']), { hMax: 3 });
    MAP.fillBlock(m, 18, 0, 30, 6, 'house', 'bamboo'); MAP.fillBlock(m, 54, 0, 66, 6, 'house', 'bamboo');
    MAP.fillBlock(m, 0, 19, 33, 23, () => U.pick(['house', 'shop']), 'round', { hMax: 3 });
    MAP.fillBlock(m, 47, 19, W - 1, 23, () => U.pick(['house', 'shop']), 'round', { hMax: 3 });
    MAP.fillBlock(m, 6, 23, 18, H - 1, 'house', 'bamboo'); MAP.fillBlock(m, 50, 23, 62, H - 1, 'house', 'bamboo');
    for (let x = 35; x <= 45; x++) for (let y = 19; y <= 21; y++) if (MAP.get(m, x, y) !== T.GRASS && MAP.get(m, x, y) !== T.PADDY) MAP.set(m, x, y, T.GRASS);
    m.buildings = m.buildings.filter(b => !(b.x + b.w > 34 && b.x < 47 && b.y + b.h > 17 && b.y < 22));
    m.trees = m.trees.filter(t => MAP.get(m, t.x, t.y) === T.TREE);
    for (let i = 0; i < 6; i++) m.props.push({ type: 'haystack', x: U.int(2, W - 3) * TILE, y: U.pick([U.int(1, 4), U.int(25, 28)]) * TILE });
    MAP.meta(m, 3, { x: 40 * TILE, y: 16 * TILE + 10 }, { x: 40 * TILE, y: 16 * TILE + 8 }, { lane: 2, s: 30 * TILE });
    return m;
  },

  /* ================= BẢN ĐỒ 3: NÔNG THÔN ================= */
  buildRural() {
    const W = 72, H = 40, m = MAP.newGrid(W, H);
    MAP.fill(m, 0, 0, W - 1, H - 1, T.PADDY);
    /* làng xóm quanh ngã tư chợ */
    MAP.fill(m, 24, 11, 49, 16, T.GRASS); MAP.fill(m, 24, 21, 49, 28, T.GRASS);
    MAP.fill(m, 4, 21, 14, 26, T.GRASS); MAP.fill(m, 58, 11, 68, 16, T.GRASS); MAP.fill(m, 56, 23, 68, 30, T.GRASS);
    /* kênh mương + ao */
    MAP.fill(m, 0, 8, W - 1, 9, T.WATER);
    MAP.fill(m, 60, 31, 63, H - 1, T.WATER);
    /* tỉnh lộ (ngang) và đường liên xã (dọc) */
    MAP.fill(m, 0, 17, W - 1, 17, T.DIRT); MAP.fill(m, 0, 20, W - 1, 20, T.DIRT);
    MAP.fill(m, 35, 0, 35, H - 1, T.DIRT); MAP.fill(m, 38, 0, 38, H - 1, T.DIRT);
    MAP.fill(m, 0, 18, W - 1, 19, T.ROAD);
    MAP.fill(m, 36, 0, 37, H - 1, T.ROAD);
    MAP.fill(m, 35, 8, 35, 9, T.SHOULDER); MAP.fill(m, 38, 8, 38, 9, T.SHOULDER);
    m.bridges.push({ x0: 35, y0: 8, x1: 38, y1: 9 });
    /* cầu cống vượt kênh ở cột 60-63 */
    MAP.fill(m, 60, 17, 63, 20, T.ROAD); MAP.fill(m, 60, 17, 63, 17, T.DIRT); MAP.fill(m, 60, 20, 63, 20, T.DIRT);
    const lim = 50;
    MAP.lane(m, 'x', -1, 18 * TILE + 8, 17 * TILE + 2, lim);
    MAP.lane(m, 'x', 1, 19 * TILE + 8, 21 * TILE - 2, lim);
    MAP.lane(m, 'y', 1, 36 * TILE + 8, 35 * TILE + 2, lim);
    MAP.lane(m, 'y', -1, 37 * TILE + 8, 39 * TILE - 2, lim);
    m.inters.push({ id: 0, x0: 36 * TILE, x1: 38 * TILE, y0: 18 * TILE, y1: 20 * TILE, phase: 0, t: 0 });
    for (let x = 24; x <= 49; x += 5) { m.lamps.push({ x: x * TILE + 8, y: 17 * TILE + 2 }); m.lamps.push({ x: x * TILE + 8, y: 20 * TILE + 14 }); }
    m.signs.push({ x: 20 * TILE + 8, y: 20 * TILE + 10, type: 'limit', v: lim });
    m.signs.push({ x: 52 * TILE + 8, y: 17 * TILE + 4, type: 'limit', v: lim });
    m.signs.push({ x: 38 * TILE + 10, y: 30 * TILE + 8, type: 'limit', v: lim });
    MAP.fillBlock(m, 24, 11, 34, 16, 'house', 'bamboo', { wMin: 3, wMax: 5, hMax: 3, trees: 0.3 });
    MAP.fillBlock(m, 39, 11, 49, 16, 'house', 'bamboo', { wMin: 3, wMax: 5, hMax: 3, trees: 0.3 });
    MAP.fillBlock(m, 24, 21, 34, 28, 'house', () => U.pick(['bamboo', 'palm']), { wMin: 3, wMax: 5, hMax: 3, trees: 0.25 });
    MAP.fillBlock(m, 4, 21, 14, 26, 'house', 'palm', { wMin: 3, wMax: 5, hMax: 3, trees: 0.3 });
    MAP.fillBlock(m, 58, 11, 68, 16, 'house', 'bamboo', { wMin: 3, wMax: 5, hMax: 3, trees: 0.3 });
    MAP.fillBlock(m, 56, 23, 59, 30, 'house', 'palm', { wMin: 3, wMax: 3, hMax: 3, trees: 0.3 });
    /* chợ quê cạnh ngã tư */
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 2, y = 21;
      if (MAP.get(m, x, y) === T.GRASS) { MAP.set(m, x, y, T.BUILD); m.props.push({ type: 'stall', x: x * TILE, y: y * TILE, c: U.pick(['#e63946', '#1d4fa3', '#2a9d8f', '#ff7b00']) }); }
    }
    m.trees = m.trees.filter(t => MAP.get(m, t.x, t.y) === T.TREE);
    for (let i = 0; i < 8; i++) m.props.push({ type: 'haystack', x: U.int(1, W - 2) * TILE, y: U.pick([U.int(1, 6), U.int(31, 38)]) * TILE });
    m.props.push({ type: 'boat', x: 10 * TILE, y: 8 * TILE + 8 }); m.props.push({ type: 'boat', x: 52 * TILE, y: 8 * TILE + 6 });
    MAP.meta(m, 1, { x: 14 * TILE, y: 20 * TILE + 10 }, { x: 12 * TILE, y: 19 * TILE + 8 }, { lane: 1, s: 52 * TILE });
    return m;
  },

  /* ================= BẢN ĐỒ 4: KHU CÔNG NGHIỆP ================= */
  buildIndustrial() {
    const W = 72, H = 40, m = MAP.newGrid(W, H);
    MAP.fill(m, 0, 16, W - 1, 16, T.WALK); MAP.fill(m, 0, 23, W - 1, 23, T.WALK);
    MAP.fill(m, 0, 17, W - 1, 17, T.SHOULDER); MAP.fill(m, 0, 22, W - 1, 22, T.SHOULDER);
    MAP.fill(m, 38, 0, 39, H - 1, T.WALK); MAP.fill(m, 42, 0, 43, H - 1, T.WALK);
    MAP.fill(m, 0, 18, W - 1, 21, T.ROAD);
    MAP.fill(m, 40, 0, 41, H - 1, T.ROAD);
    /* sân bê tông nhà máy, bãi container */
    MAP.fill(m, 2, 2, 36, 14, T.YARD); MAP.fill(m, 45, 2, 70, 14, T.YARD);
    MAP.fill(m, 52, 24, 70, 27, T.YARD);
    const lim = 50;
    MAP.lane(m, 'x', -1, 18 * TILE + 8, 17 * TILE + 2, lim);
    MAP.lane(m, 'x', -1, 19 * TILE + 8, 17 * TILE + 2, lim);
    MAP.lane(m, 'x', 1, 20 * TILE + 8, 23 * TILE - 2, lim);
    MAP.lane(m, 'x', 1, 21 * TILE + 8, 23 * TILE - 2, lim);
    MAP.lane(m, 'y', 1, 40 * TILE + 8, 40 * TILE, lim);
    MAP.lane(m, 'y', -1, 41 * TILE + 8, 42 * TILE, lim);
    m.inters.push({ id: 0, x0: 40 * TILE, x1: 42 * TILE, y0: 18 * TILE, y1: 22 * TILE, phase: 0, t: 0 });
    for (let x = 2; x < W; x += 7) { if (x > 36 && x < 45) continue; m.lamps.push({ x: x * TILE + 8, y: 16 * TILE + 8 }); m.lamps.push({ x: x * TILE + 8, y: 23 * TILE + 8 }); }
    for (let y = 2; y < H; y += 7) { if (y > 14 && y < 25) continue; m.lamps.push({ x: 39 * TILE + 12, y: y * TILE + 8 }); m.lamps.push({ x: 42 * TILE + 4, y: y * TILE + 8 }); }
    m.signs.push({ x: 3 * TILE + 8, y: 23 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 68 * TILE + 8, y: 16 * TILE + 8, type: 'limit', v: lim });
    m.signs.push({ x: 42 * TILE + 8, y: 30 * TILE + 8, type: 'limit', v: lim });
    /* nhà xưởng */
    const fac = [[3, 3, 14, 8], [20, 3, 14, 6], [46, 3, 11, 7], [59, 3, 11, 9], [20, 10, 10, 4]];
    for (const f of fac) { MAP.fill(m, f[0], f[1], f[0] + f[2] - 1, f[1] + f[3] - 1, T.BUILD); m.buildings.push({ x: f[0], y: f[1], w: f[2], h: f[3], style: 'factory', c: MAP.palette('factory'), seed: U.int(1, 1e6) }); }
    m.props.push({ type: 'chimney', x: 15 * TILE, y: 3 * TILE + 4 }); m.props.push({ type: 'chimney', x: 67 * TILE, y: 3 * TILE + 4 });
    /* bãi container */
    const cc = ['#c1121f', '#1d4fa3', '#2a9d8f', '#e9c46a', '#6d6875', '#f4a261'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const x = 3 + i * 2.2, y = 12 + j * 0.9;
      m.props.push({ type: 'container', x: x * TILE, y: y * TILE, w: 30, c: U.pick(cc) });
    }
    MAP.fill(m, 3, 12, 11, 13, T.BUILD);
    for (let i = 0; i < 3; i++) m.props.push({ type: 'container', x: (47 + i * 2.2) * TILE, y: 11.5 * TILE, w: 30, c: U.pick(cc) });
    MAP.fill(m, 47, 11, 53, 12, T.BUILD);
    /* cổng KCN trên đường dọc phía Bắc */
    m.props.push({ type: 'gate', x: 38 * TILE, y: 4 * TILE, w: 6 * TILE });
    /* trạm cân xe tải */
    m.props.push({ type: 'scale', x: 54 * TILE, y: 24 * TILE + 8 });
    /* khu nhà trọ công nhân phía Nam */
    MAP.fillBlock(m, 0, 24, 37, H - 1, 'dorm', 'round', { wMin: 5, wMax: 8, hMin: 4, hMax: 5 });
    MAP.fillBlock(m, 44, 28, W - 1, H - 1, () => U.pick(['dorm', 'shop']), 'round', { wMin: 4, wMax: 7 });
    for (let x = 2; x < 36; x += 6) MAP.addTree(m, x, 15, 'round');
    for (let x = 46; x < 70; x += 6) MAP.addTree(m, x, 15, 'round');
    MAP.meta(m, 3, { x: 14 * TILE, y: 22 * TILE + 10 }, { x: 12 * TILE, y: 21 * TILE + 8 }, { lane: 2, s: 52 * TILE });
    return m;
  },

  meta(m, cpLane, cpSpot, vehSpawn, acc) {
    m.cpLane = cpLane; m.cpSpot = cpSpot; m.vehSpawn = vehSpawn; m.accidentSpot = acc;
    m.spawn = cpSpot;
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

  /* Các điểm người đi bộ có thể đứng (lề, vỉa hè cạnh lòng đường) – dùng cho tình huống đặc biệt */
  computeWalkSpots(m) {
    m.walkSpots = [];
    const ok = t => t === T.WALK || t === T.SHOULDER || t === T.DIRT;
    for (let y = 1; y < m.h - 1; y++) for (let x = 2; x < m.w - 2; x++) {
      if (!ok(MAP.get(m, x, y))) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => MAP.get(m, x + dx, y + dy) === T.ROAD)) m.walkSpots.push({ x: x * TILE + 8, y: y * TILE + 8 });
    }
  },

  /* ---------------- VẼ NỀN TĨNH ---------------- */
  prerender(m) {
    const cv = document.createElement('canvas');
    cv.width = m.pw * RS; cv.height = m.ph * RS;
    const g = cv.getContext('2d');
    g.scale(RS, RS);
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const speck = (x, y, n, cols, sz) => { for (let i = 0; i < n; i++) R(x + U.rand() * 16, y + U.rand() * 16, sz || 0.5, sz || 0.5, cols[Math.floor(U.rand() * cols.length)]); };
    const at = (tx, ty) => MAP.get(m, tx, ty);
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = at(tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.GRASS || t === T.TREE || t === T.BUILD) {
        R(x, y, 16, 16, '#5b9a45');
        speck(x, y, 14, ['#4d8a3b', '#6aae52', '#548f40'], 1);
        for (let i = 0; i < 4; i++) { const a = x + U.rand() * 15, b = y + U.rand() * 14; R(a, b, 0.5, 1.5, '#3f7a30'); R(a + 0.5, b + 0.5, 0.5, 1, '#79bd60'); }
        if (U.rand() < 0.1) { R(x + U.int(2, 13), y + U.int(2, 13), 1, 1, U.pick(['#e8d15a', '#e87a9b', '#ffffff', '#b39ddb'])); }
      } else if (t === T.WALK) {
        R(x, y, 16, 16, '#bdb4a5');
        for (let by = 0; by < 16; by += 4) for (let bx = (by % 8 ? 2 : 0) - 4; bx < 16; bx += 4) {
          const c = U.pick(['#c4bbac', '#b8af9f', '#c8c0b2', '#b3aa9a']);
          const x0 = Math.max(0, bx), w = Math.min(4, 16 - x0, bx + 4 - x0);
          if (w > 0) { R(x + x0 + 0.25, y + by + 0.25, w - 0.5, 3.5, c); }
        }
      } else if (t === T.ROAD) {
        R(x, y, 16, 16, '#40434a');
        speck(x, y, 16, ['#383b41', '#4a4d55', '#46494f']);
        if (U.rand() < 0.05) { const a = x + U.int(2, 12), b = y + U.int(2, 12); R(a, b, 3, 0.5, '#2f3136'); R(a + 2.5, b + 0.5, 0.5, 2, '#2f3136'); }
        if (U.rand() < 0.03) R(x + U.int(2, 10), y + U.int(2, 10), 3, 2, 'rgba(20,20,25,0.35)');
      } else if (t === T.SHOULDER) {
        R(x, y, 16, 16, '#5c5f66'); speck(x, y, 12, ['#53565c', '#666970']);
      } else if (t === T.DIRT) {
        R(x, y, 16, 16, '#a2835a'); speck(x, y, 16, ['#8f7350', '#b8996c', '#977a52']);
        for (let i = 0; i < 3; i++) R(x + U.rand() * 15, y + U.rand() * 15, 1, 0.75, '#c9b08a');
      } else if (t === T.YARD) {
        R(x, y, 16, 16, '#a4a9ae'); speck(x, y, 8, ['#9a9fa4', '#b0b5ba']);
        R(x, y, 16, 0.5, '#8e9398'); R(x, y, 0.5, 16, '#8e9398');
      } else if (t === T.WATER) {
        R(x, y, 16, 16, '#3c7fb3');
        for (let i = 0; i < 4; i++) R(x + U.rand() * 12, y + U.rand() * 15, 2 + U.rand() * 2, 0.5, '#5ea3d6');
        if (U.rand() < 0.15) R(x + U.rand() * 14, y + U.rand() * 14, 1, 0.5, '#bfe3ff');
      } else if (t === T.PADDY) {
        R(x, y, 16, 16, '#4b8b39');
        for (let a = 0.5; a < 16; a += 2) { R(x + a, y, 1, 16, '#5ea044'); for (let b = 0.5; b < 16; b += 2) R(x + a, y + b, 1, 1, U.rand() < 0.5 ? '#76b956' : '#69aa4c'); }
        if (U.rand() < 0.2) R(x + U.rand() * 13, y + U.rand() * 14, 2, 0.5, '#8fc1d8');
      }
    }
    /* viền: bờ ruộng, bờ kênh, bó vỉa */
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = at(tx, ty), x = tx * TILE, y = ty * TILE;
      const nb = [[0, -1, x, y, 16, 1], [0, 1, x, y + 15, 16, 1], [-1, 0, x, y, 1, 16], [1, 0, x + 15, y, 1, 16]];
      for (const [dx, dy, a, b, w, h] of nb) {
        const o = at(tx + dx, ty + dy);
        if (t === T.PADDY && o !== T.PADDY) R(a, b, w, h, '#8d7b55');
        if (t === T.WATER && o !== T.WATER && o !== T.ROAD && o !== T.SHOULDER) R(a, b, w, h, '#7a6a4a');
        if (t === T.WALK && o === T.ROAD) R(a + (dx > 0 ? 0.5 : 0), b + (dy > 0 ? 0.5 : 0), dx ? 0.5 : 16, dy ? 0.5 : 16, '#ece7dc');
      }
      if (t === T.PADDY && tx % 4 === 0) R(x, y, 0.75, 16, '#8d7b55');
    }
    /* cầu */
    for (const b of m.bridges) {
      const x0 = b.x0 * TILE, x1 = (b.x1 + 1) * TILE, y0 = b.y0 * TILE - 2, y1 = (b.y1 + 1) * TILE + 2;
      R(x0 - 1, y0, 1, y1 - y0, '#d9d4c8'); R(x1, y0, 1, y1 - y0, '#d9d4c8');
      for (let y = y0; y < y1; y += 2) { R(x0 - 1.5, y, 2, 0.75, '#8a8a8a'); R(x1 - 0.5, y, 2, 0.75, '#8a8a8a'); }
      R(x0 - 2, y0 + 1, 1, y1 - y0 - 2, 'rgba(0,0,0,0.25)');
    }
    MAP.drawMarkings(g, m);
    /* nắp cống, gờ giảm tốc */
    for (const h of m.manholes) { R(h.x - 2, h.y - 2, 4, 4, '#2f3136'); R(h.x - 1.5, h.y - 1.5, 3, 3, '#55585e'); R(h.x - 1.5, h.y - 0.25, 3, 0.5, '#2f3136'); R(h.x - 0.25, h.y - 1.5, 0.5, 3, '#2f3136'); }
    for (const bp of m.bumps) for (let y = bp.y0; y < bp.y1; y += 2) R(bp.x, y, 3, 2, (y / 2) % 2 ? '#1a1a1a' : '#ffd23f');
    for (const p of m.props) if (p.type === 'pond' || p.type === 'scale' || p.type === 'gate') SPR.prop(g, p);
    /* bóng cây, bóng nhà đổ xuống đất (nắng từ hướng Tây Bắc) */
    for (const t of m.trees) { const x = t.x * TILE, y = t.y * TILE; g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 10, y + 13, 8, 4, 0, 0, Math.PI * 2); g.fill(); }
    for (const b of m.buildings) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, hh = b.h * TILE, H = MAP.bHeight(m, b);
      g.fillStyle = 'rgba(0,0,0,0.24)';
      g.beginPath(); g.moveTo(x + w, y - H + 2); g.lineTo(x + w + H * 0.45, y - H * 0.55 + 4); g.lineTo(x + w + H * 0.45, y + hh + 2); g.lineTo(x + w, y + hh); g.closePath(); g.fill();
      R(x + 2, y + hh, w, 2.5, 'rgba(0,0,0,0.22)');
    }
    for (const p of m.props) if (!(p.type === 'pond' || p.type === 'scale' || p.type === 'gate')) SPR.prop(g, p);
    for (const pk of m.parked) SPR.parked(g, pk);
    for (const l of m.lamps) R(l.x - 1, l.y - 0.5, 2.5, 1.5, 'rgba(0,0,0,0.3)');
    for (const pl of m.poles) R(pl.x - 1, pl.y, 2.5, 1.5, 'rgba(0,0,0,0.3)');
    m.bg = cv;
    /* ===== lớp tiền cảnh (vẽ sau xe): nhà có chiều cao, cột điện, dây điện, biển báo, cột đèn ===== */
    const fv = document.createElement('canvas');
    fv.width = m.pw * RS; fv.height = m.ph * RS;
    const f = fv.getContext('2d');
    f.scale(RS, RS);
    const sorted = m.buildings.slice().sort((p, q) => p.y - q.y);
    for (const b of sorted) MAP.drawBuilding3D(f, b, m);
    for (const s2 of m.signs) MAP.drawSign(f, s2);
    for (const l of m.lamps) MAP.drawLampPost(f, l);
    MAP.drawPoles(f, m);
    if (m.school) {
      const sx = m.school.x * TILE, sy = m.school.y * TILE;
      f.fillStyle = '#f4f4f4'; f.fillRect(sx, sy - 2, 40, 7); f.fillStyle = '#1d4fa3'; f.fillRect(sx, sy - 2, 40, 1);
      MAP.pixelText(f, 'TRUONG', sx + 2, sy - 0.5, '#c0392b');
    }
    m.fg = fv;
  },

  /* Chi tiết đường phố: cột điện, cây vỉa hè, xe đỗ, nắp cống, gờ giảm tốc, biển báo bổ sung */
  decorate(m) {
    const lampAt = (x, y) => m.lamps.some(l => Math.abs(l.x - x) < 14 && Math.abs(l.y - y) < 14);
    const poleRow = (y, x0, x1, step, skip) => { for (let x = x0; x < x1; x += step) { const px = x * TILE + 8; if (skip && skip(x)) continue; if (!lampAt(px, y)) m.poles.push({ x: px, y: y, row: y }); } };
    if (m.kind === 'city') {
      poleRow(15 * TILE + 2, 1, m.w, 5, x => x >= 26 && x <= 35);
      poleRow(22 * TILE + 14, 3, m.w, 5, x => x >= 26 && x <= 35);
      for (let x = 4; x < m.w; x += 7) {
        if (x >= 26 && x <= 35) continue;
        for (const ty of [15, 22]) {
          const px = x * TILE + 8, py = ty * TILE + 8;
          if (lampAt(px, py) || m.poles.some(p => Math.abs(p.x - px) < 12 && Math.abs(p.y - py) < 12)) continue;
          MAP.set(m, x, ty, T.TREE); m.trees.push({ x: x, y: ty, k: 'street' });
        }
      }
      for (let i = 0; i < 9; i++) {
        const ty = U.pick([15, 22]), x = U.int(1, m.w - 6);
        if (x > 24 && x < 36) continue;
        let ok = true; for (let k = 0; k < 2; k++) if (MAP.get(m, x + k, ty) !== T.WALK) ok = false;
        if (ok) for (let k = 0; k < U.int(3, 6); k++) m.parked.push({ x: x * TILE + 3 + k * 5, y: ty * TILE + (ty === 15 ? 2 : 4), up: ty === 22 });
      }
      m.signs.push({ x: 27 * TILE + 8, y: 15 * TILE + 6, type: 'ped' }); m.signs.push({ x: 34 * TILE + 8, y: 22 * TILE + 12, type: 'ped' });
      m.signs.push({ x: 12 * TILE + 8, y: 15 * TILE + 6, type: 'noparking' }); m.signs.push({ x: 48 * TILE + 8, y: 22 * TILE + 12, type: 'noparking' });
      m.signs.push({ x: 6 * TILE + 8, y: 22 * TILE + 12, type: 'school' });
    } else if (m.kind === 'rural') {
      poleRow(17 * TILE + 2, 2, m.w, 6); poleRow(20 * TILE + 14, 5, m.w, 9);
      m.bumps.push({ x: 22 * TILE, y0: 18 * TILE, y1: 20 * TILE }); m.bumps.push({ x: 52 * TILE, y0: 18 * TILE, y1: 20 * TILE });
      m.signs.push({ x: 21 * TILE + 8, y: 17 * TILE + 4, type: 'school' }); m.signs.push({ x: 50 * TILE + 8, y: 20 * TILE + 12, type: 'school' });
      for (let i = 0; i < 4; i++) { const x = U.int(40, 48); if (MAP.get(m, x, 20) === T.DIRT) m.parked.push({ x: x * TILE + 4, y: 20 * TILE + 3, up: true }); }
    } else if (m.kind === 'highway') {
      poleRow(10 * TILE + 12, 2, m.w, 7); poleRow(17 * TILE + 6, 5, m.w, 9, x => x >= 33 && x <= 47);
    } else if (m.kind === 'industrial') {
      poleRow(16 * TILE + 3, 1, m.w, 6, x => x >= 36 && x <= 45); poleRow(23 * TILE + 13, 4, m.w, 6, x => x >= 36 && x <= 45);
      for (let i = 0; i < 8; i++) {
        const x = U.int(2, 34);
        if (MAP.get(m, x, 23) === T.WALK) for (let k = 0; k < U.int(3, 6); k++) m.parked.push({ x: x * TILE + 3 + k * 5, y: 23 * TILE + 4, up: true });
      }
      m.signs.push({ x: 20 * TILE + 8, y: 16 * TILE + 6, type: 'noparking' }); m.signs.push({ x: 60 * TILE + 8, y: 23 * TILE + 12, type: 'noparking' });
    }
    if (m.kind === 'city' || m.kind === 'industrial') {
      for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
        if (MAP.get(m, tx, ty) === T.ROAD && U.rand() < 0.025 && !m.inters.some(I => tx * TILE >= I.x0 - 16 && tx * TILE <= I.x1 + 16 && ty * TILE >= I.y0 - 16 && ty * TILE <= I.y1 + 16)) m.manholes.push({ x: tx * TILE + U.int(4, 12), y: ty * TILE + U.int(4, 12) });
      }
    }
  },

  /* Chiều cao nhà (2.5D): theo kiểu nhà, giới hạn để mái không che lòng đường phía Bắc */
  bHeight(m, b) {
    if (b._H != null) return b._H;
    const rnd = U.rng((b.seed || 1) + 7);
    let H = b.style === 'house' ? 10 + rnd() * 3 : b.style === 'factory' ? 16 + rnd() * 6 : b.style === 'dorm' ? 22 + rnd() * 12 : 14 + Math.floor(rnd() * 3) * 8;
    let free = 0;
    for (let k = 1; k <= 3; k++) {
      const row = b.y - k;
      if (row < 0) { free += 16; continue; }
      let road = false;
      for (let x = b.x; x < b.x + b.w; x++) { const t = MAP.get(m, x, row); if (t === T.ROAD || t === T.SHOULDER) road = true; }
      if (road) break;
      free += 16;
    }
    b._H = Math.max(6, Math.min(H, free - 3));
    return b._H;
  },

  drawBuilding3D(g, b, m) {
    const X = b.x * TILE, Y = b.y * TILE, Wp = b.w * TILE, Hp = b.h * TILE, H = MAP.bHeight(m, b);
    const R = (a, c, ww, hh, col) => { g.fillStyle = col; g.fillRect(a, c, ww, hh); };
    const rnd = U.rng(b.seed || 1);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const rx = X, ry = Y - H, rw = Wp, rh = Hp;           // mặt mái
    const fy = Y + Hp - H;                                // mặt tiền (phía Nam)
    const win = (x, y, w, h, frame) => {
      R(x - 0.5, y - 0.5, w + 1, h + 1, frame || '#e8e2d4');
      R(x, y, w, h, '#4a6f96'); R(x, y, w, h * 0.35, '#7aa3c9'); R(x + w - 0.75, y, 0.75, h, '#3a5876');
      m.windows.push({ x: x, y: y, w: w, h: h, lit: rnd() < 0.6 });
    };
    if (b.style === 'house') {
      R(X, fy, Wp, H, b.c); R(X, fy, Wp, 1, SPR.sh(b.c, -0.3)); R(X + Wp - 1.5, fy, 1.5, H, SPR.sh(b.c, -0.18));
      for (let i = X + 3; i < X + Wp - 6; i += 9) { R(i, fy + 2.5, 4, 4.5, '#3f6f4f'); R(i + 1.75, fy + 2.5, 0.5, 4.5, '#2c4f38'); R(i, fy + 2.5, 4, 0.5, '#5b8f6b'); }
      const dx = X + Math.floor(Wp / 2) - 2.5;
      R(dx, fy + H - 8.5, 5, 8.5, '#7b4a26'); R(dx + 2.25, fy + H - 8.5, 0.5, 8.5, '#5a3519'); R(dx - 1, fy + H - 0.75, 7, 0.75, '#9e9585');
      /* mái ngói, có mái hiên nhô ra */
      R(rx - 1, ry, rw + 2, rh + 1, '#b5523b');
      for (let yy = ry + 1.5; yy < ry + rh; yy += 2) { R(rx - 1, yy, rw + 2, 0.5, '#8f3c2a'); for (let xx = rx + (Math.floor(yy) % 4 ? 0 : 1) - 1; xx < rx + rw + 1; xx += 2) R(xx, yy - 1, 1, 0.5, '#cc6a50'); }
      R(rx - 1, ry + rh / 2 - 0.75, rw + 2, 1.5, '#d27a5c'); R(rx - 1, ry + rh / 2 + 0.75, rw + 2, 0.5, '#8f3c2a');
      R(rx - 1, ry + rh, rw + 2, 1, '#6e2c1e');
    } else if (b.style === 'factory') {
      R(X, fy, Wp, H, '#b8bec4'); for (let xx = X; xx < X + Wp; xx += 2) R(xx, fy, 0.5, H, '#a7adb3');
      R(X, fy, Wp, 2, '#1d4fa3'); R(X + Wp - 1.5, fy, 1.5, H, '#969ca2');
      for (let i = X + 4; i < X + Wp - 12; i += 18) { R(i, fy + H - 11, 11, 11, '#8a9096'); for (let k = 0; k < 11; k += 1.5) R(i, fy + H - 11 + k, 11, 0.5, '#737980'); }
      for (let i = X + 3; i < X + Wp - 3; i += 6) win(i, fy + 3.5, 3, 2);
      R(rx, ry, rw, rh, b.c);
      for (let xx = rx; xx < rx + rw; xx += 1.5) R(xx, ry, 0.5, rh, SPR.sh(b.c, -0.15));
      for (let yy = ry + 6; yy < ry + rh - 4; yy += 22) R(rx + 3, yy, rw - 6, 3, '#cfe8f5');
      R(rx, ry, rw, 1, SPR.sh(b.c, 0.3)); R(rx, ry + rh - 1, rw, 1, SPR.sh(b.c, -0.35));
    } else if (b.style === 'dorm') {
      R(X, fy, Wp, H, b.c); R(X + Wp - 1.5, fy, 1.5, H, SPR.sh(b.c, -0.18));
      for (let yy = fy + 2; yy < fy + H - 9; yy += 8) {
        R(X, yy + 6.5, Wp, 0.75, SPR.sh(b.c, -0.25));
        for (let i = X + 2; i < X + Wp - 4; i += 6) {
          win(i, yy, 3, 3.5);
          R(i - 0.5, yy + 4.5, 4, 1.25, '#9e9585');
          if (rnd() < 0.5) R(i, yy + 3.75, 3, 0.75, pick(['#e63946', '#f1f1f1', '#3a86ff', '#ffb703', '#90be6d']));
        }
      }
      R(X + 2, fy + H - 8, Wp - 4, 8, SPR.sh(b.c, -0.1));
      for (let i = X + 3; i < X + Wp - 4; i += 6) R(i, fy + H - 7, 3, 7, '#7b4a26');
      R(rx, ry, rw, rh, '#a9a29a'); R(rx, ry, rw, 1, '#c4beb6'); R(rx, ry + rh - 1, rw, 1, '#8a847c');
      for (let yy = ry + 4; yy < ry + rh - 3; yy += 6) { R(rx + 3, yy, rw - 6, 0.5, '#6b6b6b'); for (let xx = rx + 4; xx < rx + rw - 5; xx += 3) R(xx, yy + 0.5, 1.5, 2, pick(['#e63946', '#f1f1f1', '#3a86ff', '#ffb703', '#90be6d'])); }
    } else {
      /* nhà phố nhiều tầng: tầng trệt bán hàng, các tầng trên có cửa sổ, ban công, cục nóng điều hòa */
      R(X, fy, Wp, H, b.c); R(X + Wp - 1.5, fy, 1.5, H, SPR.sh(b.c, -0.2));
      for (let xx = X + 16; xx < X + Wp; xx += 16) R(xx - 0.5, fy, 1, H, SPR.sh(b.c, -0.12));
      const gf = 9;
      for (let yy = fy + 1.5; yy < fy + H - gf - 2; yy += 8) {
        R(X, yy + 6.5, Wp, 0.75, SPR.sh(b.c, -0.25));
        for (let xx = X; xx < X + Wp - 2; xx += 16) {
          win(xx + 3, yy + 1, 4, 4.5); win(xx + 9, yy + 1, 4, 4.5);
          if (rnd() < 0.4) { R(xx + 2, yy + 5.5, 12, 0.75, '#3a3a3a'); for (let k = 2; k < 14; k += 1.5) R(xx + k, yy + 4.5, 0.4, 1.25, '#3a3a3a'); if (rnd() < 0.6) R(xx + 3, yy + 4, 2, 1.5, '#4f8f3a'); }
          if (rnd() < 0.35) { R(xx + 13.5, yy + 3, 2, 2, '#d0d4d8'); R(xx + 14, yy + 3.5, 1, 1, '#9aa0a6'); }
        }
      }
      for (let xx = X; xx < X + Wp - 2; xx += 16) {
        const aw = pick(['#e63946', '#1d4fa3', '#2a9d8f', '#ff7b00', '#7b2cbf', '#d4a017']);
        const ww = Math.min(16, X + Wp - xx), gy = fy + H - gf;
        R(xx + 1, gy - 2.5, ww - 2, 2, pick(['#c1121f', '#1d4fa3', '#e9c46a', '#2a9d8f', '#f1f1f1'])); R(xx + 2, gy - 2, ww - 4, 0.5, 'rgba(255,255,255,0.6)'); // biển hiệu
        for (let k = 0; k < ww; k += 2) R(xx + k, gy, 2, 2.5, k % 4 ? '#f1f1f1' : aw);
        R(xx, gy + 2.5, ww, 0.5, 'rgba(0,0,0,0.35)');
        if (rnd() < 0.45) { R(xx + 2, gy + 3, ww - 4, gf - 3, '#8a9096'); for (let k = 0; k < gf - 3; k += 1) R(xx + 2, gy + 3 + k, ww - 4, 0.4, '#737980'); }
        else { R(xx + 2, gy + 3, ww - 4, gf - 3, '#3b2f2a'); R(xx + 3, gy + 4.5, 3, 3, pick(['#f4a261', '#90be6d', '#e9c46a', '#ffadad'])); R(xx + 7, gy + 4, 3, 4, pick(['#a0c4ff', '#ffd6a5', '#caffbf'])); m.windows.push({ x: xx + 2, y: gy + 3, w: ww - 4, h: gf - 3, lit: rnd() < 0.85, shop: true }); }
      }
      const roof = pick(['#b9b3a8', '#c9c1b2', '#a8a29a', '#bdb7c4']);
      R(rx, ry, rw, rh, roof); R(rx, ry, rw, 1.25, SPR.sh(roof, 0.35)); R(rx, ry, 1.25, rh, SPR.sh(roof, 0.25));
      R(rx, ry + rh - 1.25, rw, 1.25, SPR.sh(roof, -0.35)); R(rx + rw - 1.25, ry, 1.25, rh, SPR.sh(roof, -0.25));
      for (let xx = rx + 16; xx < rx + rw; xx += 16) R(xx - 0.5, ry, 1, rh, SPR.sh(roof, -0.18));
      for (let xx = rx + 3; xx < rx + rw - 8; xx += 16) {
        if (rnd() < 0.55) { R(xx + 1, ry + 3.5, 6, 6, 'rgba(0,0,0,0.25)'); R(xx, ry + 2.5, 6, 6, '#cfd8dc'); R(xx + 1, ry + 3.5, 4, 4, '#b0bec5'); R(xx + 1, ry + 3, 2, 1, '#ffffff'); }
        else if (rh > 14) { R(xx, ry + 3, 9, 6, '#1d3557'); for (let k = 0; k < 9; k += 3) R(xx + k, ry + 3, 0.5, 6, '#457b9d'); R(xx, ry + 6, 9, 0.5, '#457b9d'); }
      }
    }
  },

  drawLampPost(g, l) {
    const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(a, b, w, h); };
    R(l.x - 0.5, l.y - 12, 1, 12.5, '#4a4e54'); R(l.x - 0.5, l.y - 12, 0.4, 12, '#6b7078');
    R(l.x - 0.5, l.y - 12.5, 4, 0.75, '#4a4e54'); R(l.x + 2.5, l.y - 12.5, 2, 1.25, '#2f3236'); R(l.x + 2.75, l.y - 11.5, 1.5, 0.5, '#f3e9b0');
  },

  drawPoles(g, m) {
    const rows = {};
    for (const p of m.poles) (rows[p.row] = rows[p.row] || []).push(p);
    for (const k in rows) {
      const ps = rows[k].sort((a, b) => a.x - b.x);
      for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i], b = ps[i + 1];
        if (b.x - a.x > 130) continue;
        for (let w = 0; w < 3; w++) {
          g.strokeStyle = w === 2 && m.kind === 'city' ? 'rgba(10,10,10,0.75)' : 'rgba(30,30,30,0.55)';
          g.lineWidth = w === 2 && m.kind === 'city' ? 0.9 : 0.4;
          g.beginPath(); g.moveTo(a.x - 2 + w * 2, a.y - 15.5); g.quadraticCurveTo((a.x + b.x) / 2, a.y - 10 + w, b.x - 2 + w * 2, b.y - 15.5); g.stroke();
        }
      }
    }
    for (const p of m.poles) {
      g.fillStyle = '#7d756b'; g.fillRect(p.x - 0.75, p.y - 16, 1.5, 16.5);
      g.fillStyle = '#9a9187'; g.fillRect(p.x - 0.75, p.y - 16, 0.5, 16);
      g.fillStyle = '#5a534b'; g.fillRect(p.x - 3, p.y - 15.5, 6, 0.75);
      g.fillStyle = '#d9d4c8'; g.fillRect(p.x - 2.5, p.y - 16.25, 0.75, 0.75); g.fillRect(p.x + 1.75, p.y - 16.25, 0.75, 0.75);
      if (m.kind === 'city' && (p.x / 16) % 2 < 1) { g.fillStyle = '#3a3a3a'; g.fillRect(p.x + 0.75, p.y - 9, 2.5, 3); } // hộp cáp
    }
  },

  /* Vạch kẻ đường tự sinh từ các làn kề nhau */
  drawMarkings(g, m) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const inBox = (L, s) => m.inters.some(I => {
      const a0 = L.axis === 'x' ? I.x0 : I.y0, a1 = L.axis === 'x' ? I.x1 : I.y1;
      const c0 = L.axis === 'x' ? I.y0 : I.x0, c1 = L.axis === 'x' ? I.y1 : I.x1;
      return s >= a0 - 14 && s <= a1 + 14 && L.pos >= c0 - 8 && L.pos <= c1 + 8;
    });
    const lanes = m.lanes.filter(L => !L.wrong);
    for (const A of lanes) for (const B of lanes) {
      if (A === B || A.axis !== B.axis || B.pos - A.pos !== 16) continue;
      const mid = (A.pos + B.pos) / 2;
      const group = lanes.filter(L => L.axis === A.axis && Math.abs(L.pos - mid) < 40);
      const opposite = A.dir !== B.dir;
      const len = A.axis === 'x' ? m.pw : m.ph;
      for (let s = 0; s < len; s += 12) {
        if (inBox(A, s) || inBox(A, s + 8)) continue;
        const seg = (o, w, col) => { if (A.axis === 'x') R(s, mid + o, w, 0.75, col); else R(mid + o, s, 0.75, w, col); };
        if (opposite && group.length >= 4) { seg(-1.5, 12, '#e8c547'); seg(0.75, 12, '#e8c547'); }
        else if (opposite) seg(-0.4, 7, '#e8c547');
        else seg(-0.4, 7, '#e2e2e2');
      }
    }
    if (m.kind === 'highway' || m.kind === 'industrial') {
      const xs = lanes.filter(L => L.axis === 'x').map(L => L.pos);
      if (xs.length) { const top = Math.min(...xs) - 8, bot = Math.max(...xs) + 8; R(0, top + 0.5, m.pw, 0.75, '#f0f0f0'); R(0, bot - 1.25, m.pw, 0.75, '#f0f0f0'); }
    }
    for (const I of m.inters) {
      for (let y = I.y0 + 1; y < I.y1; y += 4) { R(I.x0 - 12, y, 10, 2, '#e6e6e6'); R(I.x1 + 2, y, 10, 2, '#e6e6e6'); }
      for (let x = I.x0 + 1; x < I.x1; x += 4) { R(x, I.y0 - 12, 2, 10, '#e6e6e6'); R(x, I.y1 + 2, 2, 10, '#e6e6e6'); }
    }
    for (const L of lanes) for (const S of L.stops) {
      const ar = S.at - L.dir * 34;
      if (L.axis === 'x') { R(ar - (L.dir > 0 ? 8 : 0), L.pos - 0.75, 8, 1.5, '#dcdcdc'); const tip = ar + (L.dir > 0 ? 0 : -8); for (let k = 0; k < 3; k++) R(tip - L.dir * k, L.pos - 2.5 + k, 1, 5 - 2 * k, '#dcdcdc'); }
      else { R(L.pos - 0.75, ar - (L.dir > 0 ? 8 : 0), 1.5, 8, '#dcdcdc'); const tip = ar + (L.dir > 0 ? 0 : -8); for (let k = 0; k < 3; k++) R(L.pos - 2.5 + k, tip - L.dir * k, 5 - 2 * k, 1, '#dcdcdc'); }
      const a = S.at + (L.dir > 0 ? 1 : -2.5);
      if (L.axis === 'x') R(a, L.pos - 8, 1.5, 16, '#ffffff'); else R(L.pos - 8, a, 16, 1.5, '#ffffff');
    }
    if (m.oneway) {
      for (let x = 6 * TILE; x < m.pw; x += 14 * TILE) {
        if (m.inters.some(I => x + 12 >= I.x0 - 14 && x <= I.x1 + 14)) continue;
        for (const row of [6, 7]) { const yy = row * TILE + 7; R(x, yy, 9, 2, '#d8d8d8'); R(x + 7, yy - 2, 2, 6, '#d8d8d8'); R(x + 9, yy - 1, 2, 4, '#d8d8d8'); }
      }
    }
  },

  /* ---------------- CÔNG TRÌNH ---------------- */
  drawBuilding(g, b) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    const R = (a, c, ww, hh, col) => { g.fillStyle = col; g.fillRect(a, c, ww, hh); };
    const rnd = U.rng(b.seed || 1);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    R(x + 3, y + 3, w, h, 'rgba(0,0,0,0.3)');
    const fh = b.style === 'factory' ? 14 : 12, roofH = h - fh;
    if (b.style === 'house') {
      /* mái ngói đỏ */
      R(x, y, w, roofH, '#b5523b');
      for (let yy = y + 1.5; yy < y + roofH; yy += 2) { R(x, yy, w, 0.5, '#8f3c2a'); for (let xx = x + (Math.floor(yy) % 4 ? 0 : 1); xx < x + w; xx += 2) R(xx, yy - 1, 1, 0.5, '#cc6a50'); }
      R(x, y + roofH / 2 - 0.75, w, 1.5, '#d27a5c'); R(x, y + roofH / 2 + 0.75, w, 0.5, '#8f3c2a');
      R(x, y, 0.75, roofH, '#8f3c2a'); R(x + w - 0.75, y, 0.75, roofH, '#8f3c2a');
      R(x, y + roofH, w, fh, b.c); R(x, y + roofH, w, 1, SPR.sh(b.c, -0.25));
      for (let i = x + 3; i < x + w - 6; i += 9) { R(i, y + roofH + 3, 4, 4, '#3f6f4f'); R(i + 1.75, y + roofH + 3, 0.5, 4, '#2c4f38'); R(i, y + roofH + 3, 4, 0.5, '#5b8f6b'); }
      const dx = x + Math.floor(w / 2) - 2.5;
      R(dx, y + roofH + 4, 5, 8, '#7b4a26'); R(dx + 2.25, y + roofH + 4, 0.5, 8, '#5a3519'); R(dx - 1, y + roofH + 11, 7, 1, '#9e9585');
    } else if (b.style === 'factory') {
      R(x, y, w, roofH, b.c);
      for (let xx = x; xx < x + w; xx += 1.5) R(xx, y, 0.5, roofH, SPR.sh(b.c, -0.15));
      for (let yy = y + 6; yy < y + roofH - 4; yy += 22) R(x + 3, yy, w - 6, 3, '#cfe8f5');
      R(x, y, w, 1, SPR.sh(b.c, 0.3)); R(x, y + roofH - 1, w, 1, SPR.sh(b.c, -0.35));
      R(x, y + roofH, w, fh, '#b8bec4'); R(x, y + roofH, w, 2, '#1d4fa3');
      for (let i = x + 4; i < x + w - 12; i += 18) { R(i, y + roofH + 4, 11, 10, '#8a9096'); for (let k = 0; k < 10; k += 1.5) R(i, y + roofH + 4 + k, 11, 0.5, '#737980'); }
      R(x + w - 7, y + roofH + 5, 4, 3, '#5a7fa8');
    } else if (b.style === 'dorm') {
      R(x, y, w, roofH, '#a9a29a'); R(x, y, w, 1, '#c4beb6'); R(x, y + roofH - 1, w, 1, '#8a847c');
      for (let yy = y + 4; yy < y + roofH - 3; yy += 6) { R(x + 3, yy, w - 6, 0.5, '#6b6b6b'); for (let xx = x + 4; xx < x + w - 5; xx += 3) R(xx, yy + 0.5, 1.5, 2, pick(['#e63946', '#f1f1f1', '#3a86ff', '#ffb703', '#90be6d'])); }
      R(x, y + roofH, w, fh, b.c);
      for (let i = x + 2; i < x + w - 3; i += 5) { R(i, y + roofH + 2, 3, 3, '#5a7fa8'); R(i, y + roofH + 2, 3, 0.5, '#9fc3e6'); R(i - 0.5, y + roofH + 5, 4, 0.75, '#9e9585'); }
      R(x + 2, y + roofH + 8, w - 4, 4, SPR.sh(b.c, -0.1));
      for (let i = x + 3; i < x + w - 4; i += 6) R(i, y + roofH + 8, 3, 4, '#7b4a26');
    } else {
      /* nhà phố: mái bằng, bồn nước, pin mặt trời; mặt tiền có mái hiên và biển hiệu */
      const roof = pick(['#b9b3a8', '#c9c1b2', '#a8a29a', '#bdb7c4']);
      R(x, y, w, roofH, roof); R(x, y, w, 1, SPR.sh(roof, 0.3)); R(x, y, 1, roofH, SPR.sh(roof, 0.2));
      R(x, y + roofH - 1, w, 1, SPR.sh(roof, -0.3)); R(x + w - 1, y, 1, roofH, SPR.sh(roof, -0.2));
      for (let xx = x + 16; xx < x + w; xx += 16) R(xx - 0.5, y, 1, roofH, SPR.sh(roof, -0.15));
      for (let xx = x + 3; xx < x + w - 8; xx += 16) {
        if (rnd() < 0.55) { R(xx + 1, y + 3.5, 6, 6, 'rgba(0,0,0,0.25)'); R(xx, y + 2.5, 6, 6, '#cfd8dc'); R(xx + 1, y + 3.5, 4, 4, '#b0bec5'); R(xx + 1, y + 3, 2, 1, '#ffffff'); }
        else if (roofH > 14) { R(xx, y + 3, 9, 6, '#1d3557'); for (let k = 0; k < 9; k += 3) R(xx + k, y + 3, 0.5, 6, '#457b9d'); R(xx, y + 6, 9, 0.5, '#457b9d'); }
      }
      R(x, y + roofH, w, fh, b.c);
      for (let xx = x; xx < x + w - 2; xx += 16) {
        const aw = pick(['#e63946', '#1d4fa3', '#2a9d8f', '#ff7b00', '#7b2cbf', '#d4a017']);
        const ww = Math.min(16, x + w - xx);
        for (let k = 0; k < ww; k += 2) R(xx + k, y + roofH, 2, 3, k % 4 ? '#f1f1f1' : aw);
        R(xx, y + roofH + 3, ww, 0.5, 'rgba(0,0,0,0.3)');
        if (rnd() < 0.5) { R(xx + 2, y + roofH + 4.5, ww - 4, 7.5, '#8a9096'); for (let k = 0; k < 7; k += 1) R(xx + 2, y + roofH + 4.5 + k, ww - 4, 0.4, '#737980'); }
        else { R(xx + 2, y + roofH + 4.5, ww - 4, 7.5, '#3b2f2a'); R(xx + 3, y + roofH + 8, 3, 3, pick(['#f4a261', '#90be6d', '#e9c46a', '#ffadad'])); R(xx + 7, y + roofH + 7, 3, 4, pick(['#a0c4ff', '#ffd6a5', '#caffbf'])); }
      }
      R(x, y + roofH + 11.5, w, 0.5, '#9e9585');
    }
  },

  drawSign(g, s) {
    const x = Math.round(s.x), y = Math.round(s.y);
    const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    R(-0.5, -1, 1.5, 7, '#6d6d6d'); R(-0.5, -1, 0.5, 7, '#8d8d8d'); R(-1, 5.5, 2.5, 1, 'rgba(0,0,0,0.3)');
    const disc = (col) => { R(-5, -12, 11, 11, col); R(-4, -13, 9, 13, col); R(-6, -11, 13, 9, col); };
    if (s.type === 'limit') {
      disc('#d62828');
      R(-4, -11, 9, 9, '#ffffff'); R(-3, -12, 7, 11, '#ffffff'); R(-5, -10, 11, 7, '#ffffff');
      MAP.pixelText(g, String(s.v), x - 2.5, y - 9, '#111111');
    } else if (s.type === 'noentry') {
      disc('#d62828'); R(-3.5, -7.5, 8, 2.5, '#ffffff');
    } else if (s.type === 'noparking') {
      disc('#d62828'); R(-4, -11, 9, 9, '#1d5fbf'); R(-3, -12, 7, 11, '#1d5fbf'); R(-5, -10, 11, 7, '#1d5fbf');
      for (let k = 0; k < 8; k++) R(-4 + k, -11 + k, 1.5, 1.5, '#d62828');
    } else if (s.type === 'ped') {
      R(-5, -12, 11, 11, '#1d5fbf'); R(-5, -12, 11, 0.75, '#4a86e0');
      R(-3, -9, 6, 6, '#ffffff'); R(-2, -8, 4, 4, '#1d5fbf'); R(-0.5, -8.5, 1.5, 1.5, '#111'); R(-0.5, -7, 1.5, 2.5, '#111'); R(-1.5, -4.5, 1, 1.5, '#111'); R(0.5, -4.5, 1, 1.5, '#111');
    } else if (s.type === 'school') {
      for (let k = 0; k < 11; k++) R(-k / 2 + 0.5, -12 + k, k + 0.5, 1, k < 2 ? '#d62828' : '#ffd23f');
      R(-5, -2, 11, 1, '#d62828');
      R(-2, -7, 1.5, 3.5, '#111'); R(0.5, -8, 1.5, 4.5, '#111'); R(-2, -8.25, 1.25, 1.25, '#111'); R(0.5, -9.5, 1.25, 1.25, '#111');
    } else if (s.type === 'oneway') {
      R(-5, -12, 11, 11, '#1d5fbf'); R(-5, -12, 11, 0.75, '#4a86e0');
      R(-3, -7, 6, 1, '#ffffff'); R(1, -9, 1, 5, '#ffffff'); R(2, -8, 1, 3, '#ffffff');
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
        const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(px + a, py + b, w, h); };
        R(1, 9, 1, 4, '#555'); R(0, 12.5, 3, 1, 'rgba(0,0,0,0.3)');
        R(-1.5, -1.5, 6, 12, '#111'); R(-1, -1, 5, 0.5, '#333');
        const lamp = (yy, on, cOn, cOff) => { R(0, yy, 3, 3, on ? cOn : cOff); if (on) { R(0.5, yy + 0.5, 1, 1, '#ffffff'); } };
        lamp(0, st === 'r', '#ff3b30', '#4a1512'); lamp(3.25, st === 'y', '#ffcc00', '#4a3d0d'); lamp(6.5, st === 'g', '#34e05a', '#0f3a18');
      }
    }
  }
};
