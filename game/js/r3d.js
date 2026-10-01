'use strict';
/* =========================================================================
 * ĐỒ HỌA 3D LOW-POLY (Three.js, chạy offline)
 * - Thế giới game vẫn là mặt phẳng 2D (x, y). Ở 3D: X = x, Z = y, Y = chiều cao.
 * - Mô hình dựng bằng khối cơ bản, tô màu theo đỉnh; khối tĩnh được gộp thành
 *   vài lưới lớn để chạy nhẹ trên điện thoại.
 * ========================================================================= */
const R3 = {
  ok: false, renderer: null, scene: null, cam: null, canvas: null,
  yaw: 0, yawTarget: 0, spin: 0, quad: null, zoomIdx: 2, DIST: [130, 190, 270, 370, 500],
  target: { x: 0, z: 0 }, vmap: new Map(), pmap: new Map(), lights: [], built: null,

  supported() {
    try { const c = document.createElement('canvas'); return !!(window.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  },

  /* ---------------- khởi tạo ---------------- */
  init(canvas) {
    if (R3.ok) return true;
    if (!R3.supported()) return false;
    R3.canvas = canvas;
    const q = SAVE.data.q3d || 'med';
    try {
      R3.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    } catch (e) { return false; }
    const r = R3.renderer;
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = q !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    R3.scene = new THREE.Scene();
    R3.cam = new THREE.PerspectiveCamera(32, 1, 5, 4000);
    R3.hemi = new THREE.HemisphereLight(0xdff1ff, 0x6b8f4e, 0.65);
    R3.sun = new THREE.DirectionalLight(0xfff2dd, 0.95);
    R3.sun.castShadow = q !== 'low';
    const sz = q === 'high' ? 2048 : 1024;
    R3.sun.shadow.mapSize.set(sz, sz);
    R3.sun.shadow.bias = -0.0006;
    R3.sun.shadow.normalBias = 0.6;
    R3.scene.add(R3.hemi, R3.sun, R3.sun.target);
    R3.zoomIdx = SAVE.data.zoom3d != null ? SAVE.data.zoom3d : 2;
    R3.yawTarget = R3.yaw = (SAVE.data.yaw3d || 0) * Math.PI / 2;
    R3.initBase();
    R3.ok = true;
    R3.resize();
    return true;
  },

  resize() {
    if (!R3.ok) return;
    const q = SAVE.data.q3d || 'med';
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'med' ? 1.5 : 1);
    R3.renderer.setPixelRatio(dpr);
    R3.renderer.setSize(window.innerWidth, window.innerHeight, false);
    R3.cam.aspect = window.innerWidth / window.innerHeight;
    R3.cam.updateProjectionMatrix();
  },

  /* đổi chất lượng: bóng đổ, độ phân giải (khử răng cưa áp dụng khi mở lại game) */
  setQuality(q) {
    SAVE.data.q3d = q; SAVE.store();
    if (!R3.ok) return;
    const sh = q !== 'low';
    R3.renderer.shadowMap.enabled = sh; R3.sun.castShadow = sh;
    const sz = q === 'high' ? 2048 : 1024;
    if (R3.sun.shadow.map) { R3.sun.shadow.map.dispose(); R3.sun.shadow.map = null; }
    R3.sun.shadow.mapSize.set(sz, sz);
    R3.scene.traverse(n => { if (n.material) n.material.needsUpdate = true; });
    R3.resize();
  },

  /* màu hex -> màu tuyến tính (vì xuất ra sRGB) */
  _cc: {},
  col(hex) {
    let c = R3._cc[hex];
    if (!c) { c = new THREE.Color(hex); c.convertSRGBToLinear(); R3._cc[hex] = c; }
    return c;
  },

  /* ---------------- hình khối cơ bản (đã tách mặt để tô phẳng) ---------------- */
  initBase() {
    const flat = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
    const prism = new THREE.BufferGeometry();
    /* lăng trụ mái nhà: rộng 1 (x), sâu 1 (z), cao 1 (y), nóc chạy dọc trục x */
    const P = [
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0, -0.5, -0.5, 0.5, 0.5, 0.5, 0, -0.5, 0.5, 0,
      0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0, 0.5, -0.5, -0.5, -0.5, 0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0,
      0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0,
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5
    ];
    prism.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    prism.computeVertexNormals();
    R3.G = {
      box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
      cyl6: flat(new THREE.CylinderGeometry(1, 1, 1, 6)),
      cyl8: flat(new THREE.CylinderGeometry(1, 1, 1, 8)),
      cone6: flat(new THREE.ConeGeometry(1, 1, 6)),
      cone8: flat(new THREE.ConeGeometry(1, 1, 8)),
      ico: flat(new THREE.IcosahedronGeometry(1, 0)),
      ico1: flat(new THREE.IcosahedronGeometry(1, 1)),
      prism: prism
    };
    R3.matV = new THREE.MeshLambertMaterial({ vertexColors: true });
    /* vật tĩnh (nhà, cây, cột): tự "cắt" phần che khuất giữa camera và người chơi */
    R3.cutU = { p: { value: new THREE.Vector2() }, r: { value: 0 }, d: { value: 0 } };
    R3.matS = R3.cutaway(new THREE.MeshLambertMaterial({ vertexColors: true }));
    R3.radial = R3.radialTex();
    R3.sphere = new THREE.SphereGeometry(1, 8, 6);
  },

  /* phần nhà/cây nằm GIỮA camera và người chơi (trong vòng tròn quanh người chơi trên màn hình)
   * được đục lỗ có viền lấm tấm để luôn nhìn thấy xe tuần tra */
  cutaway(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCutP = R3.cutU.p; sh.uniforms.uCutR = R3.cutU.r; sh.uniforms.uCutD = R3.cutU.d;
      sh.vertexShader = 'varying float vVZ;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vVZ = -mvPosition.z;');
      sh.fragmentShader = 'varying float vVZ;\nuniform vec2 uCutP;\nuniform float uCutR;\nuniform float uCutD;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', [
        '#include <clipping_planes_fragment>',
        'if (uCutR > 0.0 && vVZ < uCutD) {',
        '  float d = length(gl_FragCoord.xy - uCutP);',
        '  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
        '  if (d < uCutR * 0.75 || (d < uCutR && n > (d - uCutR * 0.75) / (uCutR * 0.25))) discard;',
        '}'].join('\n'));
    };
    return mat;
  },

  radialTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  },

  /* bộ gộp hình: cộng dồn nhiều khối vào một lưới duy nhất */
  B() {
    const b = { p: [], n: [], c: [] };
    const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
    b.add = (geo, hex) => {
      const g = geo.clone(); g.applyMatrix4(m4);
      const P = g.attributes.position.array, N = g.attributes.normal.array, c = R3.col(hex);
      for (let i = 0; i < P.length; i += 3) { b.p.push(P[i], P[i + 1], P[i + 2]); b.n.push(N[i], N[i + 1], N[i + 2]); b.c.push(c.r, c.g, c.b); }
    };
    const set = (x, y, z, sx, sy, sz, rx, ry, rz) => { m4.compose(v3.set(x, y, z), q.setFromEuler(e.set(rx || 0, ry || 0, rz || 0)), s3.set(sx, sy, sz)); };
    /* các khối đặt theo đáy (y là cao độ đáy) */
    b.box = (x, y, z, w, h, d, hex, ry, rx, rz) => { set(x, y + h / 2, z, w, h, d, rx, ry, rz); b.add(R3.G.box, hex); return b; };
    b.cyl = (x, y, z, r, h, hex, seg, rx, rz) => { set(x, y + h / 2, z, r, h, r, rx, 0, rz); b.add(seg === 8 ? R3.G.cyl8 : R3.G.cyl6, hex); return b; };
    b.cone = (x, y, z, r, h, hex, seg) => { set(x, y + h / 2, z, r, h, r); b.add(seg === 8 ? R3.G.cone8 : R3.G.cone6, hex); return b; };
    b.ico = (x, y, z, r, hex, sy, fine) => { set(x, y, z, r, r * (sy || 1), r); b.add(fine ? R3.G.ico1 : R3.G.ico, hex); return b; };
    b.prism = (x, y, z, w, h, d, hex, ry) => { set(x, y + h / 2, z, w, h, d, 0, ry || 0); b.add(R3.G.prism, hex); return b; };
    b.geo = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.computeBoundingSphere();
      return g;
    };
    b.mesh = (mat, shadow) => {
      const m = new THREE.Mesh(b.geo(), mat || R3.matV);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      return m;
    };
    return b;
  },

  /* ================= DỰNG BẢN ĐỒ ================= */
  build(m, opt) {
    if (!R3.ok) return;
    opt = opt || {};
    if (R3.built) { R3.scene.remove(R3.built); R3.disposeTree(R3.built); }
    R3.vmap.forEach(o => R3.disposeTree(o)); R3.vmap.clear();
    R3.pmap.forEach(o => R3.disposeTree(o)); R3.pmap.clear();
    if (R3.player) { R3.scene.remove(R3.player); R3.player = null; R3.playerKind = null; }
    const root = new THREE.Group();
    R3.built = root; R3.m = m; R3.lights = []; R3.signs = [];
    const rnd = U.rng(4242);
    /* nền đất: kết cấu vẽ từ lưới ô */
    const tex = new THREE.CanvasTexture(R3.groundCanvas(m));
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = R3.renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(m.pw, m.ph), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(m.pw / 2, 0, m.ph / 2); ground.receiveShadow = true;
    root.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(m.pw * 6, m.ph * 6), new THREE.MeshLambertMaterial({ color: R3.col(m.kind === 'industrial' ? '#8fb56a' : '#79b852') }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(m.pw / 2, -0.3, m.ph / 2); outer.receiveShadow = true;
    root.add(outer);

    const S = R3.B();                    // khối tĩnh
    const WL = R3.B(), WD = R3.B();      // cửa sổ (sáng đèn / tối)
    const LH = R3.B();                   // đầu đèn đường
    /* đồi núi, rặng cây ngoài rìa bản đồ cho có chiều sâu */
    for (let i = 0; i < 46; i++) {
      const side = i % 4, t = rnd();
      let x, z;
      if (side === 0) { x = t * m.pw; z = -80 - rnd() * 260; }
      else if (side === 1) { x = t * m.pw; z = m.ph + 80 + rnd() * 260; }
      else if (side === 2) { x = -80 - rnd() * 260; z = t * m.ph; }
      else { x = m.pw + 80 + rnd() * 260; z = t * m.ph; }
      S.ico(x, 0, z, 50 + rnd() * 70, ['#6aa84f', '#5d9a45', '#7cb85a', '#4f8f3f'][i % 4], 0.45 + rnd() * 0.3);
    }
    for (let i = 0; i < 70; i++) {
      const x = -60 + rnd() * (m.pw + 120), z = rnd() < 0.5 ? -20 - rnd() * 60 : m.ph + 20 + rnd() * 60;
      R3.tree(S, x, z, 'round', rnd);
    }
    /* nhà cửa */
    for (const b of m.buildings) R3.building(S, WL, WD, b, m);
    /* cây */
    for (const t of m.trees) R3.tree(S, t.x * TILE + 8, t.y * TILE + 9, t.k, rnd);
    /* đèn đường */
    for (const l of m.lamps) {
      S.cyl(l.x, 0, l.y, 0.55, 15, '#5c6066', 6);
      S.box(l.x + 2, 14.6, l.y, 4.5, 0.6, 0.8, '#5c6066');
      S.box(l.x + 4, 13.6, l.y, 2.6, 1, 1.6, '#3a3d42');
      LH.box(l.x + 4, 13.3, l.y, 2, 0.4, 1.2, '#fff4c2');
    }
    /* cột điện + dây điện */
    const wires = [];
    const rows = {};
    for (const p of m.poles) {
      S.cyl(p.x, 0, p.y, 0.7, 20, '#8d857a', 6);
      S.box(p.x, 18.5, p.y, 7, 0.6, 0.6, '#5a534b');
      (rows[p.row] = rows[p.row] || []).push(p);
    }
    for (const k in rows) {
      const ps = rows[k].sort((a, b) => a.x - b.x);
      for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i], b = ps[i + 1];
        if (b.x - a.x > 130) continue;
        for (const off of [-3, 0, 3]) {
          let prev = null;
          for (let s = 0; s <= 8; s++) {
            const t = s / 8, x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t + off * 0.2, y = 19 - Math.sin(t * Math.PI) * 2.5;
            const pt = [x + off, y, z];
            if (prev) wires.push(...prev, ...pt);
            prev = pt;
          }
        }
      }
    }
    if (wires.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
      root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
    }
    /* vật trang trí */
    for (const p of m.props) R3.prop(S, p);
    for (const pk of m.parked) R3.parkedBike(S, pk);
    /* cầu */
    for (const b of m.bridges) {
      const x0 = b.x0 * TILE, x1 = (b.x1 + 1) * TILE, z0 = b.y0 * TILE - 2, z1 = (b.y1 + 1) * TILE + 2;
      for (const x of [x0, x1]) { S.box(x, 0, (z0 + z1) / 2, 1.2, 3.5, z1 - z0, '#d9d4c8'); for (let z = z0; z <= z1; z += 4) S.box(x, 0, z, 1.6, 4.2, 1.2, '#9a9a9a'); }
    }
    /* chốt kiểm soát: cọc tiêu */
    if (opt.cp && m.cpSpot) {
      const L = m.lanes[m.cpLane];
      for (let x = m.cpSpot.x - 150; x <= m.cpSpot.x + 30; x += 18) { S.cone(x, 0, L.pos - 8, 1.6, 4.5, '#ff7b00', 8); S.cyl(x, 1.6, L.pos - 8, 1.15, 1, '#ffffff', 8); }
    }
    R3.buildSpecial(root, S, m);
    /* biển báo (mặt biển luôn quay về phía camera) */
    for (const s of m.signs) {
      S.cyl(s.x, 0, s.y, 0.45, 13, '#8d8d8d', 6);
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.scale(4, 4); g.translate(8, 15);
      MAP.drawSign(g, { x: 0, y: 0, type: s.type, v: s.v });
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
      sp.scale.set(11, 11, 1); sp.position.set(s.x, 15, s.y);
      root.add(sp);
    }
    /* đèn tín hiệu */
    const done = {};
    for (const L of m.lanes) {
      if (L.wrong) continue;
      for (const St of L.stops) {
        if (St.inter.round || St.inter.rail) continue;
        const key = St.inter.id + L.axis + L.dir;
        if (done[key]) continue;
        done[key] = true;
        const off = L.dir > 0 ? 6 : -6;
        let px, pz;
        if (L.axis === 'x') { px = St.at - off; pz = L.curb + (L.dir > 0 ? 8 : -8); }
        else { pz = St.at - off; px = L.curb + (L.dir > 0 ? -8 : 8); }
        S.cyl(px, 0, pz, 0.6, 16, '#4a4e54', 6);
        S.box(px, 13, pz, 3, 8.5, 3, '#1b1d20');
        const lamps = [];
        const face = L.axis === 'x' ? { x: -L.dir * 1.6, z: 0 } : { x: 0, z: -L.dir * 1.6 };
        ['r', 'y', 'g'].forEach((c, i) => {
          const mm = new THREE.Mesh(R3.sphere, new THREE.MeshBasicMaterial({ color: 0x222222 }));
          mm.scale.setScalar(1); mm.position.set(px + face.x, 19.7 - i * 2.6, pz + face.z);
          root.add(mm); lamps.push(mm);
          const mm2 = mm.clone(); mm2.material = mm.material; mm2.position.set(px - face.x, 19.7 - i * 2.6, pz - face.z); root.add(mm2); lamps.push(mm2);
        });
        R3.lights.push({ inter: St.inter, axis: L.axis, lamps: lamps });
      }
    }
    const sm = S.mesh(R3.matS); root.add(sm);
    R3.winLitMat = R3.cutaway(new THREE.MeshLambertMaterial({ color: R3.col('#7fa3c8'), emissive: 0x000000 }));
    R3.winDarkMat = R3.cutaway(new THREE.MeshLambertMaterial({ color: R3.col('#6f93b8'), emissive: 0x000000 }));
    if (WL.p.length) root.add(WL.mesh(R3.winLitMat, false));
    if (WD.p.length) root.add(WD.mesh(R3.winDarkMat, false));
    R3.lampMat = new THREE.MeshBasicMaterial({ color: 0xbfb9a0 });
    if (LH.p.length) root.add(LH.mesh(R3.lampMat, false));
    R3.snap = true;
    /* quầng sáng đèn đường trên mặt đất (bật khi trời tối) */
    const glow = R3.B();
    const gq = [], guv = [];
    for (const l of m.lamps) {
      const x = l.x + 4, z = l.y, r = 26;
      gq.push(x - r, 0.35, z - r, x + r, 0.35, z - r, x + r, 0.35, z + r, x - r, 0.35, z - r, x + r, 0.35, z + r, x - r, 0.35, z + r);
      guv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
    if (gq.length) {
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gq, 3));
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
      R3.glowMat = new THREE.MeshBasicMaterial({ map: R3.radial, color: 0xffb860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      R3.glowMesh = new THREE.Mesh(gg, R3.glowMat);
      root.add(R3.glowMesh);
    }
    void glow;
    /* khói, bụi */
    R3.smoke = [];
    const smMat = new THREE.SpriteMaterial({ map: R3.radial, color: 0xbbbbbb, transparent: true, depthWrite: false });
    for (let i = 0; i < 140; i++) { const sp = new THREE.Sprite(smMat.clone()); sp.visible = false; root.add(sp); R3.smoke.push(sp); }
    R3.scene.add(root);
    R3.evPed = null;
  },

  /* Công trình riêng của bản đồ mới: dải phân cách, hộ lan, giá long môn, đường ray, rào chắn, đảo vòng xuyến */
  buildSpecial(root, S, m) {
    R3.barriers = []; R3.trains = [];
    if (m.kind === 'expressway') {
      const y = 12 * TILE + 8;
      let x0 = 0;
      const gaps = (m.medianGaps || []).slice().sort((a, b) => a.x0 - b.x0);
      for (const gp of gaps.concat([{ x0: m.pw, x1: m.pw }])) {
        if (gp.x0 - x0 > 4) { S.box((x0 + gp.x0) / 2, 0, y, gp.x0 - x0, 3.2, 2.6, '#cfccc5'); S.box((x0 + gp.x0) / 2, 3.2, y, gp.x0 - x0, 0.6, 1.6, '#e4e1da'); }
        x0 = gp.x1;
      }
    }
    for (const gy of m.guard || []) {
      S.box(m.pw / 2, 2.2, gy, m.pw, 1.4, 0.5, '#c9ced4');
      for (let x = 4; x < m.pw; x += 12) S.box(x, 0, gy, 0.6, 2.8, 0.6, '#6b7078');
    }
    for (const p of m.props) if (p.type === 'gantry') {
      for (const z of [p.y, p.y + p.h]) S.box(p.x, 0, z, 1.4, 24, 1.4, '#8a9096');
      S.box(p.x, 22, p.y + p.h / 2, 1.6, 2, p.h + 2, '#6b7078');
      for (const zz of [p.y + 28, p.y + 80]) { S.box(p.x - 0.6, 15.5, zz, 0.6, 7, 22, '#1f7a3a'); S.box(p.x - 1, 17.5, zz, 0.3, 0.8, 16, '#ffffff'); S.box(p.x - 1, 19.5, zz - 3, 0.3, 0.8, 10, '#ffffff'); }
    }
    for (const r of m.rails) {
      for (const dx of [-4, 3.5]) S.box(r.x + dx, 0, m.ph / 2, 0.8, 0.7, m.ph, '#9aa3ab');
    }
    if (m.island) {
      const I = m.island;
      S.cyl(I.x, 0, I.y, I.r + 1.5, 0.9, '#e8e8e8', 8); S.cyl(I.x, 0.9, I.y, I.r, 0.3, '#6aae52', 8);
      S.cyl(I.x, 1, I.y, 7, 2.5, '#b9b3a8', 8); S.cyl(I.x, 3.5, I.y, 2.2, 16, '#e4ded2', 6); S.ico(I.x, 21, I.y, 3.2, '#d4a017');
      for (let a = 0; a < 14; a++) { const an = a / 14 * Math.PI * 2; S.ico(I.x + Math.cos(an) * (I.r - 4), 1.8, I.y + Math.sin(an) * (I.r - 4), 1.6, ['#e87a9b', '#ffd23f', '#f1f1f1', '#e63946'][a % 4]); }
      for (let a = 0; a < 5; a++) { const an = a / 5 * Math.PI * 2 + 0.3; R3.tree(S, I.x + Math.cos(an) * 14, I.y + Math.sin(an) * 14, 'round', U.rng(a + 9)); }
    }
    /* rào chắn đường ngang: cột + cần chắn quay + 2 đèn đỏ nhấp nháy */
    for (const I of m.inters) {
      if (!I.rail) continue;
      for (const dir of [1, -1]) {
        const L = m.lanes.find(l => l.axis === 'x' && l.dir === dir && !l.emer);
        if (!L) continue;
        const bx = dir > 0 ? I.x0 - 3 : I.x1 + 3, top = dir > 0 ? L.pos - 8 : L.pos - 24, bot = top + 32;
        const pz = dir > 0 ? bot + 2 : top - 2, sgn = dir > 0 ? -1 : 1;
        S.box(bx, 0, pz, 1.2, 9, 1.2, '#e6e6e6'); S.box(bx, 9, pz, 3.2, 2.2, 1, '#111111');
        const pivot = new THREE.Group(); pivot.position.set(bx, 5, pz);
        const AB = R3.B();
        for (let k = 0; k < 10; k++) AB.box(0, -0.4, sgn * (k * 3 + 1.5), 0.8, 0.8, 3, k % 2 ? '#ffffff' : '#d62828');
        pivot.add(AB.mesh());
        root.add(pivot);
        const lamps = [-1, 1].map(o => { const mm = new THREE.Mesh(R3.sphere, new THREE.MeshBasicMaterial({ color: 0x3a1210 })); mm.scale.setScalar(0.8); mm.position.set(bx + (dir > 0 ? -0.7 : 0.7), 10.1, pz + o * 1); root.add(mm); return mm; });
        R3.barriers.push({ I: I, pivot: pivot, sgn: sgn, lamps: lamps });
      }
      const g = new THREE.Group(), TB = R3.B();
      for (let k = 0; k < 5; k++) {
        const z = -k * 36 - 17, c = k === 0 ? '#1d4fa3' : '#2a64c4';
        TB.box(0, 1.5, z, 12, 9, 34, c); TB.box(0, 4, z, 12.2, 1.2, 34.2, '#f1f1f1'); TB.box(0, 7, z, 12.3, 1.8, 30, '#22344a');
        TB.box(0, 10.5, z, 10, 1, 32, '#b0bec5'); TB.box(0, 0, z - 12, 8, 1.6, 4, '#222'); TB.box(0, 0, z + 12, 8, 1.6, 4, '#222');
      }
      TB.box(-3, 3.5, 0.2, 2, 1.2, 0.4, '#fff3a0'); TB.box(3, 3.5, 0.2, 2, 1.2, 0.4, '#fff3a0');
      g.add(TB.mesh()); g.visible = false; root.add(g);
      R3.trains.push({ I: I, g: g });
    }
  },

  disposeTree(o) {
    o.traverse(n => {
      if (n.geometry && n.geometry !== R3.sphere && n.geometry !== R3.lightGeo && n.geometry !== R3._lp && n.geometry !== R3._lpR) n.geometry.dispose();
      if (n.material && n.material !== R3.matV && n.material !== R3.matS && n.material !== R3._hm) { if (n.material.map && n.material.map !== R3.radial) n.material.map.dispose(); n.material.dispose(); }
    });
    if (o.parent) o.parent.remove(o);
  },

  /* kết cấu mặt đất: màu phẳng kiểu low-poly + vạch kẻ đường */
  groundCanvas(m) {
    const c = document.createElement('canvas');
    c.width = m.pw * 2; c.height = m.ph * 2;
    const g = c.getContext('2d'); g.scale(2, 2);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const rnd = U.rng(77);
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = MAP.get(m, tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.GRASS || t === T.TREE || t === T.BUILD) { R(x, y, 16, 16, rnd() < 0.5 ? '#7cbf5a' : '#78bb56'); if (rnd() < 0.3) R(x + rnd() * 12, y + rnd() * 12, 4, 3, '#86c862'); }
      else if (t === T.WALK) { R(x, y, 16, 16, '#d8d0c0'); R(x, y, 16, 0.4, '#c7bfae'); R(x, y, 0.4, 16, '#c7bfae'); R(x + 8, y, 0.3, 16, '#cfc7b6'); R(x, y + 8, 16, 0.3, '#cfc7b6'); }
      else if (t === T.ROAD) R(x, y, 16, 16, '#4b4f57');
      else if (t === T.SHOULDER) R(x, y, 16, 16, '#6c7078');
      else if (t === T.DIRT) { R(x, y, 16, 16, '#c9a26a'); if (rnd() < 0.4) R(x + rnd() * 13, y + rnd() * 13, 2, 1.5, '#b88f58'); }
      else if (t === T.YARD) { R(x, y, 16, 16, '#b7bcc2'); R(x, y, 16, 0.4, '#a5aab0'); R(x, y, 0.4, 16, '#a5aab0'); }
      else if (t === T.WATER) { R(x, y, 16, 16, '#4ea3d8'); if (rnd() < 0.5) R(x + rnd() * 10, y + rnd() * 14, 5, 0.6, '#7cc1ea'); }
      else if (t === T.PADDY) { R(x, y, 16, 16, '#8fcf63'); for (let a = 1; a < 16; a += 3) R(x + a, y, 1.2, 16, '#79b852'); }
      else if (t === T.MEDIAN) R(x, y, 16, 16, '#7cbf5a');
      else if (t === T.RAIL) { R(x, y, 16, 16, '#9a9288'); for (let k = 1; k < 16; k += 4) R(x + 1.5, y + k, 13, 2, '#7a5a3a'); }
    }
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = MAP.get(m, tx, ty), x = tx * TILE, y = ty * TILE;
      for (const [dx, dy, a, b, w, h] of [[0, -1, x, y, 16, 0.8], [0, 1, x, y + 15.2, 16, 0.8], [-1, 0, x, y, 0.8, 16], [1, 0, x + 15.2, y, 0.8, 16]]) {
        const o = MAP.get(m, tx + dx, ty + dy);
        if (t === T.WALK && o === T.ROAD) R(a, b, w, h, '#f1ede4');
        if (t === T.PADDY && o !== T.PADDY) R(a, b, w, h, '#a58e5f');
        if (t === T.WATER && o !== T.WATER && o !== T.ROAD && o !== T.SHOULDER) R(a, b, w, h, '#8d7a55');
      }
    }
    MAP.drawSpecialGround(g, m);
    MAP.drawMarkings(g, m);
    for (const h of m.manholes) { R(h.x - 2, h.y - 2, 4, 4, '#3a3d42'); R(h.x - 1.5, h.y - 1.5, 3, 3, '#5f636a'); }
    for (const bp of m.bumps) for (let y = bp.y0; y < bp.y1; y += 2) R(bp.x, y, 3, 2, (y / 2) % 2 ? '#1a1a1a' : '#ffd23f');
    for (const p of m.props) if (p.type === 'scale') { R(p.x, p.y, 40, 16, '#8c9298'); for (let i = 0; i < 40; i += 4) { R(p.x + i, p.y, 2, 1, '#ffd23f'); R(p.x + i, p.y + 15, 2, 1, '#ffd23f'); } }
    return c;
  },

  /* ---------------- NHÀ 3D ---------------- */
  building(S, WL, WD, b, m) {
    const X = b.x * TILE, Z = b.y * TILE, W = b.w * TILE, D = b.h * TILE, cx = X + W / 2, cz = Z + D / 2;
    const rnd = U.rng(b.seed || 1);
    const pick = a => a[Math.floor(rnd() * a.length)];
    /* mặt tiền quay về phía đường gần nhất */
    let south = 0, north = 0;
    for (let k = 1; k <= 3; k++) for (let x = b.x; x < b.x + b.w; x++) {
      const ts = MAP.get(m, x, b.y + b.h - 1 + k), tn = MAP.get(m, x, b.y - k);
      if (ts === T.ROAD || ts === T.WALK || ts === T.DIRT || ts === T.SHOULDER) south++;
      if (tn === T.ROAD || tn === T.WALK || tn === T.DIRT || tn === T.SHOULDER) north++;
    }
    const fs = south >= north ? 1 : -1;              // +1: mặt tiền phía Nam (z lớn)
    const fz = fs > 0 ? Z + D - 1 : Z + 1;           // toạ độ z mặt tiền
    const win = (x, y, z, w, h, axis, lit) => {
      const B = (lit == null ? rnd() < 0.6 : lit) ? WL : WD;
      if (axis === 'z') B.box(x, y, z, w, h, 0.5, '#ffffff'); else B.box(x, y, z, 0.5, h, w, '#ffffff');
    };
    if (b.style === 'house') {
      const H = 9 + Math.floor(rnd() * 2);
      S.box(cx, 0, cz, W - 2, H, D - 2, b.c);
      S.box(cx, 0, cz, W - 1.4, 1, D - 1.4, '#9e9585');
      const along = W >= D;
      S.prism(cx, H, cz, along ? W + 1 : D + 1, 6.5, along ? D + 1 : W + 1, '#c0583c', along ? 0 : Math.PI / 2);
      S.prism(cx, H + 0.2, cz, along ? W + 1.6 : D + 1.6, 0.6, 0.6, '#d97a58', along ? 0 : Math.PI / 2);
      const dz = fs > 0 ? Z + D - 1 : Z + 1;
      S.box(cx, 0, dz, 4, 6.5, 0.8, '#7b4a26');
      for (let x = X + 4; x < X + W - 4; x += 8) if (Math.abs(x - cx) > 4) { S.box(x, 3, dz, 3.4, 3.4, 0.7, '#3f6f4f'); win(x, 3.6, dz + fs * 0.2, 2, 2.2, 'z'); }
      S.box(cx, 0, dz + fs * 2.5, 8, 0.6, 4, '#a39a8a');
    } else if (b.style === 'factory') {
      const H = 16 + Math.floor(rnd() * 6);
      S.box(cx, 0, cz, W - 1, H, D - 1, '#cfd3d8');
      S.box(cx, H - 2.5, cz, W - 0.6, 2.5, D - 0.6, '#1d4fa3');
      for (let x = X + 8; x < X + W - 6; x += 18) S.box(x, 0, fz, 11, 11, 0.8, '#8a9096');
      for (let x = X + 4; x < X + W - 3; x += 6) win(x, 13, fz + fs * 0.2, 3, 2, 'z');
      for (let x = X + 8; x < X + W - 4; x += 16) S.prism(x, H, cz, 16, 5, D - 1, b.c, 0);
    } else if (b.style === 'dorm') {
      const fl = 4 + Math.floor(rnd() * 2), H = fl * 8 + 2;
      S.box(cx, 0, cz, W - 1, H, D - 1, b.c);
      S.box(cx, H, cz, W - 0.4, 1.2, D - 0.4, '#a9a29a');
      for (let f = 0; f < fl; f++) {
        const y = f * 8 + 2.5;
        S.box(cx, y - 1.2, fz + fs * 1, W - 1, 0.6, 2, '#b8b0a2');
        for (let x = X + 3; x < X + W - 2; x += 6) {
          win(x, y, fz + fs * 0.3, 3, 3.8, 'z');
          if (rnd() < 0.5) S.box(x, y - 0.3, fz + fs * 1.6, 3, 1.4, 0.4, pick(['#e63946', '#f1f1f1', '#3a86ff', '#ffb703', '#90be6d']));
        }
        for (let z = Z + 4; z < Z + D - 3; z += 7) { win(X + 0.7, y, z, 3, 3.8, 'x'); win(X + W - 0.7, y, z, 3, 3.8, 'x'); }
      }
    } else {
      /* nhà phố nhiều tầng: tầng trệt bán hàng, mái hiên sọc, biển hiệu, cửa sổ, ban công, bồn nước */
      const fl = 2 + Math.floor(rnd() * 3), H = fl * 9 + 3;
      for (let x = X; x < X + W - 2; x += 16) {
        const bw = Math.min(16, X + W - x) - 0.6, bx = x + bw / 2 + 0.3;
        const hh = H - (rnd() < 0.35 ? 9 : 0);
        S.box(bx, 0, cz, bw, hh, D - 1, b.c);
        S.box(bx, hh, cz, bw + 0.3, 1.2, D - 0.7, '#c9c1b2');
        if (rnd() < 0.5) { S.cyl(bx - 3, hh + 1.2, cz, 2.3, 4, '#cfd8dc', 8); S.cyl(bx - 3, hh + 5.2, cz, 2.4, 0.6, '#b0bec5', 8); }
        else S.box(bx + 2, hh + 1.2, cz, 7, 1, 6, '#1d3557', 0, 0.25);
        const aw = pick(['#e63946', '#1d4fa3', '#2a9d8f', '#ff7b00', '#7b2cbf', '#d4a017']);
        for (let k = 0; k < 4; k++) S.box(x + 0.3 + bw * (k + 0.5) / 4, 7.5, fz + fs * 2, bw / 4, 0.6, 4, k % 2 ? '#f4f4f4' : aw, 0, fs * -0.25);
        S.box(bx, 8.6, fz + fs * 0.4, bw - 2, 2.2, 0.6, pick(['#c1121f', '#1d4fa3', '#e9c46a', '#2a9d8f', '#ffffff']));
        if (rnd() < 0.5) S.box(bx, 0, fz + fs * 0.1, bw - 2.5, 7, 0.4, '#8a9096');
        else { WL.box(bx, 0.5, fz + fs * 0.25, bw - 3, 6, 0.4, '#ffffff'); S.box(bx - 3, 0, fz + fs * 2.5, 3, 2.5, 2.5, pick(['#f4a261', '#90be6d', '#e9c46a'])); }
        for (let f = 1; f < (hh - 3) / 9; f++) {
          const y = f * 9 + 2;
          win(bx - 3.5, y, fz + fs * 0.3, 3.4, 4.4, 'z'); win(bx + 3.5, y, fz + fs * 0.3, 3.4, 4.4, 'z');
          if (rnd() < 0.45) { S.box(bx, y - 1, fz + fs * 1.6, bw - 2, 0.5, 3, '#9e9585'); S.box(bx, y - 0.5, fz + fs * 3, bw - 2, 2.2, 0.3, '#3a3a3a'); if (rnd() < 0.6) S.ico(bx - 4, y, fz + fs * 2, 1.1, '#4f8f3a'); }
          if (rnd() < 0.3) S.box(bx + 6, y + 0.5, fz + fs * 1, 2.4, 2, 1.4, '#dfe3e6');
          win(bx, y, Z + (fs > 0 ? 1 : D - 1) - fs * 0.3, 3.4, 4.4, 'z');
        }
      }
    }
  },

  tree(S, x, z, k, rnd) {
    if (k === 'bamboo') {
      for (let i = 0; i < 6; i++) { const a = i * 1.05, r = 2.5; S.cyl(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, 0.35, 15 + (i % 3) * 2, '#97b04a', 6); }
      S.ico(x, 13, z, 5.5, '#4f8f2e', 1.2); S.ico(x + 3, 16, z - 2, 4, '#5fa03a', 1.1); S.ico(x - 3, 15, z + 2, 3.8, '#3f7d2a', 1.1);
      return;
    }
    if (k === 'palm') {
      S.cyl(x, 0, z, 0.9, 16, '#8a6a42', 6, 0, 0.12);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        S.box(x + Math.cos(a) * 3.5 + 2, 15.5, z + Math.sin(a) * 3.5, 8, 0.6, 2, i % 2 ? '#3f9a3f' : '#2f7a2f', -a, 0, -0.3);
      }
      S.ico(x + 2, 15.5, z, 1.4, '#8b5a2b');
      return;
    }
    const s = k === 'street' ? 0.85 : 0.85 + rnd() * 0.35;
    S.cyl(x, 0, z, 0.9 * s, 8 * s, '#6b4a2b', 6);
    if (k === 'street') S.box(x, 0, z, 5, 0.5, 5, '#8d8478');
    const g = ['#3f8a3a', '#4d9a42', '#5aa84c', '#2e6b2e'];
    S.ico(x, 10 * s, z, 6.2 * s, g[Math.floor(rnd() * 4)], 0.95);
    S.ico(x + 2 * s, 13.5 * s, z - 1 * s, 4.2 * s, g[Math.floor(rnd() * 3)], 0.95);
  },

  prop(S, p) {
    const x = p.x, z = p.y;
    if (p.type === 'stall') {
      S.box(x + 8, 0, z + 8, 13, 4, 6, '#8d6e63');
      S.box(x + 4, 4, z + 7, 3, 1.5, 3, '#f4a261'); S.box(x + 8, 4, z + 7, 3, 1.5, 3, '#90be6d'); S.box(x + 12, 4, z + 7, 3, 1.5, 3, '#e9c46a');
      for (const [a, b] of [[2, 4], [14, 4], [2, 12], [14, 12]]) S.cyl(x + a, 0, z + b, 0.35, 9, '#5a3e2b', 6);
      for (let i = 0; i < 4; i++) S.box(x + 2 + i * 4, 9, z + 8, 4, 0.6, 12, i % 2 ? '#f1f1f1' : (p.c || '#e63946'));
    } else if (p.type === 'container') {
      const w = p.w || 30;
      S.box(x + w / 2, 0, z + 6, w, 12, 12, p.c || '#c1121f');
      for (let i = 3; i < w; i += 4) S.box(x + i, 0.3, z + 6, 0.5, 11.4, 12.4, SPR.sh(p.c || '#c1121f', -0.2));
    } else if (p.type === 'haystack') {
      S.cone(x + 8, 0, z + 8, 6, 9, '#d9b44a', 8); S.cyl(x + 8, 8.5, z + 8, 0.4, 2, '#8a6239', 6);
    } else if (p.type === 'boat') {
      S.box(x + 11, -1, z + 6, 22, 3, 6, '#6b4a2b'); S.box(x + 11, 2, z + 6, 7, 3, 4, '#d9b44a');
    } else if (p.type === 'chimney') {
      S.cyl(x + 3.5, 0, z + 3.5, 3, 42, '#c84b3a', 8); for (let y = 8; y < 42; y += 10) S.cyl(x + 3.5, y, z + 3.5, 3.1, 3, '#f1f1f1', 8);
    } else if (p.type === 'gate') {
      S.box(x + 2.5, 0, z + 2.5, 5, 18, 5, '#e3d9c6'); S.box(x + p.w - 2.5, 0, z + 2.5, 5, 18, 5, '#e3d9c6');
      S.box(x + p.w / 2, 18, z + 2.5, p.w, 4, 4, '#1d4fa3');
    } else if (p.type === 'scale') {
      S.box(x + 47, 0, z + 7, 10, 9, 10, '#e3d9c6'); S.box(x + 47, 9, z + 7, 11, 1, 11, '#1d4fa3');
    } else if (p.type === 'bench') {
      S.box(x + 5, 0, z + 1.5, 10, 2.2, 3, '#8a6239');
    }
  },

  parkedBike(S, pk) {
    const rnd = U.rng(Math.floor(pk.x * 7 + pk.y * 13));
    if (pk.car) {
      const c = ['#c1121f', '#f1f1f1', '#262626', '#3a86ff', '#6c757d', '#e9c46a'][Math.floor(rnd() * 6)];
      const x = pk.x + 6, z = pk.y + 11;
      S.box(x, 0.8, z, 12, 3.6, 22, c); S.box(x, 4.4, z + 1, 10, 3.2, 11, '#22344a'); S.box(x, 7.6, z + 1, 10.2, 0.7, 10.5, c);
      for (const [a, b] of [[-5, -7], [5, -7], [-5, 7], [5, 7]]) S.box(x + a, 0, z + b, 1.6, 3.6, 3.6, '#151515');
      return;
    }
    const col = ['#c1121f', '#222222', '#3a86ff', '#e9e9e9', '#6a4c93', '#2a9d8f', '#d4a017'][Math.floor(rnd() * 7)];
    const x = pk.x + 2, z = pk.y + 6;
    S.box(x, 1, z, 2.2, 3, 11, col); S.box(x, 0, z - 4.5, 1.2, 2.8, 2.6, '#151515'); S.box(x, 0, z + 4.5, 1.2, 2.8, 2.6, '#151515');
    S.box(x, 3.8, z + 0.5, 2, 0.8, 4, '#222'); S.box(x, 4, z + (pk.up ? -4 : 4), 5, 0.5, 0.5, '#999');
  },

  /* ================= MÔ HÌNH ĐỘNG ================= */
  hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); },

  rider(B, x, helm, hc, shirt, phone, scale) {
    const s = scale || 1;
    B.box(x, 4.2, 0, 3.2 * s, 5.2 * s, 4.2 * s, shirt);
    B.box(x + 1.6, 6, 1.6, 3, 1, 1, shirt); B.box(x + 1.6, 6, -1.6, 3, 1, 1, shirt);
    if (helm) { B.box(x, 9.4, 0, 3.4, 3.2, 3.4, hc); B.box(x + 1.7, 9.8, 0, 0.4, 1.6, 2.6, '#1b2533'); }
    else { B.box(x, 9.4, 0, 3, 3, 3, '#e0ac69'); B.box(x - 0.2, 11, 0, 3.2, 1.3, 3.2, '#2b1d14'); }
    if (phone) { B.box(x + 1.2, 9.6, 2.1, 0.5, 2, 1.2, '#5ef2ff'); }
  },

  vehicleModel(v) {
    const B = R3.B();
    const h = R3.hash(v.plate || 'x');
    const P = (a, k) => a[(h >> (k || 0)) % a.length];
    const L = v.len, W = v.wid;
    const crash = v.state === 'crash';
    if (v.kind === 'moto') {
      const col = v.robber ? '#2b2b2b' : P(TRAFFIC.MOTO_COLORS);
      B.box(-L / 2 + 2, 0, 0, 3.6, 3.6, 1.2, '#151515'); B.box(L / 2 - 2, 0, 0, 3.6, 3.6, 1.2, '#151515');
      B.box(0, 2, 0, L - 4, 2.6, 2.6, col); B.box(L / 2 - 3.5, 2.5, 0, 3, 3.5, 3, col);
      B.box(L / 2 - 3.5, 6, 0, 0.6, 0.6, 6, '#8a8a8a'); B.box(L / 2 - 1.2, 3.5, 0, 0.6, 1.2, 1.4, '#fff3a0');
      B.box(-L / 2 + 0.3, 3, 0, 0.5, 1, 1.2, '#d62828');
      const shirt = v.robber ? '#1c1c1c' : v.racer ? P(['#ff006e', '#3a86ff', '#ffbe0b'], 3) : P(TRAFFIC.SHIRTS, 2);
      R3.rider(B, L / 2 - 8, v.helmet, v.robber ? '#111111' : P(TRAFFIC.HELMETS, 4), shirt, v.phone);
      if (v.pass >= 1) R3.rider(B, L / 2 - 12, v.passHelmet, v.robber ? '#111111' : P(TRAFFIC.HELMETS, 5), v.robber ? '#1c1c1c' : P(TRAFFIC.SHIRTS, 6), false);
      if (v.pass === 2) R3.rider(B, L / 2 - 16, v.passHelmet, P(TRAFFIC.HELMETS, 7), P(TRAFFIC.SHIRTS, 8), false, 0.85);
      if (v.robber) B.box(L / 2 - 12, 5, 3, 2, 2.5, 1.2, '#c77dff');
    } else if (v.kind === 'car' || v.kind === 'amb') {
      R3.carBody(B, L, W, v.kind === 'amb' ? '#f7f7f7' : P(TRAFFIC.CAR_COLORS), v.kind === 'amb' ? 'amb' : null);
      if (v.phone) B.box(L / 2 - 9, 6, -W / 4, 0.5, 1.5, 1, '#5ef2ff');
    } else if (v.kind === 'bus') {
      const col = P(['#f1f1f1', '#e9c46a', '#2a9d8f', '#3a86ff', '#c1121f', '#f4a261']), acc = P(['#1d4fa3', '#c1121f', '#2a9d8f', '#ff7b00'], 3);
      for (const x of [-L / 2 + 7, L / 2 - 7]) { B.box(x, 0, W / 2 - 0.6, 4.5, 4.5, 1.4, '#151515'); B.box(x, 0, -W / 2 + 0.6, 4.5, 4.5, 1.4, '#151515'); }
      B.box(0, 1.5, 0, L, 11, W - 0.6, col);
      B.box(-1, 7, 0, L - 5, 3, W - 0.2, '#22344a');
      B.box(0, 4.2, 0, L, 1.2, W - 0.3, acc);
      B.box(L / 2 - 0.2, 4, 0, 0.6, 7.5, W - 2, '#22344a');
      B.box(-2, 12.5, 0, 12, 1.4, W - 5, '#b0bec5');
      B.box(L / 2, 2.5, W / 2 - 2, 0.5, 1, 2, '#fff3a0'); B.box(L / 2, 2.5, -W / 2 + 2, 0.5, 1, 2, '#fff3a0');
      if (v.busExcess > 0) for (let i = 0; i < 3; i++) R3.rider(B, L / 2 - 6 - i * 3.5, false, null, P(TRAFFIC.SHIRTS, i + 2), false, 0.8), B.p.length;
    } else {
      const cab = P(['#1d4e89', '#c1121f', '#2a9d8f', '#e9c46a', '#f1f1f1']);
      for (const x of [-L / 2 + 5, -L / 2 + 10, L / 2 - 5]) { B.box(x, 0, W / 2 - 0.6, 4, 4, 1.4, '#151515'); B.box(x, 0, -W / 2 + 0.6, 4, 4, 1.4, '#151515'); }
      B.box(-5, 2, 0, L - 10, 1.5, W - 0.8, '#3a3a3a');
      B.box(L / 2 - 4.5, 2, 0, 9, 9, W - 0.6, cab); B.box(L / 2 - 0.4, 5.5, 0, 0.6, 3.5, W - 2, '#22344a'); B.box(L / 2 - 4.5, 11, 0, 8, 0.8, W - 1, SPR.sh(cab, -0.2));
      B.box(L / 2, 3, W / 2 - 1.6, 0.5, 1, 1.6, '#fff3a0'); B.box(L / 2, 3, -W / 2 + 1.6, 0.5, 1, 1.6, '#fff3a0');
      const bl = L - 11, bx = -L / 2 + bl / 2 + 0.5;
      const type = P(['plank', 'container', 'tarp'], 2);
      if (type === 'container') B.box(bx, 3.5, 0, bl, 9.5, W - 0.6, P(['#d9d9d9', '#b56576', '#6d6875', '#e76f51', '#457b9d'], 4));
      else if (type === 'tarp') { B.box(bx, 3.5, 0, bl, 7, W - 0.6, '#4f7a3a'); B.prism(bx, 10.5, 0, bl, 2, W - 0.6, '#5d8a46'); }
      else { B.box(bx, 3.5, W / 2 - 0.6, bl, 4, 0.8, '#9c6b3c'); B.box(bx, 3.5, -W / 2 + 0.6, bl, 4, 0.8, '#9c6b3c'); B.box(-L / 2 + 0.9, 3.5, 0, 0.8, 4, W - 0.6, '#9c6b3c'); }
      if (DATA.loadTier(v.overPct)) { B.box(bx, 3.5, 0, bl - 1, 6, W - 1.6, '#8d6e63'); B.ico(bx - bl / 4, 9, 0, 4.5, '#a1887f', 0.7); B.ico(bx + bl / 4, 9, 0, 4, '#795548', 0.7); }
      if (v.height > v.heightLimit) { B.box(bx, 3.5, 0, bl + 0.6, 15, W + 0.4, '#3f6a8f'); for (let x = bx - bl / 2 + 3; x < bx + bl / 2; x += 6) B.box(x, 3.5, 0, 0.5, 15.2, W + 0.6, '#ffd23f'); }
      if (crash) for (let i = 0; i < 6; i++) B.box(-L / 2 - 4 - i * 3, 0, (i % 3 - 1) * 5, 3, 2, 3, i % 2 ? '#8d6e63' : '#a1887f');
    }
    const g = new THREE.Group();
    const mesh = B.mesh(); g.add(mesh);
    if (v.kind === 'amb') { R3.addBar(g, 2, 7.6, 0); }
    if (v.estop) {
      const hz = new THREE.Group(); hz.name = 'hz'; hz.visible = false;
      const hm = new THREE.MeshBasicMaterial({ color: 0xffb000 });
      for (const [a, b] of [[L / 2, W / 2 - 1.5], [L / 2, -W / 2 + 1.5], [-L / 2, W / 2 - 1.5], [-L / 2, -W / 2 + 1.5]]) { const mm = new THREE.Mesh(R3.sphere, hm); mm.scale.setScalar(1.1); mm.position.set(a, 4, b); hz.add(mm); }
      g.add(hz);
    }
    /* đèn pha hắt sáng xuống mặt đường (ban đêm) */
    const hl = new THREE.Mesh(R3.lightPlane(), R3.headMat());
    hl.position.set(L / 2 + 18, 0.4, 0); hl.scale.set(v.kind === 'moto' ? 0.7 : 1, 1, v.kind === 'moto' ? 0.6 : 1);
    hl.visible = false; hl.name = 'hl';
    g.add(hl);
    if (crash) {
      if (v.kind === 'truck') { mesh.rotation.x = 1.3; mesh.position.z = 6; }
      if (v.kind === 'moto') { mesh.rotation.x = 1.45; mesh.position.y = 1.5; }
    }
    return g;
  },

  carBody(B, L, W, col, variant) {
    const dk = SPR.sh(col, -0.3);
    for (const x of [-L / 2 + 5, L / 2 - 5]) { B.box(x, 0, W / 2 - 0.8, 4.2, 4.2, 1.6, '#151515'); B.box(x, 0, -W / 2 + 0.8, 4.2, 4.2, 1.6, '#151515'); }
    B.box(0, 1.6, 0, L, 3.6, W, col);
    B.box(-1, 5.2, 0, L * 0.5, 3.4, W * 0.84, '#22344a');
    B.box(-1, 8.4, 0, L * 0.46, 0.8, W * 0.86, col);
    B.box(L / 2 - 2, 5.2, 0, 1, 0.4, W - 1, dk);
    B.box(L / 2 + 0.1, 3, W / 2 - 1.8, 0.4, 1.2, 2, '#fff3a0'); B.box(L / 2 + 0.1, 3, -W / 2 + 1.8, 0.4, 1.2, 2, '#fff3a0');
    B.box(-L / 2 - 0.1, 3, W / 2 - 1.8, 0.4, 1.2, 2, '#d62828'); B.box(-L / 2 - 0.1, 3, -W / 2 + 1.8, 0.4, 1.2, 2, '#d62828');
    B.box(L / 2 - 9, 5, W / 2 + 0.5, 1, 1, 1, dk); B.box(L / 2 - 9, 5, -W / 2 - 0.5, 1, 1, 1, dk);
    if (variant === 'patrol') {
      B.box(0, 3, W / 2 + 0.05, L, 1, 0.2, '#1d4fa3'); B.box(0, 3, -W / 2 - 0.05, L, 1, 0.2, '#1d4fa3');
      B.box(0, 2.3, W / 2 + 0.06, L, 0.6, 0.2, '#ffd23f'); B.box(0, 2.3, -W / 2 - 0.06, L, 0.6, 0.2, '#ffd23f');
      B.box(L / 2 - 4, 5.25, 0, 3, 0.2, 3, '#ffd23f');
    }
    if (variant === 'amb') { B.box(0, 3, W / 2 + 0.05, L, 1, 0.2, '#d62828'); B.box(0, 3, -W / 2 - 0.05, L, 1, 0.2, '#d62828'); B.box(-1, 9.25, 0, 2, 0.2, 6, '#d62828'); B.box(-1, 9.25, 0, 6, 0.2, 2, '#d62828'); }
  },

  /* thanh đèn ưu tiên (xanh - đỏ nhấp nháy) */
  addBar(g, x, y, z) {
    if (!R3.lightGeo) R3.lightGeo = new THREE.BoxGeometry(1, 1, 1);
    const red = new THREE.Mesh(R3.lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    const blue = new THREE.Mesh(R3.lightGeo, new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    red.scale.set(2, 1.2, 3); blue.scale.set(2, 1.2, 3);
    red.position.set(x, y + 0.6, z - 1.6); blue.position.set(x, y + 0.6, z + 1.6);
    red.name = 'barR'; blue.name = 'barB';
    g.add(red, blue);
    const glow = new THREE.Mesh(R3.lightPlane(true), new THREE.MeshBasicMaterial({ map: R3.radial, color: 0xff3030, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(0, 0.45, 0); glow.name = 'barGlow';
    g.add(glow);
  },

  lightPlane(round) {
    const key = round ? '_lpR' : '_lp';
    if (!R3[key]) {
      const g = new THREE.PlaneGeometry(round ? 50 : 36, round ? 50 : 22);
      g.rotateX(-Math.PI / 2);
      R3[key] = g;
    }
    return R3[key];
  },
  headMat() {
    if (!R3._hm) R3._hm = new THREE.MeshBasicMaterial({ map: R3.radial, color: 0xfff1c8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    return R3._hm;
  },

  pedModel(st) {
    const B = R3.B();
    B.box(-0.9, 0, 0, 1.3, 4, 1.3, st.pants); B.box(0.9, 0, 0, 1.3, 4, 1.3, st.pants);
    B.box(0, 4, 0, 3.6, 4.4, 2.4, st.shirt);
    B.box(-2.2, 4.6, 0, 0.9, 3.4, 1, st.shirt); B.box(2.2, 4.6, 0, 0.9, 3.4, 1, st.shirt);
    B.box(0, 8.4, 0, 2.6, 2.6, 2.4, '#e8b98a');
    if (st.hat === 'non') B.cone(0, 10.4, 0, 3.6, 2.2, '#e9d8a6', 8);
    else if (st.hat === 'helmet') B.box(0, 10.6, 0, 3, 1.4, 2.8, '#ffd23f');
    else B.box(0, 10.6, 0, 2.8, 1, 2.6, st.hair || '#2b1d14');
    if (st.bag) B.box(0, 5, -1.6, 2.2, 3, 1, st.bag);
    if (st.child) { const g = new THREE.Group(); const m = B.mesh(); m.scale.setScalar(0.7); g.add(m); return g; }
    const g = new THREE.Group(); g.add(B.mesh()); return g;
  },

  officerModel() {
    const B = R3.B();
    B.box(-1, 0, 0, 1.6, 4.5, 1.6, '#3d5a2a'); B.box(1, 0, 0, 1.6, 4.5, 1.6, '#3d5a2a');
    B.box(0, 4.5, 0, 4.2, 5, 2.8, '#d8b24a');
    B.box(0, 8.8, 0, 4.4, 0.8, 3, '#2f5d34');
    B.box(-2.7, 5.3, 0, 1, 3.8, 1.1, '#d8b24a'); B.box(2.7, 5.3, 0, 1, 3.8, 1.1, '#d8b24a');
    B.box(-2.7, 4.6, 0, 1.1, 0.9, 1.2, '#f5f5f5'); B.box(2.7, 4.6, 0, 1.1, 0.9, 1.2, '#f5f5f5');
    B.box(3.3, 5, 0, 0.5, 5, 0.5, '#f5f5f5');
    B.box(0, 9.5, 0, 3, 3, 2.8, '#f1c27d');
    B.box(0, 12.5, 0, 3.6, 1.6, 3.4, '#2f5d34'); B.box(0, 12.2, 0, 3.7, 0.5, 3.5, '#c0392b'); B.box(1.9, 12.3, 0, 0.3, 0.8, 0.8, '#ffd23f');
    const g = new THREE.Group(); g.add(B.mesh()); return g;
  },

  patrolModel(veh) {
    const B = R3.B(), g = new THREE.Group();
    if (veh === 'car') {
      R3.carBody(B, 26, 13, '#f4f4f4', 'patrol');
      g.add(B.mesh()); R3.addBar(g, -1, 9.2, 0);
    } else {
      const L = 18;
      B.box(-L / 2 + 2, 0, 0, 3.8, 3.8, 1.3, '#151515'); B.box(L / 2 - 2, 0, 0, 3.8, 3.8, 1.3, '#151515');
      B.box(0, 2, 0, L - 4, 3, 3, '#f4f4f4'); B.box(0, 3.3, 1.55, L - 4, 0.8, 0.2, '#1d4fa3'); B.box(0, 3.3, -1.55, L - 4, 0.8, 0.2, '#1d4fa3');
      B.box(L / 2 - 3.5, 2.5, 0, 3, 5, 3.6, '#f4f4f4');
      B.box(-L / 2 + 2.5, 3, 0, 4.5, 4.5, 6, '#e8e8e8'); B.box(-L / 2 + 2.5, 5, 3.05, 3, 1.6, 0.2, '#ffd23f'); B.box(-L / 2 + 2.5, 5, -3.05, 3, 1.6, 0.2, '#ffd23f');
      B.box(L / 2 - 3.5, 7.2, 0, 0.6, 0.6, 7, '#8a8a8a');
      R3.rider(B, L / 2 - 8, true, '#f7f7f7', '#d8b24a', false);
      g.add(B.mesh()); R3.addBar(g, -L / 2 + 2.5, 7.4, 0);
      g.getObjectByName('barR').scale.set(1, 1, 1.4); g.getObjectByName('barB').scale.set(1, 1, 1.4);
    }
    const hl = new THREE.Mesh(R3.lightPlane(), R3.headMat());
    hl.position.set(veh === 'car' ? 32 : 26, 0.4, 0); hl.visible = false; hl.name = 'hl';
    g.add(hl);
    return g;
  },

  /* ================= MỖI KHUNG HÌNH ================= */
  syncVehicles(t, night) {
    const seen = new Set();
    for (const v of TRAFFIC.list) {
      let g = R3.vmap.get(v);
      if (!g || g.userData.crash !== (v.state === 'crash')) {
        if (g) R3.disposeTree(g);
        g = R3.vehicleModel(v); g.userData.crash = v.state === 'crash';
        R3.vmap.set(v, g); R3.scene.add(g);
      }
      seen.add(v);
      g.position.set(v.x, 0, v.y);
      g.rotation.y = -(TRAFFIC.angle(v) + (v.crashAngle || 0));
      const hl = g.getObjectByName('hl'); if (hl) hl.visible = night && v.state !== 'crash';
      if (v.kind === 'amb') R3.flashBar(g, t);
      const hz = g.getObjectByName('hz'); if (hz) hz.visible = v.estop.hazard && (v.parked || v.state === 'stopped') && Math.floor(t * 2.5) % 2 === 0;
    }
    R3.vmap.forEach((g, v) => { if (!seen.has(v)) { R3.disposeTree(g); R3.vmap.delete(v); } });
  },

  flashBar(g, t) {
    const on = Math.floor(t * 4) % 2 === 0;
    const r = g.getObjectByName('barR'), b = g.getObjectByName('barB'), gl = g.getObjectByName('barGlow');
    if (r) r.material.color.setHex(on ? 0xff2a2a : 0x401010);
    if (b) b.material.color.setHex(on ? 0x102040 : 0x2a6aff);
    if (gl) gl.material.color.setHex(on ? 0xff3030 : 0x2a60ff);
  },

  syncPeds(t) {
    const seen = new Set();
    for (const p of LIFE.peds) {
      let g = R3.pmap.get(p);
      if (!g) { g = R3.pedModel(p.style); R3.pmap.set(p, g); R3.scene.add(g); }
      seen.add(p);
      const walk = p.pause > 0 ? 0 : Math.abs(Math.sin(p.f * Math.PI));
      g.position.set(p.x, walk * 0.6, p.y);
      g.rotation.y = p.ax === 'x' ? (p.d > 0 ? 0 : Math.PI) : (p.d > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    R3.pmap.forEach((g, p) => { if (!seen.has(p)) { R3.disposeTree(g); R3.pmap.delete(p); } });
    /* người của tình huống hỗ trợ (trẻ lạc, cụ già) */
    const A = EVENTS.active;
    const want = A && A.ped && !G.cp ? A.ped : null;
    if (R3.evPedKind !== want) {
      if (R3.evPed) { R3.disposeTree(R3.evPed); R3.evPed = null; }
      if (want) { R3.evPed = R3.pedModel(want === 'child' ? { shirt: '#ff6b9a', pants: '#3a3a6a', child: true } : { shirt: '#6d597a', pants: '#4a4a4a', hat: 'non' }); R3.scene.add(R3.evPed); }
      R3.evPedKind = want;
    }
    if (R3.evPed && A && A.spot) { R3.evPed.position.set(A.spot.x, Math.abs(Math.sin(t * 6)) * 0.4, A.spot.y); R3.evPed.rotation.y = Math.PI / 2; }
  },

  syncPlayer(t, night) {
    const kind = G.mode === 'menu' ? null : (PLAYER.veh || 'officer');
    if (R3.playerKind !== kind) {
      if (R3.player) { R3.disposeTree(R3.player); R3.player = null; }
      if (kind) { R3.player = kind === 'officer' ? R3.officerModel() : R3.patrolModel(kind); R3.scene.add(R3.player); }
      R3.playerKind = kind;
    }
    if (!R3.player) return;
    R3.player.position.set(PLAYER.x, 0, PLAYER.y);
    if (PLAYER.veh) {
      const sp = Math.hypot(PLAYER.vx, PLAYER.vy);
      if (sp > 8) {
        const want = -Math.atan2(PLAYER.vy, PLAYER.vx);
        let d = want - R3.player.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        R3.player.rotation.y += d * 0.25;
      }
      R3.flashBar(R3.player, t);
      const bg = R3.player.getObjectByName('barGlow'); if (bg) bg.material.opacity = night ? 0.6 : G.shift && G.shift.light === 'dusk' ? 0.4 : 0.2;
      const hl = R3.player.getObjectByName('hl'); if (hl) hl.visible = night;
    } else {
      R3.player.rotation.y = { right: 0, down: -Math.PI / 2, left: Math.PI, up: Math.PI / 2 }[PLAYER.face] || 0;
    }
  },

  syncLights() {
    const on = { r: 0xff3b30, y: 0xffcc00, g: 0x34e05a }, off = { r: 0x3a1210, y: 0x3a300c, g: 0x0e3016 };
    for (const L of R3.lights) {
      const st = TRAFFIC.lightState(L.inter, L.axis);
      ['r', 'y', 'g'].forEach((c, i) => { const col = st === c ? on[c] : off[c]; L.lamps[i * 2].material.color.setHex(col); });
    }
  },

  syncRail(t) {
    for (const B of R3.barriers || []) {
      const d = TRAFFIC.barrierDown(B.I);
      B.pivot.rotation.x = -B.sgn * (1 - d) * Math.PI / 2 * 0.98;
      const on = Math.floor(t * 3) % 2 === 0, fl = B.I.st !== 'g';
      B.lamps[0].material.color.setHex(fl && on ? 0xff3b30 : 0x3a1210);
      B.lamps[1].material.color.setHex(fl && !on ? 0xff3b30 : 0x3a1210);
    }
    for (const T2 of R3.trains || []) {
      const tr = T2.I.train;
      T2.g.visible = !!tr;
      if (!tr) continue;
      T2.g.position.set(tr.x, 0, tr.y);
      T2.g.rotation.y = tr.dir > 0 ? 0 : Math.PI;
    }
  },

  syncSmoke(cam) {
    const parts = LIFE.parts.filter(q => !q.ring);
    for (let i = 0; i < R3.smoke.length; i++) {
      const sp = R3.smoke[i], q = parts[i];
      if (!q) { sp.visible = false; continue; }
      const k = q.life / q.max, s = (q.s + (1 - k) * q.grow) * 2.2;
      const chim = q.max > 3;
      sp.visible = true;
      sp.position.set(q.x, chim ? 42 + (1 - k) * 30 : 3 + (1 - k) * 8, q.y + (chim ? 0 : 0));
      sp.scale.set(s, s, 1);
      sp.material.opacity = q.a * k;
      sp.material.color.setRGB(...q.c.split(',').map(n => (+n) / 255));
    }
  },

  /* ánh sáng theo giờ, thời tiết */
  ambience() {
    const L = G.shift ? G.shift.light : 'day', rain = G.shift && G.shift.weather === 'rain';
    const P = {
      day: { bg: '#a9d8f5', sky: '#dff1ff', gnd: '#6b8f4e', hi: 0.68, sun: '#fff2dd', si: 1.0, fog: '#bfe0f2' },
      dusk: { bg: '#f0a676', sky: '#ffcf9f', gnd: '#5a4a6a', hi: 0.5, sun: '#ff9d5c', si: 0.8, fog: '#e7a98a' },
      night: { bg: '#121c40', sky: '#5a6a9a', gnd: '#252a3c', hi: 0.48, sun: '#9fb4e0', si: 0.32, fog: '#121c40' }
    }[L];
    const bg = R3.col(rain ? (L === 'night' ? '#101828' : '#8d9aa8') : P.bg);
    R3.scene.background = bg;
    const d = R3.DIST[R3.zoomIdx];
    if (!R3.scene.fog) R3.scene.fog = new THREE.Fog(bg, 1, 2);
    R3.scene.fog.color.copy(bg); R3.scene.fog.near = d * (rain ? 0.7 : 1.1); R3.scene.fog.far = d * (rain ? 2.2 : 3.4);
    if (DATA.hasMod(G.shift, 'fog')) {
      const fc = R3.col(L === 'night' ? '#2a3040' : '#c9d0d6');
      R3.scene.background = fc; R3.scene.fog.color.copy(fc);
      R3.scene.fog.near = d * 0.55; R3.scene.fog.far = d * 1.45;
    }
    R3.hemi.color.copy(R3.col(P.sky)); R3.hemi.groundColor.copy(R3.col(P.gnd)); R3.hemi.intensity = P.hi * (rain ? 0.8 : 1);
    R3.sun.color.copy(R3.col(P.sun)); R3.sun.intensity = P.si * (rain ? 0.55 : 1);
    const night = L === 'night', dusk = L === 'dusk';
    if (R3.winLitMat) R3.winLitMat.emissive.setHex(night ? 0xffc46a : dusk ? 0x6a4a20 : 0x000000);
    if (R3.winDarkMat) R3.winDarkMat.color.copy(R3.col(night ? '#28324a' : '#6f93b8'));
    if (R3.lampMat) R3.lampMat.color.setHex(night || dusk ? 0xfff0b0 : 0xbfb9a0);
    if (R3.glowMesh) { R3.glowMesh.visible = night || dusk; R3.glowMat.opacity = night ? 0.6 : 0.25; }
    return night || (dusk && false);
  },

  /* ---------------- camera ---------------- */
  zoom(d) {
    const z = U.clamp(R3.zoomIdx - d, 0, R3.DIST.length - 1);
    if (z === R3.zoomIdx) return;
    R3.zoomIdx = z; SAVE.data.zoom3d = z; SAVE.store(); AUDIO.click();
    const zl = UI.$('zoomLbl'); if (zl) zl.textContent = 'x' + (R3.DIST.length - z);
  },
  rotate(d) {
    const k = ((SAVE.data.yaw3d || 0) + d + 4) % 4;
    SAVE.data.yaw3d = k; SAVE.store();
    R3.yawTarget += d * Math.PI / 2;
    AUDIO.click();
  },
  /* biến đổi hướng bấm phím theo góc xoay camera */
  inputToWorld(ix, iy) {
    const a = R3.yawTarget;
    return { x: ix * Math.cos(a) + iy * Math.sin(a), y: -ix * Math.sin(a) + iy * Math.cos(a) };
  },

  updateCamera(dt) {
    const m = R3.m;
    let tx, tz;
    if (G.mode !== 'menu' && R3.spin) { R3.spin = 0; R3.yaw = R3.yawTarget; }
    if (G.mode === 'menu') { R3.spin += dt * 0.06; tx = m.pw * 0.45 + Math.sin(R3.spin * 1.3) * 120; tz = m.ph * 0.5; }
    else if (G.cp && m.cpSpot) { tx = m.cpSpot.x + 30; tz = m.cpSpot.y - 10; }
    else { tx = PLAYER.x; tz = PLAYER.y; }
    const k = R3.snap ? 1 : Math.min(1, dt * 7);
    R3.snap = false;
    R3.target.x += (tx - R3.target.x) * k; R3.target.z += (tz - R3.target.z) * k;
    R3.yaw += (R3.yawTarget - R3.yaw) * Math.min(1, dt * 6);
    const yaw = R3.yaw + R3.spin;
    const dist = R3.DIST[R3.zoomIdx], pitch = 0.92;
    const hz = Math.cos(pitch) * dist, hy = Math.sin(pitch) * dist;
    R3.cam.position.set(R3.target.x + Math.sin(yaw) * hz, hy, R3.target.z + Math.cos(yaw) * hz);
    R3.cam.lookAt(R3.target.x, 0, R3.target.z);
    R3.cam.updateMatrixWorld();
    /* vùng đục lỗ: quanh người chơi (hoặc chốt) trên màn hình, chỉ áp dụng cho vật gần camera hơn người chơi */
    if (G.mode === 'menu') R3.cutU.r.value = 0;
    else {
      if (!R3._bs) { R3._bs = new THREE.Vector2(); R3._pv = new THREE.Vector3(); }
      const bs = R3.renderer.getDrawingBufferSize(R3._bs), pv = R3._pv.set(tx, 6, tz);
      const depth = -pv.clone().applyMatrix4(R3.cam.matrixWorldInverse).z;
      pv.project(R3.cam);
      R3.cutU.p.value.set((pv.x + 1) / 2 * bs.x, (pv.y + 1) / 2 * bs.y);
      R3.cutU.r.value = 24 / depth * bs.y / (2 * Math.tan(R3.cam.fov * Math.PI / 360));
      R3.cutU.d.value = depth - 10;
    }
    /* mặt trời đổ bóng theo hướng Tây Bắc -> Đông Nam, khung bóng bám theo camera */
    const sh = R3.sun.shadow.camera, ext = dist * 0.85;
    sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext; sh.near = 10; sh.far = 900; sh.updateProjectionMatrix();
    R3.sun.position.set(R3.target.x - 160, 300, R3.target.z - 120);
    R3.sun.target.position.set(R3.target.x, 0, R3.target.z);
    /* vùng mặt đất đang nhìn thấy -> cập nhật G.cam (dùng cho logic "trong tầm nhìn") */
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    if (!R3._ray) R3._ray = { r: new THREE.Raycaster(), v2: new THREE.Vector2(), hit: new THREE.Vector3(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) };
    const { r: ray, v2, hit, plane } = R3._ray;
    R3.quad = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ray.setFromCamera(v2.set(a, b), R3.cam);
      if (!ray.ray.intersectPlane(plane, hit) || hit.distanceTo(R3.cam.position) > dist * 3) ray.ray.at(dist * 2.5, hit);
      R3.quad.push({ x: hit.x, y: hit.z });
      x0 = Math.min(x0, hit.x); x1 = Math.max(x1, hit.x); z0 = Math.min(z0, hit.z); z1 = Math.max(z1, hit.z);
    }
    G.cam.x = x0; G.cam.y = z0; G.cam.w = x1 - x0; G.cam.h = z1 - z0;
  },

  /* toạ độ thế giới -> điểm ảnh trên lớp phủ 2D */
  _v: null,
  toScreen(x, h, z) {
    if (!R3._v) R3._v = new THREE.Vector3();
    const v = R3._v.set(x, h, z).project(R3.cam);
    return { x: (v.x + 1) / 2 * G.cv.width, y: (1 - v.y) / 2 * G.cv.height, vis: v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05 };
  },

  render(dt) {
    if (!R3.ok || !R3.built) return;
    const t = performance.now() / 1000;
    const night = (G.shift && G.shift.light === 'night');
    R3.ambience();
    R3.updateCamera(dt);
    R3.syncLights();
    R3.syncVehicles(t, night);
    R3.syncPeds(t);
    R3.syncPlayer(t, night);
    R3.syncSmoke();
    R3.syncRail(t);
    R3.renderer.render(R3.scene, R3.cam);
  }
};
