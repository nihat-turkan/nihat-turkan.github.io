// Takımada · parça motoru
// Tarif (veri) → three.js nesnesi. Görünümden bağımsız: tarif yalnız RENK ROLÜ söyler (paper, ink, hot, warm, cool, pink, green, wood, mid);
// rolün gerçek renge dönüşmesi ve ekranda nasıl basılacağı (düz boya, desen atlası, 1-bit…) görünüm katmanının işi.
//
// createParts(THREE, renderer) → { build(recipe, colors), SHAPES, PATTERNS, MOTIONS }
// Not: file:// üzerinde JSON dosyası okunamadığı için tarifler .js dosyalarında JSON uyumlu nesneler olarak durur.

function createParts(THREE, renderer) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ANISO = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
  const S = 1024, SEG = 64;
  const cache = new Map();

  // ================= Desenler (elle boyanmış) =================
  function wobbly(x, x0, y0, x1, y1, amp = S * 0.004, cont = false) { // cont: yolu kesmeden devam et (dolgu için)
    const n = 24, L = Math.hypot(x1 - x0, y1 - y0) || 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, j = Math.sin(t * 17 + x0 * 0.01 + y0 * 0.013) * amp + (rnd() - 0.5) * amp * 0.6;
      i || cont ? x.lineTo(px - (y1 - y0) / L * j, py + (x1 - x0) / L * j) : x.moveTo(px, py);
    }
  }
  const PATTERNS = {
    stripe: (x, [bg, fg]) => { for (let i = 0; i < 8; i += 2) { x.beginPath(); wobbly(x, 0, i * S / 8, S, i * S / 8); wobbly(x, S, (i + 1) * S / 8, 0, (i + 1) * S / 8, S * 0.004, true); x.fillStyle = fg; x.fill(); } },
    diag: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S / 9; x.lineCap = 'butt'; for (let i = -S; i < 2 * S; i += S / 4) { x.beginPath(); wobbly(x, i, -10, i + S * 0.6, S + 10, S * 0.006); x.stroke(); } },
    harl: (x, [bg, fg, f2 = fg, f3 = fg]) => {
      const w = S / 4, h = S / 4, cs = [fg, bg, f2, f3];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
        x.fillStyle = cs[(r * 3 + c) % 4]; x.beginPath();
        const up = (c + r) % 2 === 0, x0 = c * w / 2 - w / 2, j = () => (rnd() - 0.5) * S * 0.006;
        if (up) { x.moveTo(x0 + j(), (r + 1) * h + j()); x.lineTo(x0 + w / 2 + j(), r * h + j()); x.lineTo(x0 + w + j(), (r + 1) * h + j()); }
        else { x.moveTo(x0 + j(), r * h + j()); x.lineTo(x0 + w + j(), r * h + j()); x.lineTo(x0 + w / 2 + j(), (r + 1) * h + j()); }
        x.fill();
      }
    },
    fur: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineCap = 'round'; x.lineWidth = S * 0.007; for (let i = 0; i < 260; i++) { const px = rnd() * S, py = rnd() * S, L = S * (0.035 + rnd() * 0.03), b = (rnd() - 0.5) * S * 0.02; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + b, py + L * 0.5, px + b * 0.4, py + L); x.stroke(); } },
    feathers: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.008; x.lineCap = 'round'; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const cx = (c + (r % 2) * 0.5) * S / 8, cy = r * S / 8; x.beginPath(); x.arc(cx, cy, S / 16, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); } },
    dots: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse((i + 0.5 + (j % 2) * 0.5) * S / 4, (j + 0.5) * S / 4, S / 22, S / 22, 0, 0, 7); x.fill(); } },
    checker: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * S / 8 + (rnd() - 0.5) * 4, j * S / 8 + (rnd() - 0.5) * 4, S / 8, S / 8); },
    zig: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S / 14; x.lineJoin = 'miter'; for (let r = 0; r < 3; r++) { x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * S / 8, S * (0.2 + r * 0.3) + (i % 2 ? -S / 14 : S / 14)); x.stroke(); } },
    waves: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.03; x.lineCap = 'round'; for (let r = 0; r < 5; r++) { x.beginPath(); for (let i = 0; i <= 64; i++) x.lineTo(i * S / 64, (r + 0.5) * S / 5 + Math.sin(i / 64 * Math.PI * 8) * S * 0.025); x.stroke(); } },
    band: (x, [bg, fg, f2 = fg, f3 = fg]) => { x.fillStyle = fg; x.fillRect(0, S * 0.8, S, S * 0.2); x.fillStyle = f2; x.fillRect(0, S * 0.72, S, S * 0.05); x.fillStyle = f3; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * S / 8, S * 0.8); x.lineTo((i + 0.5) * S / 8, S * 0.88); x.lineTo((i + 1) * S / 8, S * 0.8); x.fill(); } },
    blocks: (x, [bg, fg, f2 = fg, f3 = fg]) => { x.fillStyle = fg; x.fillRect(S * 0.36, 0, S * 0.28, S * 0.78); x.fillStyle = f2; x.fillRect(S * 0.36, S * 0.62, S * 0.28, S * 0.3); x.fillStyle = f3; x.fillRect(S * 0.66, S * 0.62, S * 0.2, S * 0.3); x.fillRect(S * 0.12, S * 0.62, S * 0.16, S * 0.3); x.fillStyle = fg; x.fillRect(0, S * 0.92, S, S * 0.08); },
    // önden okunan "kıyafet" desenleri: dokunun ortası (u = 0.5) karakterin önüne gelir
    apron: (x, [bg, fg, f2 = fg]) => { x.fillStyle = fg; x.beginPath(); x.moveTo(S * 0.38, S * 0.3); x.lineTo(S * 0.62, S * 0.3); x.lineTo(S * 0.66, S * 0.95); x.lineTo(S * 0.34, S * 0.95); x.fill(); x.fillStyle = f2; x.fillRect(S * 0.44, S * 0.55, S * 0.12, S * 0.1); x.fillRect(0, S * 0.28, S, S * 0.03); },
    buttons: (x, [bg, fg, f2 = fg]) => { x.fillStyle = fg; x.fillRect(S * 0.495, 0, S * 0.01, S); x.fillStyle = f2; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(S * 0.53, S * (0.2 + i * 0.18), S * 0.012, 0, 7); x.fill(); } x.fillRect(0, S * 0.94, S, S * 0.06); },
    sailor: (x, [bg, fg, f2 = fg]) => { x.fillStyle = fg; for (let i = 0; i < 6; i++) x.fillRect(0, S * (0.42 + i * 0.1), S, S * 0.04); x.fillStyle = f2; x.beginPath(); x.moveTo(S * 0.4, 0); x.lineTo(S * 0.5, S * 0.22); x.lineTo(S * 0.6, 0); x.fill(); },
    // dönel gövdede dokunun alt 1/6'sı taban diskine düşer → etek zikzakı onun hemen üstüne
    ghost: (x, [bg, fg]) => { x.fillStyle = fg; x.beginPath(); x.moveTo(0, S * 0.84); for (let i = 0; i <= 12; i++) x.lineTo(i * S / 12, S * (i % 2 ? 0.7 : 0.78)); x.lineTo(S, S * 0.84); x.fill(); },
    spiral: (x, [bg, fg, f2 = fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.014; x.lineCap = 'round'; x.beginPath(); for (let a = 0; a < 15; a += 0.05) x.lineTo(S / 2 + Math.cos(a) * a * S * 0.02, S * 0.42 + Math.sin(a) * a * S * 0.02); x.stroke(); x.fillStyle = f2; x.fillRect(S * 0.4, S * 0.7, S * 0.2, S * 0.16); },
    bars: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i < 8; i += 2) { x.beginPath(); wobbly(x, i * S / 8, 0, i * S / 8, S); wobbly(x, (i + 1) * S / 8, S, (i + 1) * S / 8, 0, S * 0.004, true); x.fill(); } },
    stars: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i < 18; i++) { const cx = rnd() * S, cy = rnd() * S * 0.85, r = S * (0.012 + rnd() * 0.012); x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); } },
    chevron: (x, [bg, fg, f2 = fg]) => { x.fillStyle = fg; for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) { const y0 = S * (0.45 + r * 0.17), x0 = i * S / 8; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + S / 16, y0 + S * 0.1); x.lineTo(x0 + S / 8, y0); x.lineTo(x0 + S / 8, y0 + S * 0.05); x.lineTo(x0 + S / 16, y0 + S * 0.15); x.lineTo(x0, y0 + S * 0.05); x.fill(); } x.fillStyle = f2; x.fillRect(0, S * 0.36, S, S * 0.05); },
    catpatch: (x, [bg, fg, f2 = fg]) => { // gövdenin önüne çizilmiş kedi (Girard'ın resimli gövdeleri gibi)
      x.fillStyle = f2; x.fillRect(S * 0.4, S * 0.38, S * 0.2, S * 0.36);
      x.beginPath(); x.moveTo(S * 0.4, S * 0.38); x.lineTo(S * 0.43, S * 0.28); x.lineTo(S * 0.47, S * 0.38); x.moveTo(S * 0.53, S * 0.38); x.lineTo(S * 0.57, S * 0.28); x.lineTo(S * 0.6, S * 0.38); x.fill();
      x.strokeStyle = fg; x.lineWidth = S * 0.004; for (let k = -1; k <= 1; k += 2) for (let j = 0; j < 2; j++) { x.beginPath(); x.moveTo(S * 0.5, S * (0.47 + j * 0.02)); x.lineTo(S * (0.5 + k * 0.12), S * (0.45 + j * 0.04)); x.stroke(); }
      x.fillStyle = fg; [0.46, 0.54].forEach((u) => { x.beginPath(); x.arc(S * u, S * 0.44, S * 0.008, 0, 7); x.fill(); });
      for (let i = 0; i < 40; i++) x.fillRect(S * (0.41 + rnd() * 0.18), S * (0.52 + rnd() * 0.2), S * 0.004, S * 0.012);
      x.fillRect(0, S * 0.9, S, S * 0.1);
    },
    yarn: (x, [bg, fg, f2 = fg]) => { // koyu gövde, önde açık pano + yumak
      x.fillStyle = f2; x.fillRect(S * 0.36, S * 0.3, S * 0.28, S * 0.3);
      x.strokeStyle = fg; x.lineWidth = S * 0.006; x.beginPath(); x.arc(S * 0.5, S * 0.45, S * 0.07, 0, 7); x.stroke();
      for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(S * 0.5, S * 0.45, S * 0.07, S * 0.025, k * 0.8, 0, 7); x.stroke(); }
      x.strokeStyle = f2; x.lineWidth = S * 0.008; x.beginPath(); x.moveTo(S * 0.5, S * 0.62); x.bezierCurveTo(S * 0.45, S * 0.75, S * 0.6, S * 0.82, S * 0.52, S * 0.95); x.stroke();
      x.fillStyle = f2; for (let i = 0; i < 60; i++) x.fillRect(rnd() * S, rnd() * S * 0.28, S * 0.004, S * 0.014);
    },
    ribs: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.012; for (let i = 0; i < 12; i++) { x.beginPath(); wobbly(x, i * S / 12, 0, i * S / 12, S, S * 0.003); x.stroke(); } }
  };
  function patternCanvas(kind, cols) {
    const key = 'p' + kind + cols.join();
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d'); x.fillStyle = cols[0]; x.fillRect(0, 0, S, S); x.lineJoin = 'round';
    (PATTERNS[kind] || (() => {}))(x, cols);
    cache.set(key, cv); return cv;
  }
  function texFrom(cv, rep = [1, 1]) {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = ANISO; return t;
  }

  // ================= Biçimler =================
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), SEG).rotateY(Math.PI); // desenin ortası öne
  function latheUV(pts) {
    return (y) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [r0, y0] = pts[i], [r1, y1] = pts[i + 1];
        if (y >= y0 && y <= y1 && y1 > y0) { const t = (y - y0) / (y1 - y0), r = r0 + (r1 - r0) * t; return { v: (i + t) / (pts.length - 1), dv: 1 / (pts.length - 1) / (y1 - y0), circ: 2 * Math.PI * r, r }; }
      }
      return { v: 0.5, dv: 2, circ: 1, r: 0.15 };
    };
  }
  const BODY_PTS = {
    bell:      [[0, 0], [0.3, 0], [0.31, 0.12], [0.29, 0.42], [0.21, 0.62], [0.09, 0.74], [0, 0.75]],
    column:    [[0, 0], [0.2, 0], [0.24, 0.95], [0.1, 1.0], [0, 1.0]],
    hourglass: [[0, 0], [0.28, 0], [0.27, 0.12], [0.19, 0.38], [0.28, 0.66], [0.15, 0.76], [0, 0.77]],
    bottle:    [[0, 0], [0.25, 0], [0.26, 0.55], [0.2, 0.7], [0.1, 0.86], [0.05, 0.95], [0, 0.96]],
    cone:      [[0, 0], [0.3, 0], [0.26, 0.2], [0.13, 0.78], [0, 0.8]],
    barrel:    [[0, 0], [0.22, 0], [0.28, 0.2], [0.29, 0.4], [0.26, 0.6], [0.16, 0.68], [0, 0.7]],
    pear:      [[0, 0], [0.3, 0], [0.33, 0.14], [0.28, 0.38], [0.17, 0.58], [0.09, 0.66], [0, 0.67]],
    ghost:     [[0, 0], [0.31, 0], [0.29, 0.1], [0.26, 0.45], [0.2, 0.64], [0.09, 0.74], [0, 0.75]]
  };
  const BODIES = Object.fromEntries(Object.entries(BODY_PTS).map(([k, p]) => [k, { geo: () => lathe(p), h: p[p.length - 2][1], r: Math.max(...p.map((q) => q[0])), shoulder: p[p.length - 3][0], base: p[1][0] }]));
  BODIES.block = { geo: () => new THREE.BoxGeometry(0.5, 0.78, 0.38).translate(0, 0.39, 0), h: 0.78, r: 0.25, shoulder: 0.25, base: 0.25, box: true };

  const HEAD_PTS = {
    drop: [[0, 0], [0.12, 0.03], [0.17, 0.14], [0.13, 0.3], [0.05, 0.46], [0, 0.5]],
    cat:  [[0, 0], [0.14, 0.02], [0.18, 0.1], [0.18, 0.18], [0.16, 0.23], [0, 0.25]],
    owl:  [[0, 0], [0.17, 0.02], [0.23, 0.1], [0.22, 0.18], [0.15, 0.24], [0, 0.25]],
    acorn: [[0, 0], [0.1, 0.02], [0.16, 0.1], [0.17, 0.18], [0.12, 0.27], [0, 0.29]]
  };
  const HEADS = {};
  Object.entries(HEAD_PTS).forEach(([k, p]) => { HEADS[k] = { geo: () => lathe(p), uv: latheUV(p), fy: { drop: 0.16, cat: 0.13, owl: 0.12, acorn: 0.13 }[k], top: p[p.length - 1][1], r: Math.max(...p.map((q) => q[0])) }; });
  HEADS.ball = { geo: () => new THREE.SphereGeometry(0.17, SEG, 40).rotateY(-Math.PI / 2).translate(0, 0.16, 0), fy: 0.15, top: 0.33, r: 0.17,
                 uv: (y) => { const dy = Math.max(-0.165, Math.min(0.165, y - 0.16)), r = Math.sqrt(0.17 * 0.17 - dy * dy); return { v: 1 - Math.acos(dy / 0.17) / Math.PI, dv: 1 / (Math.PI * r), circ: 2 * Math.PI * r, r }; } };
  HEADS.flat = { geo: () => new THREE.CylinderGeometry(0.24, 0.15, 0.26, 4).rotateY(Math.PI / 4 + Math.PI).translate(0, 0.13, 0), fy: 0.12, top: 0.26, r: 0.22,
                 uv: (y) => { const r = 0.15 + 0.09 * (y / 0.26); return { v: y / 0.26, dv: 1 / 0.26, circ: 4 * Math.SQRT2 * r, r }; } };
  HEADS.spike = { geo: () => new THREE.ConeGeometry(0.15, 0.52, SEG).rotateY(Math.PI).translate(0, 0.26, 0), fy: 0.1, top: 0.52, r: 0.15,
                  uv: (y) => { const r = 0.15 * (1 - y / 0.52); return { v: y / 0.52, dv: 1 / 0.52, circ: 2 * Math.PI * r, r }; } };
  // disk: yüzü öne bakan tekerlek (saat kadranı, güneş). Ön kapağa yüz boyanır.
  HEADS.disk = { geo: () => new THREE.CylinderGeometry(0.2, 0.2, 0.1, SEG).rotateX(Math.PI / 2).translate(0, 0.2, 0), fy: 0.2, top: 0.4, r: 0.2, cap: true,
                 uv: () => ({ v: 0.5, dv: 1 / 0.4, circ: 0.4, r: 0.2 }) };
  HEADS.box = { geo: () => new THREE.BoxGeometry(0.3, 0.3, 0.28).translate(0, 0.15, 0), fy: 0.15, top: 0.3, r: 0.15, box: true,
                uv: () => ({ v: 0.5, dv: 1 / 0.3, circ: 0.3, r: 0.15 }) };

  // ================= Yüz =================
  const FACE_DEFAULT = { eyes: 'ring', brows: true, mouth: 'smile', cheeks: false, nose: false, mask: false, mustache: false, clock: false };
  function headTexture(head, paint, face, C) {
    const col = (k) => C[k] || k, Hd = HEADS[head], f = Object.assign({}, FACE_DEFAULT, face);
    const W = Hd.cap || Hd.box ? 512 : 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    if (paint.pattern) { const tile = patternCanvas(paint.pattern, paint.colors.map(col)), [rx, ry] = paint.repeat || [1, 1]; for (let i = 0; i < rx; i++) for (let j = 0; j < ry; j++) x.drawImage(tile, i * W / rx, j * H / ry, W / rx, H / ry); }
    else { x.fillStyle = col(paint.color || 'paper'); x.fillRect(0, 0, W, H); }
    const fy = Hd.fy + (f.y || 0), u = Hd.uv(fy), sx = W / u.circ, sy = H * u.dv;
    if (f.mask) { x.fillStyle = col(f.mask === true ? 'ink' : f.mask); const bh = 0.085 * sy; x.fillRect(0, (1 - u.v) * H - bh / 2, W, bh); }
    x.save(); x.translate(W / 2, (1 - u.v) * H); x.scale(sx, -sy);
    const ink = col('ink'), white = col('paper'), hot = col('hot');
    const dark = ['ink', 'hot', 'cool'].includes(paint.color) || !!f.mask, line = dark ? white : ink;
    const ell = (cx, cy, rx, ry, fill) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fillStyle = fill; x.fill(); };
    const stroke = (w) => { x.lineWidth = w; x.strokeStyle = line; x.lineCap = 'round'; };
    if (f.clock) { // saat kadranı: 12 çentik + iki ibre
      stroke(0.008); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a) * 0.15, Math.sin(a) * 0.15); x.lineTo(Math.cos(a) * (k % 3 ? 0.165 : 0.175), Math.sin(a) * (k % 3 ? 0.165 : 0.175)); x.stroke(); }
      x.strokeStyle = hot; x.lineWidth = 0.012; x.beginPath(); x.moveTo(0, -0.02); x.lineTo(0.06, 0.1); x.stroke(); x.strokeStyle = line; x.beginPath(); x.moveTo(0, -0.02); x.lineTo(-0.1, -0.02); x.stroke();
    }
    const gap = f.gap || 0.055, er = f.eyes === 'wide' ? 1.35 : 1;
    [-1, 1].forEach((s) => {
      const ex = s * gap, kind = f.eyes === 'wink' && s > 0 ? 'closed' : f.eyes;
      if (kind === 'ring' || kind === 'wide' || kind === 'wink') {
        ell(ex, 0, 0.038 * er, 0.034 * er, line); ell(ex, 0, 0.031 * er, 0.027 * er, white);
        ell(ex - s * 0.006, 0.004, 0.016 * er, 0.017 * er, ink); ell(ex - s * 0.012, 0.012, 0.005, 0.005, white);
      } else if (kind === 'dot') ell(ex, 0, 0.02, 0.016, line);
      else if (kind === 'sleepy' || kind === 'closed') {
        stroke(0.009); x.beginPath(); x.arc(ex, 0.012, 0.03, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
        if (kind === 'sleepy') for (let k = -1; k <= 1; k++) { const a = Math.PI * (1.5 + k * 0.22); x.beginPath(); x.moveTo(ex + Math.cos(a) * 0.03, 0.012 + Math.sin(a) * 0.03); x.lineTo(ex + Math.cos(a) * 0.045, 0.012 + Math.sin(a) * 0.045); x.stroke(); }
      }
      if (f.brows && kind !== 'dot' && kind !== 'sleepy') { stroke(0.009); x.beginPath(); x.arc(ex, 0.012, 0.05 * er, Math.PI * (s > 0 ? 0.32 : 0.48), Math.PI * (s > 0 ? 0.52 : 0.68)); x.stroke(); }
      if (f.cheeks) ell(s * (gap + 0.03), -0.05, 0.022, 0.016, col(f.cheeks === true ? 'pink' : f.cheeks));
    });
    if (f.glasses) { stroke(0.008); [-1, 1].forEach((s) => { x.beginPath(); x.arc(s * gap, 0, 0.045 * er, 0, 7); x.stroke(); }); x.beginPath(); x.moveTo(-gap + 0.045, 0.005); x.lineTo(gap - 0.045, 0.005); x.stroke(); }
    if (f.nose) { x.beginPath(); x.moveTo(0, -0.012); x.lineTo(-0.012, -0.04); x.lineTo(0.012, -0.04); x.closePath(); x.fillStyle = line; x.fill(); }
    if (f.mouth === 'smile') { x.beginPath(); x.moveTo(-0.032, -0.06); x.quadraticCurveTo(0, -0.1, 0.032, -0.06); x.quadraticCurveTo(0, -0.072, -0.032, -0.06); x.fillStyle = hot; x.fill(); }
    else if (f.mouth === 'o') { ell(0, -0.07, 0.018, 0.022, ink); ell(0, -0.07, 0.009, 0.012, hot); }
    else if (f.mouth === 'line') { stroke(0.008); x.beginPath(); x.moveTo(-0.02, -0.065); x.lineTo(0.02, -0.065); x.stroke(); }
    else if (f.mouth === 'beak') { x.beginPath(); x.moveTo(-0.025, -0.03); x.lineTo(0.025, -0.03); x.lineTo(0, -0.08); x.closePath(); x.fillStyle = col('warm'); x.fill(); }
    if (f.mustache) { x.fillStyle = line; [-1, 1].forEach((s) => { x.beginPath(); x.ellipse(s * 0.025, -0.05, 0.03, 0.012, s * 0.25, 0, 7); x.fill(); }); }
    x.restore();
    return texFrom(cv);
  }

  // ================= Kurulum =================
  const LAMBERT = (() => { const n = 64, d = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { const v = Math.max(0, 2 * (i + 0.5) / n - 1) * 255; d.set([v, v, v, 255], i * 4); } const t = new THREE.DataTexture(d, n, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
  const MOTIONS = {
    calm:    { wob: 0.03, f: 1.4, hop: 0, every: 0, lag: 0.15 },
    bouncy:  { wob: 0.045, f: 2.2, hop: 0.14, every: 2.4, lag: 0.25 },
    sleepy:  { wob: 0.02, f: 0.7, hop: 0, every: 0, lag: 0.1, tilt: 0.12 },
    jittery: { wob: 0.05, f: 4.5, hop: 0.06, every: 1.1, lag: 0.3 },
    proud:   { wob: 0.02, f: 1.0, hop: 0.08, every: 4.0, lag: 0.12, lean: -0.08 },
    floaty:  { wob: 0.03, f: 1.2, hop: 0, every: 0, lag: 0.2, float: 0.06 }
  };

  function build(recipe, C) {
    seed = [...recipe.id].reduce((a, c) => a + c.charCodeAt(0), 7);
    const col = (k) => C[k] || k;
    const mat = (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: LAMBERT }, o));
    const matCache = {};
    const paintMat = (p = {}) => {
      if (!p.pattern) { const k = 'c' + (p.color || 'paper'); return matCache[k] || (matCache[k] = mat({ color: col(p.color || 'paper') })); }
      return mat({ map: texFrom(patternCanvas(p.pattern, p.colors.map(col)), p.repeat || [1, 1]) });
    };
    const m = (geo, material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
    const P = recipe.parts;
    const B = BODIES[P.body.shape], Hd = HEADS[P.head.shape];
    const root = new THREE.Group(), wob = new THREE.Group(); root.add(wob);
    const inkM = mat({ color: col('ink') });

    // gövde + tornacı oyuğu
    wob.add(m(B.geo(), paintMat(P.body.paint)));
    if (!B.box) { const g = m(new THREE.TorusGeometry(B.base * 0.99 + 0.002, 0.006, 6, SEG), inkM, 0, 0.035, 0); g.rotation.x = Math.PI / 2; g.castShadow = false; wob.add(g); }
    const neckH = P.neck ? P.neck.height ?? 0.08 : 0;
    if (P.neck) wob.add(m(new THREE.CylinderGeometry(0.07, 0.09, neckH + 0.04, 32), paintMat(P.neck.paint || (P.head.paint.pattern ? { color: P.head.paint.colors[0] } : P.head.paint)), 0, B.h + neckH / 2, 0));
    // baş: yüz dokusu yalnız ön yüze (kutu / disk) ya da bütün kafaya (dönel)
    const head = new THREE.Group(); head.position.y = B.h + neckH - (P.neck ? 0 : 0.04); wob.add(head);
    const faceTex = headTexture(P.head.shape, P.head.paint, P.face || {}, C);
    const faceMat = mat({ map: faceTex }), baseMat = paintMat(P.head.paint.pattern ? { color: P.head.paint.colors[0] } : P.head.paint);
    let headMats = faceMat;
    if (Hd.box) headMats = [baseMat, baseMat, baseMat, baseMat, faceMat, baseMat];
    if (Hd.cap) headMats = [baseMat, faceMat, baseMat];
    head.add(m(Hd.geo(), headMats));
    if (Hd.cap) { const rim = m(new THREE.TorusGeometry(0.2, 0.012, 8, SEG), inkM, 0, 0.2, 0.05); head.add(rim); }

    // kulaklar
    const ears = P.ears && P.ears.shape;
    if (ears) {
      const ep = paintMat(P.ears.paint || (P.head.paint.pattern ? { color: P.head.paint.colors[0] } : P.head.paint));
      [-1, 1].forEach((s) => {
        let e;
        if (ears === 'cat') { e = m(new THREE.ConeGeometry(0.075, 0.26, 4), ep, s * 0.11, Hd.top + 0.08, 0); e.rotation.z = -s * 0.22; }
        else if (ears === 'tufts') { e = m(new THREE.ConeGeometry(0.05, 0.16, 4), ep, s * 0.15, Hd.top + 0.03, 0); e.rotation.z = -s * 0.55; }
        else if (ears === 'rabbit') { e = m(new THREE.SphereGeometry(0.05, 16, 12), ep, s * 0.07, Hd.top + 0.17, 0); e.scale.set(0.8, 3.2, 0.5); e.rotation.z = -s * 0.15; }
        else if (ears === 'round') { e = m(new THREE.SphereGeometry(0.06, 16, 12), ep, s * 0.15, Hd.top - 0.01, 0); e.scale.set(1, 1, 0.5); }
        head.add(e);
      });
    }

    // kollar (çubuk kollar, Girard bebeklerinin boyalı kollarının 3B karşılığı)
    const armY = B.h * 0.72, armX = (B.box ? 0.25 : B.shoulder + 0.04);
    const arms = [];
    if (P.arms && P.arms.type !== 'none') {
      const am = paintMat(P.arms.paint || (P.body.paint.pattern ? { color: P.body.paint.colors[0] } : P.body.paint));
      [-1, 1].forEach((s) => {
        const pivot = new THREE.Group(); pivot.position.set(s * armX, armY, 0); wob.add(pivot);
        if (P.arms.type === 'wings') { const w = m(new THREE.SphereGeometry(0.12, 16, 12), am, s * 0.02, -0.12, -0.02); w.scale.set(0.3, 1.1, 0.75); pivot.add(w); pivot.rotation.z = s * 0.15; }
        else { const a = m(new THREE.CylinderGeometry(0.028, 0.032, 0.26, 12), am, 0, -0.12, 0); pivot.add(a); pivot.add(m(new THREE.SphereGeometry(0.035, 12, 8), am, 0, -0.25, 0)); pivot.rotation.z = s * (P.arms.pose === 'up' && s > 0 ? -2.4 : 0.25); pivot.rotation.x = P.arms.pose === 'front' ? -0.6 : 0; }
        arms.push(pivot);
      });
    }

    // elde tutulan nesne: sağ kolun ucuna (kol yoksa gövdenin önüne)
    const held = new THREE.Group();
    if (arms[1]) { held.position.set(0, -0.28, 0.02); held.rotation.z = -arms[1].rotation.z; arms[1].add(held); } // nesne dik kalsın (kol kalksa da) else { held.position.set(armX * 0.6, armY - 0.2, 0.2); wob.add(held); }
    const H = P.held && P.held.type, hp = (k, d) => paintMat((P.held && P.held.paint) || { color: k || d });
    if (H === 'lantern') { held.add(m(new THREE.BoxGeometry(0.1, 0.13, 0.1), mat({ color: col('paper'), emissive: new THREE.Color(col('warm')), emissiveIntensity: 0.4 }), 0, -0.1, 0)); held.add(m(new THREE.ConeGeometry(0.08, 0.06, 4).rotateY(Math.PI / 4), inkM, 0, -0.01, 0)); held.add(m(new THREE.TorusGeometry(0.035, 0.006, 6, 16), inkM, 0, 0.02, 0)); }
    if (H === 'bell') { held.add(m(new THREE.ConeGeometry(0.07, 0.1, 24, 1, true), hp(null, 'warm'), 0, -0.08, 0)); held.add(m(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), inkM, 0, 0, 0)); }
    if (H === 'tuba') { const g = new THREE.Group(); g.add(m(new THREE.TorusGeometry(0.09, 0.028, 10, 24), hp(null, 'warm'))); const horn = m(new THREE.ConeGeometry(0.09, 0.16, 24, 1, true), hp(null, 'warm'), 0.08, 0.14, 0); horn.rotation.z = Math.PI; g.add(horn); g.position.set(-0.12, 0.04, 0.12); held.add(g); }
    if (H === 'drum') { const d = new THREE.Group(); d.add(m(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 32), paintMat({ pattern: 'zig', colors: ['paper', 'hot'] }))); d.add(m(new THREE.CylinderGeometry(0.152, 0.152, 0.012, 32), inkM, 0, 0.07, 0)); d.position.set(-0.2, 0.0, 0.2); held.add(d); }
    if (H === 'uke') { const u = new THREE.Group(); const b = m(new THREE.SphereGeometry(0.09, 20, 14), hp(null, 'wood')); b.scale.set(0.9, 1.15, 0.35); u.add(b); u.add(m(new THREE.BoxGeometry(0.03, 0.2, 0.02), inkM, 0, 0.17, 0)); u.rotation.z = -0.8; u.position.set(-0.08, 0.05, 0.1); held.add(u); }
    if (H === 'baton') { const b = m(new THREE.CylinderGeometry(0.006, 0.01, 0.3, 6), mat({ color: col('paper') }), 0, -0.05, 0.1); b.rotation.x = 1.2; held.add(b); }
    if (H === 'can') { held.add(m(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 20), hp(null, 'green'), 0, -0.08, 0)); const sp = m(new THREE.CylinderGeometry(0.01, 0.016, 0.16, 8), hp(null, 'green'), 0.09, -0.05, 0); sp.rotation.z = -0.9; held.add(sp); held.add(m(new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), inkM, 0, -0.02, 0)); }
    if (H === 'key') { const k = m(new THREE.TorusGeometry(0.035, 0.01, 8, 20), hp(null, 'warm'), 0, -0.05, 0); held.add(k); held.add(m(new THREE.BoxGeometry(0.015, 0.12, 0.015), hp(null, 'warm'), 0, -0.14, 0)); }
    if (H === 'umbrella') { const u = new THREE.Group(); u.add(m(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6), inkM, 0, 0.3, 0)); u.add(m(new THREE.ConeGeometry(0.32, 0.14, 8, 1, true), paintMat((P.held && P.held.paint) || { pattern: 'stripe', colors: ['paper', 'cool'] }), 0, 0.62, 0)); u.position.set(0, -0.05, 0); held.add(u); }
    if (H === 'bucket') { held.add(m(new THREE.CylinderGeometry(0.07, 0.055, 0.1, 20), hp(null, 'hot'), 0, -0.1, 0)); held.add(m(new THREE.TorusGeometry(0.06, 0.006, 6, 16, Math.PI), inkM, 0, -0.05, 0)); }
    if (H === 'net') { held.add(m(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 6), inkM, 0, 0.05, 0)); const ring = m(new THREE.TorusGeometry(0.08, 0.008, 6, 20), inkM, 0, 0.27, 0); held.add(ring); }
    if (H === 'glass') { held.add(m(new THREE.TorusGeometry(0.06, 0.012, 8, 24), inkM, 0, -0.08, 0.04)); const lens = m(new THREE.CircleGeometry(0.055, 24), mat({ color: col('paper'), transparent: true, opacity: 0.6 }), 0, -0.08, 0.04); held.add(lens); held.add(m(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), hp(null, 'wood'), 0, -0.02, 0.04)); }
    if (H === 'letter') { held.add(m(new THREE.BoxGeometry(0.16, 0.1, 0.01), mat({ color: col('paper') }), 0, -0.08, 0.06)); const flap = m(new THREE.ConeGeometry(0.08, 0.05, 3), hp(null, 'hot'), 0, -0.06, 0.068); flap.rotation.z = Math.PI; flap.scale.z = 0.1; held.add(flap); }
    if (H === 'bread') { const b = m(new THREE.CapsuleGeometry(0.05, 0.14, 6, 16), hp(null, 'wood'), 0, -0.08, 0.06); b.rotation.z = Math.PI / 2 - 0.3; held.add(b); }
    if (H === 'flower') { held.add(m(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), hp(null, 'green'), 0, 0.05, 0.04)); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; held.add(m(new THREE.SphereGeometry(0.028, 10, 8), hp(null, 'pink'), Math.cos(a) * 0.035, 0.19, 0.04 + Math.sin(a) * 0.035)); } held.add(m(new THREE.SphereGeometry(0.022, 10, 8), mat({ color: col('warm') }), 0, 0.19, 0.04)); }
    if (H === 'book') { held.add(m(new THREE.BoxGeometry(0.12, 0.16, 0.03), hp(null, 'cool'), 0, -0.08, 0.02)); }

    // şapka
    const hat = new THREE.Group(); hat.position.y = Hd.top; head.add(hat);
    const T = P.hat && P.hat.type, tp = paintMat((P.hat && P.hat.paint) || { color: 'ink' });
    if (T === 'cone') { hat.add(m(new THREE.ConeGeometry(0.11, 0.28, 32), tp, 0, 0.12, 0)); hat.add(m(new THREE.SphereGeometry(0.035, 12, 8), paintMat({ color: 'paper' }), 0, 0.27, 0)); }
    if (T === 'top') { hat.add(m(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 32), tp, 0, 0.0, 0)); hat.add(m(new THREE.CylinderGeometry(0.11, 0.12, 0.2, 32), tp, 0, 0.1, 0)); hat.add(m(new THREE.CylinderGeometry(0.121, 0.121, 0.035, 32), paintMat({ color: 'hot' }), 0, 0.035, 0)); }
    if (T === 'beret') { const b = m(new THREE.SphereGeometry(0.17, 24, 10), tp, 0.02, 0.0, 0); b.scale.set(1, 0.32, 1); b.rotation.z = -0.25; hat.add(b); hat.add(m(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 4), tp, 0.04, 0.06, 0)); }
    if (T === 'cap') { const c = m(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tp, 0, -0.02, 0); hat.add(c); hat.add(m(new THREE.BoxGeometry(0.16, 0.015, 0.1), tp, 0, -0.02, 0.15)); }
    if (T === 'sun') { hat.add(m(new THREE.CylinderGeometry(0.27, 0.27, 0.012, 40), tp, 0, -0.03, 0)); const d = m(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tp, 0, -0.03, 0); hat.add(d); hat.add(m(new THREE.CylinderGeometry(0.121, 0.121, 0.03, 32), paintMat({ color: 'hot' }), 0, -0.01, 0)); }
    if (T === 'crown') { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; hat.add(m(new THREE.ConeGeometry(0.03, 0.09, 4), tp, Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09)); } hat.add(m(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24, 1, true), tp, 0, 0.0, 0)); }
    if (T === 'leaf') { const l = m(new THREE.SphereGeometry(0.1, 16, 10), paintMat((P.hat && P.hat.paint) || { color: 'green' }), 0.03, 0.08, 0); l.scale.set(0.5, 1.4, 0.18); l.rotation.z = -0.4; hat.add(l); hat.add(m(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4), inkM, 0, 0.01, 0)); }
    if (T === 'sailor') { hat.add(m(new THREE.CylinderGeometry(0.15, 0.13, 0.07, 32), paintMat({ color: 'paper' }), 0, 0.0, 0)); hat.add(m(new THREE.CylinderGeometry(0.151, 0.151, 0.02, 32), paintMat({ color: 'cool' }), 0, -0.02, 0)); }
    if (T === 'chef') { hat.add(m(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 24), tp, 0, 0.04, 0)); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; hat.add(m(new THREE.SphereGeometry(0.07, 14, 10), tp, Math.cos(a) * 0.06, 0.14, Math.sin(a) * 0.06)); } hat.add(m(new THREE.SphereGeometry(0.07, 14, 10), tp, 0, 0.17, 0)); }
    if (T === 'mushroom') { const d = m(new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), paintMat((P.hat && P.hat.paint) || { pattern: 'dots', colors: ['hot', 'paper'], repeat: [3, 1] }), 0, -0.04, 0); d.scale.y = 0.65; hat.add(d); hat.add(m(new THREE.CylinderGeometry(0.3, 0.3, 0.01, 32), paintMat({ color: 'paper' }), 0, -0.04, 0)); }
    if (T === 'antenna') { [-1, 1].forEach((s) => { const a = m(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), inkM, s * 0.06, 0.07, 0); a.rotation.z = -s * 0.35; hat.add(a); hat.add(m(new THREE.SphereGeometry(0.03, 10, 8), tp, s * 0.09, 0.15, 0)); }); }
    if (T === 'pompom') { hat.add(m(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), tp, 0, 0.06, 0)); hat.add(m(new THREE.SphereGeometry(0.045, 12, 8), paintMat({ color: 'paper' }), 0, 0.14, 0)); }

    // ekler: atkı (vurgu rengi = "sen"), tüy, fiyonk, kuyruk, pelerin eteği
    const extra = new THREE.Group(); extra.position.y = Hd.top; head.add(extra);
    (P.extras || []).forEach((e) => {
      const t = e.type || e;
      if (t === 'scarf') { const s = m(new THREE.TorusGeometry(0.1, 0.035, 10, 32), paintMat(e.paint || { color: 'hot' }), 0, B.h + 0.02, 0); s.rotation.x = Math.PI / 2; wob.add(s); const tail = m(new THREE.BoxGeometry(0.06, 0.16, 0.025), paintMat(e.paint || { color: 'hot' }), 0.06, B.h - 0.08, 0.1); tail.rotation.z = 0.25; wob.add(tail); }
      if (t === 'feather') for (let k = 0; k < 9; k++) { const f = new THREE.Group(); const blade = m(new THREE.SphereGeometry(0.05, 12, 8), paintMat({ color: k % 2 ? 'warm' : 'wood' }), 0, 0.17, 0); blade.scale.set(0.45, 3.4, 0.15); f.add(blade); f.rotation.z = (k - 4) * 0.13; f.rotation.y = (k % 3) * 0.3; extra.add(f); }
      if (t === 'bow') { [-1, 1].forEach((s) => { const b = m(new THREE.TorusGeometry(0.07, 0.014, 10, 32), paintMat(e.paint || { color: 'warm' }), s * 0.08, B.h + 0.02, 0.1); b.scale.set(1.3, 0.7, 1); wob.add(b); }); }
      if (t === 'tail') { const tl = m(new THREE.TorusGeometry(0.22, 0.022, 10, 40, Math.PI * 1.2), paintMat(e.paint || { color: 'hot' }), 0, B.h * 0.35, -0.22); tl.rotation.y = Math.PI / 2; wob.add(tl); }
      if (t === 'beak') { const b = m(new THREE.ConeGeometry(0.035, 0.09, 4), paintMat({ color: 'warm' }), 0, Hd.fy - 0.03 - Hd.top, Hd.r + 0.03); b.rotation.x = Math.PI / 2 + 0.3; extra.add(b); }
      if (t === 'collar') { const c = m(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 32, 1, true), paintMat(e.paint || { color: 'paper' }), 0, B.h - 0.01, 0); wob.add(c); }
    });

    root.scale.setScalar(recipe.scale || 1);
    const mo = MOTIONS[(recipe.motion && recipe.motion.personality) || 'calm'] || MOTIONS.calm;
    return { root, wob, head, hat, extra, arms, held, motion: mo, phase: rnd() * 6, height: (B.h + neckH + Hd.top + 0.15) * (recipe.scale || 1) };
  }

  // Hareket kişiliği: aynı ilkeler, farklı tempo (wobble · hop · geriden gelen ekler)
  function animate(o, t) {
    const M = o.motion, w = Math.sin(t * M.f + o.phase);
    o.wob.rotation.z = w * M.wob; o.wob.rotation.x = (M.lean || 0) + Math.cos(t * M.f * 0.8 + o.phase) * M.wob * 0.5;
    let y = M.float ? Math.sin(t * 1.4 + o.phase) * M.float + M.float : 0, sq = 1;
    if (M.every) { const u = ((t + o.phase) % M.every) / 0.45; if (u < 1) { y += Math.sin(u * Math.PI) * M.hop; sq = u < 0.12 ? 0.92 : u > 0.88 ? 0.94 : 1.05; } }
    o.wob.position.y = y; o.wob.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    o.head.rotation.z = (M.tilt || 0) + Math.sin(t * M.f - 0.6 + o.phase) * M.wob * 0.8; // baş gövdenin gerisinden gelir
    o.hat.rotation.z = -w * M.lag; o.extra.rotation.z = -w * M.lag * 1.2;
    o.arms.forEach((a, i) => { a.rotation.x = (a.userData.rx ?? (a.userData.rx = a.rotation.x)) + Math.sin(t * M.f * 1.3 + i * 2 + o.phase) * M.wob * 2; });
  }

  return { build, animate, BODIES, HEADS, PATTERNS, MOTIONS, LAMBERT, patternCanvas, texFrom, rnd, setSeed: (v) => { seed = v; } };
}

// Takımada · görünüm motoru
// Desen atlası gölgelemesi + geometri konturu. Assetler rol renkleriyle kurulur; bu modül onların ekranda nasıl basılacağını belirler.
// createLook(THREE, renderer) → { PALS, SYSTEMS, rolesOf, atlasCanvas, patchObject, apply(s), render(cv, scene, cam, bg, s, up), LAMBERT }
// Ayar nesnesi s: { pal, sys, lit, decor, outline, time, scale, on, dark, unify, oc, t: [5 eşik], nT }

function createLook(THREE, renderer) {
  // ================= Paletler =================
  const PALS = {
    a: { name: 'A · 1-BIT', sea: 'gray',
         list: [['paper', '#f2efe6', 'paper'], ['ink', '#151515', 'ink'], ['hot', '#ff6648', 'color'], ['gray', '#9a9a9a', 'gray']],
         roles: { warm: 'gray', cool: 'ink', pink: 'paper', green: 'gray', wood: 'gray', mid: 'gray', ground: 'paper' } },
    b: { name: 'B · PAPER + WOOD', sea: 'ink',
         list: [['paper', '#f3ecdc', 'paper'], ['ink', '#1c1a17', 'ink'], ['hot', '#ff6648', 'color'], ['wood', '#c4955c', 'color'], ['sand', '#dcc196', 'color']],
         roles: { warm: 'wood', cool: 'ink', pink: 'sand', green: 'wood', mid: 'wood', ground: 'paper' } },
    c: { name: 'C · MONTOUR', sea: 'cool',
         list: [['paper', '#f1e9d8', 'paper'], ['ink', '#1d1c1a', 'ink'], ['hot', '#e8462b', 'color'], ['warm', '#e2a23a', 'color'], ['cool', '#3f78b5', 'color'], ['pink', '#ea8ca6', 'color'], ['green', '#7fae68', 'color'], ['wood', '#c4955c', 'color'], ['gray', '#9b958a', 'gray']],
         roles: { mid: 'gray', ground: 'paper' } }
  };
  function rolesOf(P) {
    const C = {}; P.list.forEach(([k, hex]) => { C[k] = hex; });
    Object.entries(P.roles).forEach(([r, k]) => { C[r] = C[k]; });
    ['warm', 'cool', 'pink', 'green', 'wood', 'mid', 'ground'].forEach((r) => { if (!C[r]) C[r] = C.paper; });
    return C;
  }

  // ================= Desen sistemleri (3 yüzey türü × 4 yoğunluk) =================
  const m = (a, n) => ((a % n) + n) % n;
  const chev = (x, y, p, w) => m(x + Math.abs(m(y, p) - p / 2), p) < w;
  const dotR = (x, y, p, r, off) => { const ox = off && m(Math.floor(y / p), 2) ? p / 2 : 0; const dx = m(x + ox, p) - p / 2 + 0.5, dy = m(y, p) - p / 2 + 0.5; return dx * dx + dy * dy <= r * r; };
  const plus = (x, y, p, s) => { const cx = m(x, p), cy = m(y, p); return (cx === 0 && (cy <= s || cy >= p - s)) || (cy === 0 && (cx <= s || cx >= p - s)); };
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const SYSTEMS = {
    walaber: { name: 'WALABER',
      Z: [(x, y) => m(y, 8) === 0 && m(x, 2) === 0, (x, y) => m(y, 8) === 0, (x, y) => m(y, 4) === 0, (x, y) => m(y, 2) === 0],
      Y: [(x, y) => m(x, 8) === 0 && m(y, 8) === 0, (x, y) => m(x, 4) === 0 && m(y + (m(x, 8) ? 2 : 0), 4) === 0, (x, y) => m(x, 2) === 0 && m(y, 4) === 0, (x, y) => m(x + y, 2) === 0],
      B: [(x, y) => m(x, 16) === 0 || m(y, 16) === 0, (x, y) => m(x, 8) === 0 || m(y, 8) === 0, (x, y) => m(x, 4) === 0 || m(y, 4) === 0, (x, y) => m(x, 2) === 0 || m(y, 4) === 0] },
    engrave: { name: 'ENGRAVING',
      Z: [(x, y) => m(y, 8) === 0, (x, y) => m(y, 4) === 0, (x, y) => m(y, 4) === 0 || (m(y, 4) === 2 && m(x, 2) === 0), (x, y) => m(y, 2) === 0],
      Y: [(x, y) => m(x, 8) === 0, (x, y) => m(x, 4) === 0, (x, y) => m(x, 4) === 0 || (m(x, 4) === 2 && m(y, 2) === 0), (x, y) => m(x, 2) === 0],
      B: [(x, y) => m(x + y, 8) === 0, (x, y) => m(x + y, 4) === 0, (x, y) => m(x + y, 4) === 0 || m(x - y, 8) === 0, (x, y) => m(x + y, 4) === 0 || m(x - y, 4) === 0] },
    girard: { name: 'TEXTILE',
      Z: [(x, y) => chev(x, y, 16, 1), (x, y) => chev(x, y, 8, 1), (x, y) => chev(x, y, 8, 2), (x, y) => chev(x, y, 4, 2)],
      Y: [(x, y) => m(x, 8) === 0 && m(y + (m(x, 16) ? 4 : 0), 8) < 3, (x, y) => m(x, 4) === 0 && m(y + (m(x, 8) ? 4 : 0), 8) < 3, (x, y) => m(x, 4) === 0 && m(y, 4) < 3, (x, y) => m(x, 2) === 0 && m(y, 4) < 3],
      B: [(x, y) => m(x + y, 16) === 0 || m(x - y, 16) === 0, (x, y) => m(x + y, 8) === 0 || m(x - y, 8) === 0, (x, y) => (m(x + y, 8) === 0 || m(x - y, 8) === 0) || (m(x, 8) < 4 && m(y, 8) < 4 && m(x + y, 2) === 0), (x, y) => m(x + y, 4) < 2 || m(x - y, 8) === 0] },
    halftone: { name: 'RASTER / RISO',
      Z: [1, 1.8, 2.6, 3.4].map((r) => (x, y) => dotR(x, y, 8, r, false)),
      Y: [1, 1.8, 2.6, 3.4].map((r) => (x, y) => dotR(x, y, 8, r, true)),
      B: [1, 2, 3, 5].map((w) => (x, y) => m(x + y, 8) < w) },
    stitch: { name: 'CROSS-STITCH',
      Z: [(x, y) => m(x, 16) < 2 && m(y, 16) < 2, (x, y) => m(x, 8) < 2 && m(y, 8) < 2, (x, y) => m(Math.floor(x / 4) + Math.floor(y / 4), 2) === 0, (x, y) => !(m(x, 8) < 2 && m(y, 8) < 2)],
      Y: [(x, y) => plus(x, y, 16, 2), (x, y) => plus(x, y, 8, 2), (x, y) => plus(x, y, 8, 3) || plus(x + 4, y + 4, 8, 1), (x, y) => plus(x, y, 4, 2)],
      B: [(x, y) => m(x - y, 16) === 0 && m(x, 16) < 5, (x, y) => (m(x - y, 8) === 0 || m(x + y, 8) === 0) && m(x, 8) < 5 && m(y, 8) < 5, (x, y) => m(x - y, 8) === 0 || m(x + y, 8) === 0, (x, y) => m(x - y, 4) === 0 || m(x + y, 4) === 0] },
    bayer: { name: 'BAYER (CONTROL)',
      Z: [2, 5, 8, 11].map((t) => (x, y) => BAYER4[m(y, 4) * 4 + m(x, 4)] < t),
      Y: [2, 5, 8, 11].map((t) => (x, y) => BAYER4[m(y, 4) * 4 + m(x, 4)] < t),
      B: [2, 5, 8, 11].map((t) => (x, y) => BAYER4[m(y, 4) * 4 + m(x, 4)] < t) }
  };

  // ================= Atlas =================
  const CELL = 32, TONES = 6, VARS = ['Z', 'Y', 'B'];
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
  }
  const SPARSE = (x, y) => m(x, 8) === 0 && m(y + (m(x, 16) ? 4 : 0), 8) === 0;
  function recipe(kind, lit, c, paper, ink, dark, moonC) {
    let R;
    if (kind === 'ink') R = Array(TONES).fill([ink, paper, 0]);
    else if (kind === 'paper') R = [[paper, ink, 0], [paper, ink, 1], [paper, ink, 2], [paper, ink, 3], [paper, ink, 4], [ink, paper, 1]];
    else if (kind === 'gray') R = [[paper, ink, 2], [paper, ink, 3], [paper, ink, 4], [ink, paper, 3], [ink, paper, 2], [ink, paper, 1]];
    else if (lit === 'tint') R = [[paper, c, 1], [paper, c, 2], [paper, c, 3], [paper, c, 4], [c, ink, 2], [ink, c, 1]];
    else R = [[c, ink, 0], [c, ink, 1], [c, ink, 2], [c, ink, 3], [c, ink, 4], [ink, c, 1]];
    R = R.map((r) => r.slice());
    const lite = kind === 'ink' ? ink : kind === 'color' ? c : paper;
    if (dark === 'quiet') { R[4] = [ink, lite, -1]; R[5] = [ink, paper, 0]; }
    else if (dark === 'solid') { R[4] = [ink, paper, 0]; R[5] = [ink, paper, 0]; }
    else if (dark === 'tint') { R[4] = [mixHex(lite, ink, 0.62), ink, 0]; R[5] = [mixHex(lite, ink, 0.8), ink, 0]; }
    else if (dark === 'moonline') { const mb = mixHex(ink, moonC, 0.45), t4 = mixHex(lite, mb, 0.55), t5 = mixHex(lite, mb, 0.74); // ay ışığı + çok seyrek, zemine yakın gravür çizgisi
      R[4] = [t4, mixHex(t4, paper, 0.2), 1]; R[5] = [t5, mixHex(t5, paper, 0.13), 1]; }
    else if (dark === 'moon') { const mb = mixHex(ink, moonC, 0.45); R[4] = [mixHex(lite, mb, 0.55), mb, 0]; R[5] = [mixHex(lite, mb, 0.74), mb, 0]; } // ay ışığı: koyu tonlar ay mavisine çekilir
    return R;
  }
  function atlasCanvas(P, sys, lit, dark = 'pattern', unify = 0) {
    const SY = SYSTEMS[sys], cols = P.list.length * 3;
    const cv = document.createElement('canvas'); cv.width = CELL * cols; cv.height = CELL * TONES;
    const x = cv.getContext('2d');
    const hex = (k) => P.list.find((e) => e[0] === k)[1], paper = hex('paper'), ink = hex('ink');
    const moonC = (P.list.find((e) => e[0] === 'cool') || P.list.find((e) => e[0] === 'gray'))[1];
    P.list.forEach(([, c, kind], ci) => {
      const R = recipe(kind, lit, c, paper, ink, dark, moonC);
      VARS.forEach((v, vi) => {
        const col = ci * 3 + vi;
        R.forEach(([bg, fg, level], t) => {
          x.fillStyle = bg; x.fillRect(col * CELL, t * CELL, CELL, CELL);
          if (!level) return;
          x.fillStyle = fg;
          const f = level === -1 ? SPARSE : SY[unify && t >= 2 ? 'Y' : v][level - 1];
          for (let yy = 0; yy < CELL; yy++) for (let xx = 0; xx < CELL; xx++) if (f(xx, yy)) x.fillRect(col * CELL + xx, t * CELL + yy, 1, 1);
        });
      });
    });
    return cv;
  }
  const atlasCache = new Map();
  function atlasTexture(pal, sys, lit, dark, unify) {
    const key = [pal, sys, lit, dark, unify].join();
    if (atlasCache.has(key)) return atlasCache.get(key);
    const t = new THREE.CanvasTexture(atlasCanvas(PALS[pal], sys, lit, dark, unify));
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false;
    atlasCache.set(key, t); return t;
  }

  // ================= Materyal enjeksiyonu =================
  const U = {
    uAtlas: { value: null }, uAtlasSize: { value: new THREE.Vector2(1, 1) }, uPal: { value: Array.from({ length: 12 }, () => new THREE.Vector3()) },
    uN: { value: 1 }, uT: { value: [0.93, 0.8, 0.66, 0.52, 0.38] }, uScale: { value: 1 }, uOn: { value: 1 }, uDecor: { value: 0 }, uInk: { value: new THREE.Vector3() },
    uNearOn: { value: 0 }, uNear: { value: new THREE.Vector2(3, 9) }, uNearShift: { value: 2 },
    uPaint: { value: 0 }, uPrint: { value: 0 }, uHatch: { value: 1 }, uBoil: { value: 0 }, uHand: { value: 1 }, uNight: { value: 0 },
    uNature: { value: 0 }, uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.94, 0.33) }, uGreen: { value: new THREE.Vector3() }, uLightGreen: { value: new THREE.Vector3() }, uMarkGreen: { value: new THREE.Vector3() },
    uSea: { value: new THREE.Vector3() }, uSeaShallow: { value: new THREE.Vector3() }, uPaperC: { value: new THREE.Vector3() }, uDepth: { value: null }, uDepthB: { value: new THREE.Vector4(-20, -20, 20, 20) }, uBloom: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uShade: { value: new THREE.Vector3() }, uHi: { value: new THREE.Vector3() }, uPT: { value: new THREE.Vector3(0.85, 0.55, 0.3) }, uGrain: { value: 0.06 }
  };
  const FRAG_HEAD = 'uniform sampler2D uAtlas; uniform vec2 uAtlasSize; uniform vec3 uPal[12]; uniform int uN; uniform float uT[5]; uniform float uScale; uniform float uOn; uniform int uDecor; uniform vec3 uInk; uniform float uNearOn; uniform vec2 uNear; uniform float uNearShift; uniform float uPaint; uniform float uPrint; uniform float uHatch; uniform float uBoil; uniform float uHand; uniform float uNight; uniform float uNature; uniform float uTime; uniform vec2 uWind; uniform vec3 uGreen; uniform vec3 uLightGreen; uniform vec3 uMarkGreen; uniform vec3 uSea; uniform vec3 uSeaShallow; uniform vec3 uPaperC; uniform sampler2D uDepth; uniform vec4 uDepthB; uniform vec3 uBloom[3]; uniform vec3 uShade; uniform vec3 uHi; uniform vec3 uPT; uniform float uGrain;\n' +
  'float paintHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' +
  'float hdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
  'float hdNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hdHash(i), hdHash(i + vec2(1, 0)), f.x), mix(hdHash(i + vec2(0, 1)), hdHash(i + vec2(1, 1)), f.x), f.y); }\n';
  // BOYA (Ghibli yönü): ışık düz renk kademeleriyle (sıcak ışık · ana renk · serin gölge · derin gölge), kenarlar yumuşak;
  // gölge siyaha değil serin bir tona gider; ışığın rengi (lamba sıcak, ay serin) korunur; ince boya tanesi. Desen yalnız kumaşta (doku) kalır.
  const PAINT_TAIL = `
  if (uPaint > 0.5) {
    const vec3 LUMP = vec3(0.2126, 0.7152, 0.0722);
    vec3 base = diffuseColor.rgb;
    float L = dot(outgoingLight, LUMP) / max(dot(base, LUMP), 0.004);
    vec3 lc = outgoingLight / max(max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b)), 1e-3);
    float w = 0.05;
    float k1 = smoothstep(uPT.x - w, uPT.x + w, L), k2 = smoothstep(uPT.y - w, uPT.y + w, L), k3 = smoothstep(uPT.z - w, uPT.z + w, L);
    float nn = uNight;
    vec3 deep = mix(base, uShade, 0.7 + 0.25 * nn) * (0.85 - 0.35 * nn), sh = mix(base, uShade, 0.5 + 0.4 * nn), mid = mix(base, uShade, 0.2 + 0.66 * nn), hi = mix(base, uHi, 0.14 + 0.4 * nn);
    vec3 col = mix(deep, sh, k3); col = mix(col, mid, k2); col = mix(col, hi, k1);
    if (uPrint > 0.5) {
      // BASKI: ışık düz (ana renk), gölge kendi tonunda gravür. Tarama tek yönlü (bakır baskı); derin gölgede çapraz.
      vec3 ink2 = mix(base, uShade, 0.78 + 0.1 * nn) * (0.72 - 0.25 * nn), shf = mix(base, uShade, 0.22 + 0.68 * nn);
      vec2 fc = floor(gl_FragCoord.xy / max(uScale, 1.0));
      float pS = 9.0 - uHatch * 2.5 + 3.0 * nn, pD = 6.0 - uHatch * 1.5 + 2.0 * nn;     // seyrek · orta · sık (gece daha seyrek)
      float shadeK = 1.0 - k2, deepK = 1.0 - k3;
      // el çizimi: çizgi hafif dalgalanır (titrek el), kalınlığı değişir, ara ara kopar; birkaç karede bir kıpırdar (line boil)
      vec2 bo = vec2(uBoil * 17.0, uBoil * 31.0);
      float wob = uHand * (hdNoise(fc * 0.045 + bo) - 0.5) * 4.5, wid = 1.0 + uHand * (hdNoise(fc * 0.09 + bo.yx) - 0.45) * 1.1;
      float gapA = uHand * step(hdNoise(vec2(fc.x + fc.y, fc.x - fc.y) * vec2(0.05, 0.6) + bo), 0.3);
      float gapB = uHand * step(hdNoise(vec2(fc.x - fc.y, fc.x + fc.y) * vec2(0.05, 0.6) + bo + 7.0), 0.3);
      float u1 = fc.x - fc.y + wob, u2 = fc.x + fc.y + wob * 0.8;
      bool h1 = mod(u1, pS) < wid && gapA < 0.5, h2 = mod(u1, pD) < wid && gapA < 0.5, hx = mod(u2, pD + 0.7) < wid * 0.9 && gapB < 0.5;
      col = mix(mix(base, mid, nn), hi, k1 * (0.6 + 0.4 * nn)); // gece: ışık almayan yüz bile gece tonunda; lamba altı sıcak
      if (shadeK > 0.5) { col = shf; if (h1 && nn < 0.5) col = ink2; } // gece: ay ışığındaki yüz düz koyu ton, tarama yalnız derin gölgede
      if (deepK > 0.5) { col = mix(shf, uShade, 0.15); if (h2 || (uHatch > 0.5 && hx && nn < 0.5)) col = ink2; }
    }
    col *= mix(vec3(1.0), lc, 0.4);
    #ifndef ATLAS_BASIC
      float emL = dot(totalEmissiveRadiance, LUMP); col = mix(col, totalEmissiveRadiance / max(max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b)), 1e-3), clamp((emL - 0.25) * 1.6, 0.0, 1.0));
    #endif
    if (uPrint < 0.5) col *= 1.0 - uGrain * 0.5 + uGrain * paintHash(floor(gl_FragCoord.xy / max(uScale, 1.0)));
    gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
  }
  `;

  // CANLI DOĞA (boya / baskı): dünya koordinatında, zamanla. Çimende rüzgâr şeritleri + rüzgârla eğilen ot işaretleri + çiçek noktaları;
  // denizde kıyıda turkuaz sığlık, nefes alan köpük, akıntıyla kayıp doğup sönen dalga kavisleri, ara ara parıltı.
  const NATURE_FRAG = `
  #if defined(NATURE_LAND) || defined(NATURE_SEA)
  if (uNature > 0.5) {
    vec2 wp = vNatPos.xz; float vdist = length(vViewPosition), far = 1.0 - smoothstep(9.0, 24.0, vdist);
    vec2 hw = uHand * (vec2(hdNoise(wp * 2.3 + uBoil * 1.7), hdNoise(wp * 2.3 + 4.0 + uBoil * 1.7)) - 0.5) * 0.05; // el titremesi
  #ifdef NATURE_LAND
    vec3 gc = diffuseColor.rgb;
    float isGrass = 1.0 - smoothstep(0.004, 0.03, dot(gc - uGreen, gc - uGreen));
    float gust = sin(dot(wp, uWind) * 0.55 - uTime * 1.4 + hdNoise(wp * 0.12) * 4.0) * 0.5 + 0.5;
    gust = smoothstep(0.62, 1.0, gust) * isGrass;
    gc = mix(gc, uLightGreen, gust * 0.6);
    vec2 g = (wp + hw) / 0.42, cell = floor(g), f = (g - cell) * 0.42;
    float r = hdHash(cell), m = 0.0;
    if (isGrass > 0.5 && r > 0.4) {
      vec2 b = (vec2(hdHash(cell + 3.1), hdHash(cell + 7.7)) * 0.5 + 0.12) * 0.42;
      float lean = 0.35 + gust * 0.9 + 0.25 * sin(uTime * 2.0 + r * 6.0);
      vec2 up = normalize(vec2(0.0, -1.0) + uWind * lean), side = vec2(-up.y, up.x);
      float sc = 0.7 + 0.6 * hdHash(cell + 11.0), sk = (hdHash(cell + 13.0) - 0.5) * 0.06; bool one = hdHash(cell + 17.0) < 0.45;
      vec2 a1 = b + (up * 0.11 - side * (0.035 + sk)) * sc, a2 = one ? a1 : b + (up * (0.08 + 0.04 * hdHash(cell + 19.0)) + side * (0.04 - sk)) * sc;
      vec2 pa = f - b, d1 = a1 - b, d2 = a2 - b;
      float s1 = length(pa - d1 * clamp(dot(pa, d1) / dot(d1, d1), 0.0, 1.0)), s2 = length(pa - d2 * clamp(dot(pa, d2) / dot(d2, d2), 0.0, 1.0));
      float sd = min(s1, s2), aa = max(length(fwidth(wp)), 1e-4); // hücre sınırında türev sıçramasın (ızgara izi kalmasın)
      m = (1.0 - smoothstep(0.009, 0.009 + aa * 1.2, sd)) * far;
    }
    if (isGrass > 0.5 && r > 0.975) { // çiçek noktası
      vec2 b = (vec2(hdHash(cell + 5.3), hdHash(cell + 1.9)) * 0.6 + 0.2) * 0.42; float dd = length(f - b), aa = max(length(fwidth(wp)), 1e-4);
      float fm = (1.0 - smoothstep(0.03, 0.03 + aa, dd)) * far; int bi = int(mod(r * 997.0, 3.0));
      gc = mix(gc, bi == 0 ? uBloom[0] : bi == 1 ? uBloom[1] : uBloom[2], fm);
    }
    diffuseColor.rgb = mix(gc, uMarkGreen, m);
  #endif
  #ifdef NATURE_SEA
    vec2 duv = (wp - uDepthB.xy) / (uDepthB.zw - uDepthB.xy);
    float dep = (duv.x < 0.0 || duv.y < 0.0 || duv.x > 1.0 || duv.y > 1.0) ? 1.0 : texture2D(uDepth, duv).r;
    vec3 col = mix(uSeaShallow, uSea, smoothstep(0.02, 0.5, dep));
    float foam = (1.0 - smoothstep(0.0, 0.045 + 0.025 * sin(uTime * 1.2), dep + (hdNoise(wp * 1.5 + uTime * 0.3) - 0.5) * 0.03));
    float ring = step(0.82, sin((dep + hw.x * 0.3) * 70.0 - uTime * 1.8) * 0.5 + 0.5) * (1.0 - smoothstep(0.05, 0.16, dep)) * step(0.045, dep);
    col = mix(col, uPaperC, max(foam, ring * 0.85));
    float cs = mix(1.0, 2.4, smoothstep(0.0, 0.7, dep));
    vec2 q = (wp + hw) + uWind * uTime * 0.22; q.x += step(1.0, mod(floor(q.y / cs), 2.0)) * cs * 0.5;
    vec2 cell = floor(q / cs), fq = q / cs - cell; float rr = hdHash(cell);
    if (rr > 0.3 + 0.35 * smoothstep(0.2, 0.9, dep)) {
      float life = fract(uTime * 0.1 + rr * 7.0), vis = sin(life * 3.14159);
      vec2 cc = vec2(0.5) + (vec2(hdHash(cell + 1.3), hdHash(cell + 2.7)) - 0.5) * 0.35, d = (fq - cc) * cs;
      float rad = 0.2 * cs * (0.7 + 0.3 * vis), dd = abs(length(d) - rad), aa = max(length(fwidth(wp)), 1e-4);
      float arc = (1.0 - smoothstep(0.022, 0.022 + aa * 1.2, dd)) * step(d.y, -rad * 0.3) * vis;
      col = mix(col, uPaperC, arc * mix(1.0, 0.5, far * 0.0));
    }
    vec2 gq = floor(wp / 0.6); float gr = hdHash(gq + 9.1);
    if (gr > 0.992 && uNight < 0.5) { float tw = max(0.0, sin(uTime * 3.0 + gr * 50.0)); vec2 gp = (fract(wp / 0.6) - 0.5); col = mix(col, vec3(1.0), tw * (1.0 - smoothstep(0.02, 0.08, length(gp))) * far); }
    diffuseColor.rgb = col;
  #endif
  }
  #endif
  `;
  // el çizimi kumaş: doku koordinatı yumuşak gürültüyle kayar → çizgili çatı, kareli elbise elle boyanmış gibi titrer
  const MAP_HAND = `
  #ifdef USE_MAP
    vec2 hdUv = vMapUv + uHand * 0.006 * (vec2(hdNoise(vMapUv * 26.0 + uBoil * 3.0), hdNoise(vMapUv * 26.0 + 5.0 + uBoil * 3.0)) - 0.5);
    diffuseColor *= texture2D(map, hdUv);
  #endif
  `;
  const FRAG_TAIL = `
  if (uOn > 0.5 && uPaint < 0.5) {
    const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
    vec3 base = diffuseColor.rgb;
    float lit = dot(outgoingLight, LUM) / max(dot(base, LUM), 0.004);
    int idx = 0; float best = 1e9;
    for (int i = 0; i < 12; i++) { if (i >= uN) break; vec3 d = base - uPal[i]; float e = dot(d, d); if (e < best) { best = e; idx = i; } }
    float band = 5.0;
    for (int i = 0; i < 5; i++) { if (lit > uT[i]) { band = float(i); break; } }
    bool decor = false;
    #ifdef USE_MAP
      decor = true;
    #endif
    float variant = decor ? 2.0 : 1.0;
    #ifndef ATLAS_BASIC
      // perspektif: kameraya yakın büyük yüzeylerde desen seyrelir (açık tona kayar); koyu dolgular (4–5) olduğu gibi kalır
      if (uNearOn > 0.5 && band < 3.5) { float nk = 1.0 - smoothstep(uNear.x, uNear.y, length(vViewPosition)); band = max(0.0, band - floor(nk * uNearShift + 0.5)); }
      vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
      if (abs(wn.y) > 0.6) variant = 0.0;
    #endif
    vec3 outc;
    if (decor && uDecor == 2) outc = mix(uPal[idx], uInk, band / 6.0);
    else {
      if (decor && uDecor == 1 && band < 3.5) band = 0.0;
      vec2 p = mod(floor(gl_FragCoord.xy / uScale), 32.0);
      vec2 auv = (vec2(float(idx) * 3.0 + variant, band) * 32.0 + p + 0.5) / uAtlasSize;
      outc = texture2D(uAtlas, auv).rgb;
    }
    gl_FragColor = linearToOutputTexel(vec4(outc, 1.0));
  }
  `;
  // Gerçek açı düşüşü (toon'un varsayılanı arka yüze de %70 ışık verir)
  const LAMBERT = (() => { const n = 64, d = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { const v = Math.max(0, 2 * (i + 0.5) / n - 1) * 255; d.set([v, v, v, 255], i * 4); } const t = new THREE.DataTexture(d, n, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
  function patchMat(mat) {
    if (mat.userData.noAtlas) return; // ör. fener huzmesi: ham renk, atlasa girmez
    if (mat.isMeshToonMaterial) mat.gradientMap = LAMBERT;
    if (mat.userData.patched) return; mat.userData.patched = true;
    const basic = mat.isMeshBasicMaterial, nat = mat.userData.nature; // 'land' | 'sea' (kutuphane/arazi.js)
    if (nat) mat.defines = Object.assign({}, mat.defines, { [nat === 'sea' ? 'NATURE_SEA' : 'NATURE_LAND']: '' });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      if (nat) {
        sh.vertexShader = 'varying vec3 vNatPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vNatPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vNatPos;\n' + sh.fragmentShader;
      }
      sh.fragmentShader = (basic ? '#define ATLAS_BASIC\n' : '') + FRAG_HEAD + sh.fragmentShader.replace('#include <map_fragment>', MAP_HAND).replace('#include <color_fragment>', '#include <color_fragment>\n' + (nat ? NATURE_FRAG : '')).replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_TAIL + PAINT_TAIL);
    };
    mat.customProgramCacheKey = () => 'atlas' + (basic ? 'b' : 't') + (nat || '');
  }
  function patchObject(obj) { obj.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchMat); }); return obj; }

  // ================= Kontur =================
  const ndMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    uniforms: { nat: { value: 0 } },
    fragmentShader: 'uniform float nat; varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); gl_FragColor = vec4(n.xy * 0.5 + 0.5, nat, vD); }', side: THREE.DoubleSide
  });
  const ndLand = ndMat.clone(); ndLand.uniforms.nat.value = 1; const ndSea = ndMat.clone(); ndSea.uniforms.nat.value = 0.5;
  const compMat = new THREE.ShaderMaterial({
    uniforms: { tC: { value: null }, tN: { value: null }, res: { value: new THREE.Vector2() }, thick: { value: 1 }, mode: { value: 1 }, ink: { value: new THREE.Vector3() }, depthK: { value: 0.08 },
      paint: { value: 0 }, print: { value: 0 }, reg: { value: 0 }, grain: { value: 0 }, boil: { value: 0 }, hand: { value: 0 }, fogOn: { value: 0 }, fogNear: { value: 14 }, fogFar: { value: 42 }, skyTop: { value: new THREE.Vector3() }, skyBot: { value: new THREE.Vector3() }, stars: { value: 0 }, dpx: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tC, tN; uniform vec2 res; uniform float thick; uniform int mode; uniform vec3 ink; uniform float depthK; varying vec2 vUv;
      uniform float fogOn, fogNear, fogFar, stars, dpx, paint, print, reg, grain, boil, hand;
      float luma(vec2 uv) { return dot(texture2D(tC, uv).rgb, vec3(0.2126, 0.7152, 0.0722)); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float hn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1)); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); } uniform vec3 skyTop, skyBot;
      // baskı gibi gökyüzü: 4 kademe, kademeler arası sıralı tarama (Bayer) · gece seyrek yıldız
      vec3 skyAt(vec2 uv) {
        vec2 f = floor(gl_FragCoord.xy / dpx); float q = smoothstep(0.42, 1.0, uv.y) * 4.0, fl = floor(q);
        if (paint > 0.5) { vec3 g = mix(skyBot, skyTop, smoothstep(0.4, 1.0, uv.y)); return stars > 0.5 && uv.y > 0.55 && hash(floor(gl_FragCoord.xy / (2.0 * dpx))) > 0.9965 ? mix(g, vec3(1.0), 0.7) : g; }
        float b = mod(f.x + 2.0 * mod(f.y, 2.0) + 4.0 * mod(floor(f.y / 2.0), 2.0) + 2.0 * mod(floor(f.x / 2.0), 2.0), 8.0) / 8.0;
        vec3 s = mix(skyBot, skyTop, min(4.0, fl + step(b, fract(q))) / 4.0);
        if (stars > 0.5 && uv.y > 0.55 && hash(floor(gl_FragCoord.xy / (2.0 * dpx))) > 0.9965) s = mix(s, vec3(1.0), 0.75);
        return s;
      }
      vec3 nrm(vec4 t) { vec2 xy = t.xy * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
      float edgeAt(vec2 uv, vec2 px) {
        float e = 0.0; vec4 n0 = texture2D(tN, uv);
        vec2 D[4]; D[0] = vec2(1, 0); D[1] = vec2(-1, 0); D[2] = vec2(0, 1); D[3] = vec2(0, -1);
        vec4 nn[4];
        for (int i = 0; i < 4; i++) { vec4 n1 = texture2D(tN, uv + D[i] * px); nn[i] = n1; bool b0 = n0.a <= 0.0, b1 = n1.a <= 0.0;
          if (b0 && b1) continue; if (b0 != b1) { if (b1) e = 1.0; continue; }
          if (print > 0.5 && n0.b > 0.25 && n1.b > 0.25) { if (abs(n0.b - n1.b) > 0.25 && n0.b > n1.b) e = 1.0; continue; } // baskı: doğada çizgi yok, yalnız kıyı
          if (dot(nrm(n1), nrm(n0)) < (paint > 0.5 ? 0.2 : 0.6)) e = 1.0; }
        if (n0.a > 0.0 && !(print > 0.5 && n0.b > 0.25)) for (int k = 0; k < 2; k++) { vec4 a = nn[k * 2], c = nn[k * 2 + 1];
          if (a.a <= 0.0 || c.a <= 0.0) continue;
          float lap = a.a + c.a - 2.0 * n0.a; if (lap > depthK * 2.0) e = 1.0; }
        return e;
      }
      void main() {
        vec3 c = texture2D(tC, vUv).rgb; vec2 px = thick / res; float e = 0.0;
        if (mode == 1) {
          // el çizimi kontur: örnekleme noktası yumuşak gürültüyle kayar (titrek çizgi), kalınlık değişir, ara ara incelip kopar
          vec2 g = gl_FragCoord.xy / dpx, bo = vec2(boil * 13.0, boil * 29.0);
          vec2 wob = hand * (vec2(hn(g * 0.035 + bo), hn(g * 0.035 + bo + 9.0)) - 0.5) * 4.0;
          float th = 1.0 + hand * (hn(g * 0.05 + bo.yx) - 0.4) * 1.2;
          e = edgeAt(vUv + (vec2(reg, -reg) + wob) * px, px * max(0.5, th));
          if (hand > 0.0 && hn(g * 0.08 + bo + 3.0) < 0.16) e = 0.0;
        }
        else if (mode == 2) {
          float gx = luma(vUv + vec2(px.x, 0)) - luma(vUv - vec2(px.x, 0)), gy = luma(vUv + vec2(0, px.y)) - luma(vUv - vec2(0, px.y));
          e = step(0.12, length(vec2(gx, gy)));
        }
        vec3 lineC = paint > 0.5 && print < 0.5 ? mix(c * 0.45, ink, 0.2) : ink; // boyada çizgi dolgunun koyu tonu; baskıda mürekkep (imza)
        if (fogOn > 0.5) { // perspektif: arka plan gökyüzü, uzak yüzeyler ve çizgileri gökyüzüne karışır (derinlik)
          float d0 = texture2D(tN, vUv).a; vec3 sk = skyAt(vUv);
          if (d0 <= 0.0) c = sk;
          else { float fg = smoothstep(fogNear, fogFar, d0); c = mix(c, sk, fg); lineC = mix(lineC, sk, fg * 0.85); }
        }
        vec3 outc = e > 0.5 ? lineC : c;
        if (grain > 0.0) outc *= 1.0 - grain * 0.5 + grain * hash(floor(gl_FragCoord.xy / dpx)); // kâğıt tanesi (renk ve çizgi birlikte)
        gl_FragColor = vec4(outc, 1.0);
        #include <colorspace_fragment>
      }`, depthTest: false, depthWrite: false
  });
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat));
  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
  const rtC = new THREE.WebGLRenderTarget(4, 4, rtOpts), rtN = new THREE.WebGLRenderTarget(4, 4, rtOpts);

  // ================= Uygula + çiz =================
  // Varsayılan = Montour (ana stil). stiller/montour.js yüklüyse oradan okunur.
  const ST = (window.KUTUPHANE && window.KUTUPHANE.stil) || null;
  const DEFAULTS = ST ? { pal: ST.palette, sys: ST.system, lit: ST.lit, decor: ST.decor, outline: ST.outline, time: 'day', scale: ST.scale, on: ST.print === 'atlas' ? 1 : 0, dark: ST.dark, unify: ST.unifyDark, oc: ST.outlineNight, t: ST.thresholds.slice(), nT: ST.nightThresholdFactor }
                      : { pal: 'c', sys: 'engrave', lit: 'color', decor: 0, outline: 1, time: 'day', scale: 1, on: 1, dark: 'quiet', unify: 1, oc: 'auto', t: [0.93, 0.8, 0.66, 0.52, 0.38], nT: 0.7 };
  function apply(s, dpr = 1) {
    const P = PALS[s.pal];
    U.uAtlas.value = atlasTexture(s.pal, s.sys, s.lit, s.dark, s.unify); U.uAtlasSize.value.set(CELL * P.list.length * 3, CELL * TONES);
    P.list.forEach(([, hex], i) => { const c = new THREE.Color(hex); U.uPal.value[i].set(c.r, c.g, c.b); });
    U.uN.value = P.list.length;
    const k = s.time === 'night' ? s.nT : 1; U.uT.value = s.t.map((v) => v * k);
    const ink = new THREE.Color(P.list[1][1]); U.uInk.value.set(ink.r, ink.g, ink.b);
    // gece kontur rengi: auto = kâğıt (tam beyaz) · dim = kâğıt ile mürekkep arası · faint = mürekkebe yakın, soluk · ink = mürekkep
    const OCMIX = { auto: 0, dim: 0.45, faint: 0.68, ink: 1 };
    const line = new THREE.Color(s.time === 'night' ? mixHex(P.list[0][1], P.list[1][1], OCMIX[s.oc] ?? 0) : P.list[1][1]);
    compMat.uniforms.ink.value.set(line.r, line.g, line.b);
    U.uScale.value = s.scale * dpr; U.uOn.value = s.on; U.uDecor.value = s.decor;
    compMat.uniforms.mode.value = s.outline;
    // perspektif ayarları (stil: perspective) — yalnız perspektif kamerada etkin, render() açar
    const PS = (ST && ST.perspective) || {}, rgb = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
    const cool = (P.list.find((e) => e[0] === 'cool') || P.list.find((e) => e[0] === 'gray') || P.list[1])[1], paper = P.list[0][1], inkH = P.list[1][1];
    const night = s.time === 'night';
    compMat.uniforms.skyBot.value.set(...rgb(night ? mixHex(inkH, cool, PS.nightHorizon ?? 0.3) : paper));
    compMat.uniforms.skyTop.value.set(...rgb(night ? inkH : mixHex(paper, cool, PS.dayZenith ?? 0.32)));
    compMat.uniforms.stars.value = night ? 1 : 0; compMat.uniforms.dpx.value = dpr;
    compMat.uniforms.fogNear.value = s.fogNear ?? PS.fogNear ?? 14; compMat.uniforms.fogFar.value = s.fogFar ?? PS.fogFar ?? 42;
    U.uNear.value.set(s.nearStart ?? PS.nearStart ?? 3, s.nearEnd ?? PS.nearEnd ?? 9); U.uNearShift.value = s.nearShift ?? PS.nearShift ?? 2;
    // boya: serin gölge (gündüz morumsu mavi, gece derin lacivert), sıcak ışık
    const PT = (ST && ST.paint) || {}, pink = (P.list.find((e) => e[0] === 'pink') || P.list[0])[1];
    U.uPaint.value = s.paint ? 1 : 0; compMat.uniforms.paint.value = s.paint ? 1 : 0;
    const PR = (ST && ST.print2) || {}, prn = s.paint === 2;
    U.uPrint.value = prn ? 1 : 0; U.uHatch.value = s.hatch ?? PR.hatch ?? 1; compMat.uniforms.print.value = prn ? 1 : 0;
    compMat.uniforms.reg.value = prn ? (PR.misregister ?? 0.8) : 0; compMat.uniforms.grain.value = prn ? (PR.grain ?? 0.07) : 0;
    const NA = (ST && ST.nature) || {}, colOf = (k, f) => (P.list.find((e) => e[0] === k) || [0, f])[1];
    const green = colOf('green', '#7fae68'), warmH = colOf('warm', paper), seaH = colOf(P.sea, cool);
    const classicNight = (PT.nightMode || 'classic') === 'classic';
    U.uNature.value = s.paint && s.nature !== 0 ? 1 : 0; U.uTime.value = (performance.now() / 1000) % 3600; U.uNight.value = night && s.paint && !classicNight ? 1 : 0;
    U.uGreen.value.set(...rgb(green)); U.uLightGreen.value.set(...rgb(mixHex(green, warmH, NA.gustWarm ?? 0.35)));
    U.uMarkGreen.value.set(...rgb(mixHex(green, mixHex(inkH, cool, 0.3), NA.markInk ?? 0.5)));
    U.uSea.value.set(...rgb(seaH)); U.uSeaShallow.value.set(...rgb(mixHex(mixHex(seaH, green, NA.shallowGreen ?? 0.4), paper, NA.shallowPaper ?? 0.25)));
    U.uPaperC.value.set(...rgb(paper)); [colOf('pink', paper), colOf('warm', paper), paper].forEach((h, i) => U.uBloom.value[i].set(...rgb(h)));
    const w = NA.wind || [0.94, 0.33]; U.uWind.value.set(w[0], w[1]).normalize();
    if (night && s.paint && !classicNight) { const nc = (h) => mixHex(h, mixHex(inkH, cool, 0.5), 0.55); U.uSea.value.set(...rgb(nc(seaH))); U.uSeaShallow.value.set(...rgb(nc(mixHex(seaH, green, 0.4)))); U.uPaperC.value.set(...rgb(mixHex(paper, cool, 0.35))); }
    const hand = prn ? (s.hand ?? PR.hand ?? 1) : 0, boil = Math.floor(performance.now() / 1000 * (PR.boilFps ?? 6)) % 64;
    U.uHand.value = hand; compMat.uniforms.hand.value = hand; U.uBoil.value = (PR.boilFps ?? 6) > 0 ? boil : 0; compMat.uniforms.boil.value = U.uBoil.value;
    const shade = night ? mixHex(inkH, cool, 0.42) : mixHex(mixHex(cool, inkH, PT.shadeInk ?? 0.3), pink, PT.shadePink ?? 0.18);
    U.uShade.value.set(...rgb(shade)); U.uHi.value.set(...rgb(PT.light || '#fff3d6'));
    const th0 = s.pt || (night && !classicNight ? PT.nightSteps || [0.95, 0.5, 0.22] : PT.steps || [0.85, 0.55, 0.3]), pk = night && classicNight && !s.pt ? s.nT : 1;
    U.uPT.value.set(th0[0] * pk, th0[1] * pk, th0[2] * pk);
    if (night && s.paint === 2 && classicNight) { const ik = new THREE.Color(inkH); compMat.uniforms.ink.value.set(ik.r, ik.g, ik.b); } // baskı gecesi: kontur mürekkep (beyaz değil) U.uGrain.value = PT.grain ?? 0.06;
    if (s.paint && !night) compMat.uniforms.skyTop.value.set(...rgb(mixHex(paper, cool, PT.zenith ?? 0.5)));
  }
  // 1) normal + derinlik  2) renk (atlas materyalde)  3) birleştir + kontur → cv (2B tuval)
  let frameN = 0;
  function render(cv, scene, cam, bg, s, dpr = 1, up = 1) {
    const w = Math.max(2, Math.round(cv.clientWidth * dpr * up)), h = Math.max(2, Math.round(cv.clientHeight * dpr * up));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    renderer.setSize(w, h, false);
    if (rtC.width !== w || rtC.height !== h) { rtC.setSize(w, h); rtN.setSize(w, h); }
    apply(s, dpr * up);
    compMat.uniforms.thick.value = dpr * up;
    const nd = scene.userData.nature; if (nd) { U.uDepth.value = nd.tex; U.uDepthB.value.set(nd.b.x0, nd.b.z0, nd.b.x1, nd.b.z1); }
    const persp = !!cam.isPerspectiveCamera && s.persp !== 0; compMat.uniforms.fogOn.value = persp ? 1 : 0; U.uNearOn.value = persp ? 1 : 0;
    // kontur geçişinde görünmeyecekler (userData.noOutline): saydam huzme, efektler
    const nc = scene.userData.noOutlineCache;
    if (!nc || ++nc.age > 45) { const list = []; scene.traverse((o) => { if (o.userData.noOutline) list.push(o); }); scene.userData.noOutlineCache = { list, age: 0 }; }
    const hidden = []; scene.userData.noOutlineCache.list.forEach((o) => { if (o.visible) { o.visible = false; hidden.push(o); } });
    // normal geçişi katman katman: nesneler (0) · kara ve yollar (1) · deniz (2); doğa bayrağı normal tamponunun mavi kanalında
    scene.background = null; const mask = cam.layers.mask;
    renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rtN); renderer.clear(); renderer.autoClear = false;
    const sAuto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; // normal geçişi gölge haritasına gerek duymaz
    const natG = scene.userData.natureGroup;
    if (natG) {
      cam.layers.set(0); scene.overrideMaterial = ndMat; renderer.render(scene, cam); scene.overrideMaterial = null;
      cam.layers.set(1); cam.layers.enable(2);
      const sw = []; natG.children.forEach((m) => { if (m.isMesh && (m.layers.mask & 6)) { sw.push([m, m.material]); m.material = m.layers.mask & 4 ? ndSea : ndLand; } });
      renderer.render(natG, cam); sw.forEach(([m, mt]) => { m.material = mt; });
    } else [[0, ndMat], [1, ndLand], [2, ndSea]].forEach(([l, m]) => { cam.layers.set(l); scene.overrideMaterial = m; renderer.render(scene, cam); });
    renderer.autoClear = true; renderer.shadowMap.autoUpdate = sAuto;
    // gölge haritası her karede değil (varsayılan iki karede bir): sahnenin çoğu durağan
    const se = s.shadowEvery ?? 2; frameN++; if (se > 1) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = frameN % se === 0; } cam.layers.mask = mask; cam.layers.enable(1); cam.layers.enable(2);
    scene.overrideMaterial = null; scene.background = bg;
    hidden.forEach((o) => { o.visible = true; });
    renderer.setRenderTarget(rtC); renderer.render(scene, cam);
    compMat.uniforms.tC.value = rtC.texture; compMat.uniforms.tN.value = rtN.texture; compMat.uniforms.res.value.set(w, h);
    renderer.setRenderTarget(null); renderer.render(fsScene, fsCam);
    if (cv !== renderer.domElement) cv.getContext('2d').drawImage(renderer.domElement, 0, 0); // ana tuval doğrudan çizilir; kopya yalnız küçük resimlerde
    return { w, h };
  }

  return { PALS, SYSTEMS, DEFAULTS, rolesOf, atlasCanvas, patchObject, apply, render, LAMBERT, CELL, TONES };
}

// Takımada · yapı motoru
// Tarif (veri) → three.js nesnesi. Karakterlerle aynı ilke: parçalar + renk ROLLERİ; görünüm katmanı sonra uygulanır.
//
// createStructures(THREE, parts) → { build(recipe, C, makeChar), PATTERNS }
//   parts: createParts(...) çıktısı (desenler, doku yardımcıları, karakter kurucu)
//
// Parça türleri (her biri: at [x,y,z], rot [x,y,z] radyan, scale, paint, emit, anim):
//   box {size:[w,h,d]} · cyl {r, rTop, h, seg} · cone {r, h, seg} · sphere {r, half} · lathe {profile:[[r,y]…]}
//   gable {w, d} (beşik çatı, tabanı y=0) · torus {r, tube, arc} · plane {w, d}
//   ring {count, radius, part} · row {count, step:[dx,dy,dz], part} · grid {nx, nz, step:[dx,dz], part}
//   group {parts} · char {id} (kütüphaneden karakter)
// anim: { spin: hız (rad/s, eksen 'y' varsayılan), axis, swing: genlik, bob: genlik, speed }

function createStructures(THREE, parts) {
  const { PATTERNS, patternCanvas, texFrom, LAMBERT } = parts;
  const S = 1024, SEG = 48;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ================= Yapılara özgü desenler =================
  Object.assign(PATTERNS, {
    window: (x, [bg, fg, f2 = fg, f3 = fg]) => { // cephe: kemerli kapı + 4 kayıtlı pencere + saçak dişleri
      x.fillStyle = fg; x.fillRect(S * 0.42, S * 0.5, S * 0.16, S * 0.5); x.beginPath(); x.arc(S * 0.5, S * 0.5, S * 0.08, Math.PI, 0); x.fill();
      [[0.12, 0.2], [0.68, 0.2], [0.12, 0.55], [0.68, 0.55]].forEach(([a, b]) => { x.fillStyle = f2; x.fillRect(a * S, b * S, S * 0.2, S * 0.22); x.fillStyle = fg; x.fillRect((a + 0.095) * S, b * S, S * 0.012, S * 0.22); x.fillRect(a * S, (b + 0.105) * S, S * 0.2, S * 0.012); });
      x.fillStyle = f3; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(i * S / 10, 0); x.lineTo((i + 0.5) * S / 10, S * 0.07); x.lineTo((i + 1) * S / 10, 0); x.fill(); }
    },
    shingles: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.01; for (let r = 0; r < 8; r++) for (let c = -1; c < 9; c++) { const cx = (c + (r % 2) * 0.5) * S / 8, cy = r * S / 8; x.beginPath(); x.arc(cx + S / 16, cy, S / 16, 0, Math.PI); x.stroke(); } },
    planks: (x, [bg, fg]) => { x.fillStyle = fg; for (let r = 0; r < 8; r++) { x.fillRect(0, r * S / 8, S, S * 0.008); const off = (r % 2) * S / 4; for (let c = 0; c < 3; c++) { x.fillRect(off + c * S / 2, r * S / 8, S * 0.008, S / 8); x.beginPath(); x.arc(off + c * S / 2 + S * 0.03, r * S / 8 + S * 0.03, S * 0.006, 0, 7); x.fill(); } } },
    bricks: (x, [bg, fg]) => { x.fillStyle = fg; for (let r = 0; r < 12; r++) { x.fillRect(0, r * S / 12, S, S * 0.008); const off = (r % 2) * S / 8; for (let c = 0; c < 5; c++) x.fillRect(off + c * S / 4, r * S / 12, S * 0.008, S / 12); } },
    clockface: (x, [bg, fg, f2 = fg]) => { // disk kapağına: 12 çentik + rakam noktaları (ibreler ayrı, döner)
      x.strokeStyle = fg; x.lineCap = 'round';
      for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r0 = k % 5 ? 0.43 : 0.38; x.lineWidth = S * (k % 5 ? 0.006 : 0.016); x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * S * r0, S / 2 + Math.sin(a) * S * r0); x.lineTo(S / 2 + Math.cos(a) * S * 0.46, S / 2 + Math.sin(a) * S * 0.46); x.stroke(); }
      x.lineWidth = S * 0.012; x.beginPath(); x.arc(S / 2, S / 2, S * 0.485, 0, 7); x.stroke(); x.fillStyle = f2; x.beginPath(); x.arc(S / 2, S / 2, S * 0.03, 0, 7); x.fill();
    },
    glass: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i <= 4; i++) { x.fillRect(i * S / 4 - S * 0.012, 0, S * 0.024, S); x.fillRect(0, i * S / 4 - S * 0.012, S, S * 0.024); } x.globalAlpha = 0.18; x.strokeStyle = fg; x.lineWidth = S * 0.01; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(i * S / 4 + S * 0.05, j * S / 4 + S * 0.15); x.lineTo(i * S / 4 + S * 0.12, j * S / 4 + S * 0.06); x.stroke(); } x.globalAlpha = 1; },
    keys: (x, [bg, fg]) => { x.fillStyle = fg; for (let i = 0; i <= 14; i++) x.fillRect(i * S / 14, 0, S * 0.006, S); [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].forEach((k) => x.fillRect((k + 0.65) * S / 14, 0, S / 14 * 0.6, S * 0.6)); },
    cobbles: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.008; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.beginPath(); x.ellipse((c + (r % 2) * 0.5) * S / 8, (r + 0.5) * S / 8, S / 18, S / 22, rnd() * 0.4, 0, 7); x.stroke(); } },
    grass: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.006; x.lineCap = 'round'; for (let i = 0; i < 160; i++) { const px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px - S * 0.01, py - S * 0.025); x.moveTo(px, py); x.lineTo(px + S * 0.012, py - S * 0.022); x.stroke(); } },
    rock: (x, [bg, fg]) => { x.strokeStyle = fg; x.lineWidth = S * 0.008; for (let i = 0; i < 26; i++) { const px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * S * 0.12, py + (rnd() - 0.5) * S * 0.06); x.lineTo(px + (rnd() - 0.5) * S * 0.12, py + (rnd() - 0.5) * S * 0.08); x.stroke(); } }
  });

  // ================= Kurucu =================
  function build(recipe, C, makeChar) {
    seed = [...recipe.id].reduce((a, c) => a + c.charCodeAt(0), 3);
    const col = (k) => C[k] || k;
    const cache = new Map();
    function mat(p = {}, emit = 0) {
      const key = JSON.stringify(p) + emit;
      if (cache.has(key)) return cache.get(key);
      const o = { gradientMap: LAMBERT };
      if (p.pattern) o.map = texFrom(patternCanvas(p.pattern, p.colors.map(col)), p.repeat || [1, 1]); else o.color = col(p.color || 'paper');
      if (emit) { o.emissive = new THREE.Color(col(p.color || 'paper')); o.emissiveIntensity = emit; if (p.pattern) o.emissiveMap = o.map; }
      // pencere deseni: yalnız camlar sıcak ışır (gece). Gündüz yoğunluk 0; ada-sahne applyLights gece açar
      if (p.pattern === 'window' && !emit) { o.emissive = new THREE.Color('#ffffff'); o.emissiveIntensity = 0; o.emissiveMap = texFrom(patternCanvas('window', ['#000000', '#000000', '#ffbf5e', '#000000']), p.repeat || [1, 1]); }
      const m = new THREE.MeshToonMaterial(o); if (p.pattern === 'window' && !emit) m.userData.window = true; cache.set(key, m); return m;
    }
    const anims = [], chars = [];
    const mesh = (geo, spec) => { const o = new THREE.Mesh(geo, mat(spec.paint, spec.emit)); o.castShadow = spec.shadow !== false; o.receiveShadow = true; return o; };
    function place(obj, spec) {
      const [x = 0, y = 0, z = 0] = spec.at || []; obj.position.set(x, y, z);
      if (spec.rot) obj.rotation.set(...spec.rot);
      if (spec.scale !== undefined) Array.isArray(spec.scale) ? obj.scale.set(...spec.scale) : obj.scale.setScalar(spec.scale);
      if (spec.anim) { const a = spec.anim, ax = a.axis || 'y', base = obj.rotation[ax], by = obj.position.y, ph = rnd() * 6;
        anims.push((t) => { if (a.spin) obj.rotation[ax] = base + t * a.spin; if (a.swing) obj.rotation[ax] = base + Math.sin(t * (a.speed || 2) + ph) * a.swing; if (a.bob) obj.position.y = by + Math.sin(t * (a.speed || 1.5) + ph) * a.bob; }); }
      return obj;
    }
    function node(spec) {
      const T = spec.type;
      let o;
      if (T === 'box') { const [w, h, d] = spec.size; o = mesh(new THREE.BoxGeometry(w, h, d), spec); }
      else if (T === 'cyl') o = mesh(new THREE.CylinderGeometry(spec.rTop ?? spec.r, spec.r, spec.h, spec.seg || SEG, 1, !!spec.open), spec);
      else if (T === 'cone') o = mesh(new THREE.ConeGeometry(spec.r, spec.h, spec.seg || SEG, 1, !!spec.open), spec);
      else if (T === 'sphere') o = mesh(new THREE.SphereGeometry(spec.r, spec.seg || 32, 20, 0, Math.PI * 2, 0, spec.half ? Math.PI / 2 : Math.PI), spec);
      else if (T === 'lathe') o = mesh(new THREE.LatheGeometry(spec.profile.map(([a, b]) => new THREE.Vector2(a, b)), spec.seg || SEG).rotateY(Math.PI), spec);
      else if (T === 'torus') o = mesh(new THREE.TorusGeometry(spec.r, spec.tube, 8, spec.seg || SEG, spec.arc || Math.PI * 2), spec);
      else if (T === 'plane') { o = mesh(new THREE.PlaneGeometry(spec.w, spec.d), spec); o.rotation.x = -Math.PI / 2; }
      else if (T === 'gable') { // beşik çatı: üçgen prizma, tabanı y = 0'da, sırt x boyunca
        const rr = spec.d / Math.sqrt(3), g = new THREE.CylinderGeometry(rr, rr, spec.w, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, rr * 0.5, 0);
        g.scale(1, (spec.h || rr * 1.5) / (rr * 1.5), 1); o = mesh(g, spec);
      }
      else if (T === 'ring') { o = new THREE.Group(); for (let i = 0; i < spec.count; i++) { const a = (i / spec.count) * Math.PI * 2 + (spec.start || 0); const c = node(spec.part); c.position.x += Math.cos(a) * spec.radius; c.position.z += Math.sin(a) * spec.radius; if (spec.face) c.rotation.y = -a + Math.PI / 2; o.add(c); } }
      else if (T === 'row') { o = new THREE.Group(); const [dx, dy, dz] = spec.step; for (let i = 0; i < spec.count; i++) { const c = node(spec.part); c.position.x += dx * i; c.position.y += dy * i; c.position.z += dz * i; o.add(c); } }
      else if (T === 'grid') { o = new THREE.Group(); const [dx, dz] = spec.step; for (let i = 0; i < spec.nx; i++) for (let j = 0; j < spec.nz; j++) { const c = node(spec.part); c.position.x += (i - (spec.nx - 1) / 2) * dx; c.position.z += (j - (spec.nz - 1) / 2) * dz; o.add(c); } }
      else if (T === 'group') { o = new THREE.Group(); spec.parts.forEach((p) => o.add(node(p))); }
      else if (T === 'char') { const ch = makeChar(spec.id); chars.push(ch); o = new THREE.Group(); o.add(ch.root); }
      else { o = new THREE.Group(); }
      return place(o, spec);
    }
    const root = new THREE.Group();
    recipe.parts.forEach((p) => root.add(node(p)));
    return { root, anims, chars, footprint: recipe.footprint || 2.5, height: recipe.height || 3 };
  }

  return { build, PATTERNS };
}

// Takımada · karakter tarifleri (görünümden bağımsız: renkler ROL adıdır)
// Şema: TAKIMADA.md §5. Her tarif JSON uyumludur; editör ileride bu dosyayı okuyup yazacak.
// paint: { color: 'rol' } ya da { pattern: 'ad', colors: ['zemin', 'desen', …], repeat: [x, y] }

window.KUTUPHANE = window.KUTUPHANE || {};
window.KUTUPHANE.karakterler = [
  // ---------------- Oyuncu ----------------
  { id: 'char.traveler', version: 1, kind: 'character', name: 'Traveler', role: 'player · the "you" walking the island', place: 'hub',
    parts: { body: { shape: 'column', paint: { pattern: 'stripe', colors: ['paper', 'ink'], repeat: [1, 2] } }, neck: { height: 0.06 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', cheeks: true },
             arms: { type: 'pegs' }, hat: { type: 'pompom', paint: { color: 'ink' } }, extras: [{ type: 'scarf', paint: { color: 'hot' } }] },
    motion: { personality: 'bouncy' }, notes: 'Mercan atkı = "şimdi / sen". Adadaki tek sürekli mercan nesne.' },

  { id: 'char.keeper', version: 1, kind: 'character', name: 'Keeper', role: 'keeper of the lighthouse · host of the island', place: 'hub',
    parts: { body: { shape: 'barrel', paint: { pattern: 'sailor', colors: ['paper', 'cool', 'hot'] } }, neck: { height: 0.05 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'dot', mustache: true, mouth: false, cheeks: true },
             arms: { type: 'pegs' }, held: { type: 'lantern' }, hat: { type: 'sailor' } },
    motion: { personality: 'calm' } },

  // ---------------- 01 Orchestra · bando ----------------
  { id: 'char.conductor', version: 1, kind: 'character', name: 'Conductor', role: '01 · band conductor', place: '01',
    parts: { body: { shape: 'hourglass', paint: { pattern: 'buttons', colors: ['ink', 'paper', 'hot'] } }, neck: { height: 0.07 },
             head: { shape: 'drop', paint: { color: 'paper' } }, face: { eyes: 'ring', mustache: true, mouth: false },
             arms: { type: 'pegs', pose: 'up' }, held: { type: 'baton' }, hat: { type: 'top', paint: { color: 'ink' } } },
    motion: { personality: 'proud' } },
  { id: 'char.band.bells', version: 1, kind: 'character', name: 'Bell Ringer', role: '01 · band · bell family (keys 1–0)', place: '01',
    parts: { body: { shape: 'bell', paint: { pattern: 'harl', colors: ['paper', 'ink', 'hot', 'mid'], repeat: [2, 2] } }, neck: { height: 0.06 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', cheeks: true },
             arms: { type: 'pegs' }, held: { type: 'bell' }, hat: { type: 'cone', paint: { color: 'ink' } } },
    motion: { personality: 'bouncy' } },
  { id: 'char.band.brass', version: 1, kind: 'character', name: 'Tuba Player', role: '01 · band · brass family (Q–P)', place: '01',
    parts: { body: { shape: 'barrel', paint: { color: 'ink' } }, neck: { height: 0.05 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', mouth: 'o' },
             arms: { type: 'pegs', pose: 'front' }, held: { type: 'tuba' }, hat: { type: 'cap', paint: { color: 'cool' } } },
    motion: { personality: 'calm' } },
  { id: 'char.band.strings', version: 1, kind: 'character', name: 'String Player', role: '01 · band · string family (A–L)', place: '01',
    parts: { body: { shape: 'pear', paint: { pattern: 'ribs', colors: ['wood', 'ink'] } }, neck: { height: 0.07 },
             head: { shape: 'acorn', paint: { color: 'paper' } }, face: { eyes: 'sleepy', mouth: 'smile' },
             arms: { type: 'pegs', pose: 'front' }, held: { type: 'uke' }, hat: { type: 'beret', paint: { color: 'hot' } } },
    motion: { personality: 'sleepy' } },
  { id: 'char.band.drums', version: 1, kind: 'character', name: 'Drummer', role: '01 · band · drum family (Z–M)', place: '01',
    parts: { body: { shape: 'block', paint: { pattern: 'checker', colors: ['paper', 'ink'] } }, neck: { height: 0.05 },
             head: { shape: 'box', paint: { color: 'warm' } }, face: { eyes: 'wide', mouth: 'smile' },
             arms: { type: 'pegs', pose: 'front' }, held: { type: 'drum' }, hat: { type: 'pompom', paint: { color: 'ink' } } },
    motion: { personality: 'jittery' } },

  // ---------------- 02 Owl Forest ----------------
  { id: 'char.owl', version: 1, kind: 'character', name: 'Owl', role: '02 · the forest folk (45 of them, varied by pattern and size)', place: '02',
    parts: { body: { shape: 'pear', paint: { pattern: 'feathers', colors: ['wood', 'paper'] } },
             head: { shape: 'owl', paint: { color: 'wood' } }, face: { eyes: 'wide', brows: false, mouth: 'beak', gap: 0.07 },
             ears: { shape: 'tufts', paint: { color: 'wood' } }, arms: { type: 'wings', paint: { color: 'wood' } } },
    motion: { personality: 'calm' }, notes: 'Baş gövdeden önce döner (overlapping action) — 02 oyununda.' },
  { id: 'char.owl.snow', version: 1, kind: 'character', name: 'Snowy Owl', role: '02 · variation', place: '02',
    parts: { body: { shape: 'pear', paint: { pattern: 'feathers', colors: ['paper', 'ink'] } },
             head: { shape: 'owl', paint: { color: 'paper' } }, face: { eyes: 'ring', brows: false, mouth: 'beak', gap: 0.07 },
             ears: { shape: 'tufts', paint: { color: 'paper' } }, arms: { type: 'wings', paint: { color: 'paper' } } },
    motion: { personality: 'sleepy' }, scale: 0.85 },

  // ---------------- 03 Clock Tower ----------------
  { id: 'char.clockmaker', version: 1, kind: 'character', name: 'Clockmaker', role: '03 · winds the dial, turns the hand', place: '03',
    parts: { body: { shape: 'cone', paint: { pattern: 'band', colors: ['cool', 'paper', 'warm', 'paper'] } }, neck: { height: 0.06 },
             head: { shape: 'disk', paint: { color: 'paper' } }, face: { clock: true, eyes: 'dot', mouth: 'line', gap: 0.06, y: 0.03 },
             arms: { type: 'pegs' }, held: { type: 'key' } },
    motion: { personality: 'jittery' }, notes: 'Yüzü saat kadranı: iki göz + iki ibre.' },

  // ---------------- 04 Haunted Pier ----------------
  { id: 'char.ghost', version: 1, kind: 'character', name: 'Ghost', role: '04 · you, three seconds ago', place: '04',
    parts: { body: { shape: 'ghost', paint: { pattern: 'ghost', colors: ['paper', 'ink'] } },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'dot', brows: false, mouth: 'o' }, arms: { type: 'none' } },
    motion: { personality: 'floaty' } },
  { id: 'char.captain', version: 1, kind: 'character', name: 'Captain', role: '04 · keeper of the pier', place: '04',
    parts: { body: { shape: 'block', paint: { pattern: 'stripe', colors: ['paper', 'cool'], repeat: [1, 2] } }, neck: { height: 0.06 },
             head: { shape: 'flat', paint: { color: 'paper' } }, face: { eyes: 'wink', mustache: true, mouth: false },
             arms: { type: 'pegs' }, held: { type: 'net' }, hat: { type: 'cap', paint: { color: 'ink' } } },
    motion: { personality: 'proud' } },

  // ---------------- 05 The Beach ----------------
  { id: 'char.sandkid', version: 1, kind: 'character', name: 'Sand Kid', role: '05 · bucket, spade, tide', place: '05',
    parts: { body: { shape: 'bell', paint: { pattern: 'waves', colors: ['paper', 'cool'] } }, neck: { height: 0.05 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', cheeks: true, mouth: 'smile' },
             arms: { type: 'pegs' }, held: { type: 'bucket' }, hat: { type: 'sun', paint: { color: 'warm' } } },
    motion: { personality: 'bouncy' }, scale: 0.85 },

  // ---------------- 06 Weather Station ----------------
  { id: 'char.forecaster', version: 1, kind: 'character', name: 'Forecaster', role: '06 · measures the rain, never forgets the umbrella', place: '06',
    parts: { body: { shape: 'cone', paint: { pattern: 'dots', colors: ['warm', 'ink'] } }, neck: { height: 0.06 },
             head: { shape: 'drop', paint: { pattern: 'diag', colors: ['paper', 'ink'], repeat: [3, 1] } }, face: { eyes: 'ring', mask: true, brows: false, mouth: false },
             arms: { type: 'pegs', pose: 'up' }, held: { type: 'umbrella', paint: { pattern: 'stripe', colors: ['paper', 'cool'] } } },
    motion: { personality: 'calm' } },

  // ---------------- 07 Town Square ----------------
  { id: 'char.towner.a', version: 1, kind: 'character', name: 'Towner · Pink', role: '07 · the crowd of the square', place: '07',
    parts: { body: { shape: 'hourglass', paint: { color: 'pink' } }, neck: { height: 0.05 },
             head: { shape: 'cat', paint: { color: 'paper' } }, ears: { shape: 'cat', paint: { color: 'pink' } }, face: { eyes: 'ring', mask: true, brows: false, mouth: false },
             arms: { type: 'pegs' }, extras: [{ type: 'bow', paint: { color: 'warm' } }] },
    motion: { personality: 'bouncy' } },
  { id: 'char.towner.b', version: 1, kind: 'character', name: 'Towner · Night Cat', role: '07 · the crowd of the square', place: '07',
    parts: { body: { shape: 'block', paint: { pattern: 'fur', colors: ['ink', 'paper'] } }, neck: { height: 0.04 },
             head: { shape: 'cat', paint: { color: 'ink' } }, ears: { shape: 'cat' }, face: { eyes: 'ring', nose: true, mouth: false } },
    motion: { personality: 'calm' } },
  { id: 'char.towner.c', version: 1, kind: 'character', name: 'Towner · Rabbit', role: '07 · the crowd of the square', place: '07',
    parts: { body: { shape: 'bell', paint: { pattern: 'checker', colors: ['paper', 'green'] } }, neck: { height: 0.05 },
             head: { shape: 'ball', paint: { color: 'paper' } }, ears: { shape: 'rabbit', paint: { color: 'paper' } }, face: { eyes: 'dot', cheeks: true, mouth: 'smile' },
             arms: { type: 'pegs' }, held: { type: 'book' } },
    motion: { personality: 'jittery' }, scale: 0.9 },

  // ---------------- 08 Greenhouse ----------------
  { id: 'char.gardener', version: 1, kind: 'character', name: 'Gardener', role: '08 · guardian of the plant that grows in silence', place: '08',
    parts: { body: { shape: 'bell', paint: { pattern: 'apron', colors: ['paper', 'green', 'warm'] } }, neck: { height: 0.06 },
             head: { shape: 'acorn', paint: { color: 'paper' } }, face: { eyes: 'sleepy', cheeks: true, mouth: 'line' },
             arms: { type: 'pegs' }, held: { type: 'can' }, hat: { type: 'leaf' } },
    motion: { personality: 'sleepy' } }
];

// Takımada · ada sakinleri (oyun alanlarına bağlı olmayan karakterler)
// Girard referanslarından, atlas sokağındaki bebeklerden ve kendi dilimizden. Şema: TAKIMADA.md §5.

window.KUTUPHANE = window.KUTUPHANE || {};
window.KUTUPHANE.karakterler = window.KUTUPHANE.karakterler || [];
window.KUTUPHANE.karakterler.push(
  // ---- Atlas / sokak sahnesindeki bebekler (girard-kit'ten bu şemaya çevrildi) ----
  { id: 'char.feathertall', version: 1, kind: 'character', name: 'Tall Feather', role: 'islander · a plume of feathers on top', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bottle', paint: { pattern: 'blocks', colors: ['paper', 'ink', 'cool', 'hot'] } }, neck: { height: 0.18, paint: { color: 'warm' } },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', cheeks: true }, extras: [{ type: 'feather' }] },
    motion: { personality: 'proud' } },
  { id: 'char.harlequin', version: 1, kind: 'character', name: 'Harlequin', role: 'islander · wanders at the foot of the lighthouse', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bell', paint: { pattern: 'harl', colors: ['paper', 'ink', 'hot', 'mid'], repeat: [2, 2] } }, neck: { height: 0.08 },
             head: { shape: 'drop', paint: { pattern: 'harl', colors: ['paper', 'hot', 'ink', 'paper'], repeat: [3, 1] } }, face: { eyes: 'dot', mask: true, brows: false, mouth: false } },
    motion: { personality: 'calm' } },
  { id: 'char.zebra', version: 1, kind: 'character', name: 'Zebra Drop', role: 'islander · striped drop head', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'column', paint: { pattern: 'spiral', colors: ['pink', 'ink', 'hot'] } }, neck: { height: 0.08 },
             head: { shape: 'drop', paint: { pattern: 'diag', colors: ['paper', 'ink'], repeat: [3, 1] } }, face: { eyes: 'ring', mask: true, brows: false, mouth: false } },
    motion: { personality: 'calm' }, scale: 1.05 },
  { id: 'char.sleepysun', version: 1, kind: 'character', name: 'Sleepy Sun', role: 'islander · always sleepy in the afternoon', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bell', paint: { pattern: 'zig', colors: ['paper', 'cool'], repeat: [2, 1] } }, neck: { height: 0.08 },
             head: { shape: 'ball', paint: { color: 'hot' } }, face: { eyes: 'sleepy', mouth: 'o' } },
    motion: { personality: 'sleepy' } },
  { id: 'char.ember', version: 1, kind: 'character', name: 'Ember', role: 'islander · little red rascal', place: 'ada', tags: ['ahali', 'girard', 'yaratık'],
    parts: { body: { shape: 'hourglass', paint: { pattern: 'buttons', colors: ['hot', 'ink', 'ink'] } }, neck: { height: 0.06, paint: { color: 'hot' } },
             head: { shape: 'cat', paint: { color: 'hot' } }, ears: { shape: 'cat', paint: { color: 'ink' } }, face: { eyes: 'ring', mouth: 'smile' },
             extras: [{ type: 'tail', paint: { color: 'hot' } }] },
    motion: { personality: 'jittery' } },
  { id: 'char.partycone', version: 1, kind: 'character', name: 'Party Cone', role: 'islander · in the square on holidays', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bell', paint: { pattern: 'band', colors: ['paper', 'cool', 'green', 'hot'] } }, neck: { height: 0.08 },
             head: { shape: 'spike', paint: { color: 'pink' } }, face: { eyes: 'dot', mask: true, y: -0.02 } },
    motion: { personality: 'bouncy' } },
  { id: 'char.owlkeeper', version: 1, kind: 'character', name: 'Owl Keeper', role: 'islander · sits at the edge of the forest', place: 'ada', tags: ['ahali', 'girard', 'hayvan'],
    parts: { body: { shape: 'block', paint: { pattern: 'fur', colors: ['wood', 'paper'] } }, neck: { height: 0.06 },
             head: { shape: 'flat', paint: { pattern: 'fur', colors: ['wood', 'paper'], repeat: [2, 1] } }, face: { eyes: 'ring', nose: true, mouth: false } },
    motion: { personality: 'calm' } },
  { id: 'char.stripecolumn', version: 1, kind: 'character', name: 'Striped Column', role: 'islander · tall and quiet', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'column', paint: { pattern: 'stripe', colors: ['paper', 'warm'], repeat: [1, 2] } }, neck: { height: 0.08 },
             head: { shape: 'drop', paint: { pattern: 'dots', colors: ['paper', 'ink'], repeat: [3, 1] } }, face: { eyes: 'dot', cheeks: true } },
    motion: { personality: 'calm' } },

  // ---- Girard referanslarından türeyen yeni sakinler ----
  { id: 'char.redface', version: 1, kind: 'character', name: 'Red Face', role: 'islander · the startled singer', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bell', paint: { pattern: 'chevron', colors: ['paper', 'cool', 'ink'] } }, neck: { height: 0.12, paint: { color: 'paper' } },
             head: { shape: 'ball', paint: { color: 'hot' } }, face: { eyes: 'closed', brows: false, mouth: 'o' }, arms: { type: 'pegs', paint: { color: 'hot' } } },
    motion: { personality: 'proud' } },
  { id: 'char.catcoat', version: 1, kind: 'character', name: 'Cat Coat', role: 'islander · carries a cat on the coat', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'hourglass', paint: { pattern: 'catpatch', colors: ['paper', 'ink', 'warm'] } }, neck: { height: 0.1, paint: { color: 'ink' } },
             head: { shape: 'drop', paint: { pattern: 'stripe', colors: ['paper', 'ink'], repeat: [1, 4] } }, face: { eyes: 'dot', mask: 'paper', brows: false, mouth: false } },
    motion: { personality: 'calm' }, scale: 1.1 },
  { id: 'char.spiral', version: 1, kind: 'character', name: 'Spiral', role: 'islander · upright as a totem', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'column', paint: { pattern: 'spiral', colors: ['paper', 'ink', 'warm'] } },
             head: { shape: 'drop', paint: { pattern: 'stripe', colors: ['paper', 'ink'], repeat: [1, 5] } }, face: { eyes: false, brows: false, mouth: false } },
    motion: { personality: 'calm' }, scale: 1.15 },
  { id: 'char.yarncat', version: 1, kind: 'character', name: 'Yarn Cat', role: 'islander · never lets go of the yarn', place: 'ada', tags: ['ahali', 'girard', 'hayvan'],
    parts: { body: { shape: 'column', paint: { pattern: 'yarn', colors: ['ink', 'ink', 'paper'] } }, neck: { height: 0.05, paint: { color: 'ink' } },
             head: { shape: 'cat', paint: { color: 'ink' } }, ears: { shape: 'cat', paint: { color: 'ink' } }, face: { eyes: 'ring', nose: true, mouth: false } },
    motion: { personality: 'sleepy' } },
  { id: 'char.clown', version: 1, kind: 'character', name: 'Clown', role: 'islander · pink cone hat, zigzag collar', place: 'ada', tags: ['ahali', 'girard'],
    parts: { body: { shape: 'bell', paint: { pattern: 'band', colors: ['paper', 'cool', 'green', 'hot'] } }, neck: { height: 0.12, paint: { color: 'paper' } },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'dot', mask: true, mouth: 'smile' }, arms: { type: 'pegs', paint: { color: 'ink' } },
             hat: { type: 'cone', paint: { color: 'pink' } }, extras: [{ type: 'collar', paint: { color: 'green' } }] },
    motion: { personality: 'bouncy' } },

  // ---- Kendi dilimizden: meslekler, hayvanlar, tuhaflar ----
  { id: 'char.baker', version: 1, kind: 'character', name: 'Baker', role: 'islander · first one up in the morning', place: 'ada', tags: ['ahali', 'meslek'],
    parts: { body: { shape: 'barrel', paint: { pattern: 'apron', colors: ['paper', 'wood', 'hot'] } }, neck: { height: 0.05 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'closed', cheeks: true, mustache: true, mouth: false },
             arms: { type: 'pegs' }, held: { type: 'bread' }, hat: { type: 'chef', paint: { color: 'paper' } } },
    motion: { personality: 'calm' } },
  { id: 'char.librarian', version: 1, kind: 'character', name: 'Librarian', role: 'islander · bespectacled, reads everything', place: 'ada', tags: ['ahali', 'meslek'],
    parts: { body: { shape: 'cone', paint: { pattern: 'buttons', colors: ['green', 'ink', 'paper'] } }, neck: { height: 0.07 },
             head: { shape: 'acorn', paint: { color: 'paper' } }, face: { eyes: 'dot', glasses: true, mouth: 'line' },
             arms: { type: 'pegs' }, held: { type: 'book', paint: { color: 'hot' } }, hat: { type: 'beret', paint: { color: 'cool' } } },
    motion: { personality: 'sleepy' } },
  { id: 'char.postie', version: 1, kind: 'character', name: 'Postie', role: 'islander · carries letters between islands', place: 'ada', tags: ['ahali', 'meslek'],
    parts: { body: { shape: 'hourglass', paint: { pattern: 'buttons', colors: ['cool', 'paper', 'warm'] } }, neck: { height: 0.06 },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'ring', cheeks: true },
             arms: { type: 'pegs' }, held: { type: 'letter' }, hat: { type: 'cap', paint: { color: 'cool' } } },
    motion: { personality: 'bouncy' } },
  { id: 'char.detective', version: 1, kind: 'character', name: 'Detective', role: 'islander · on the trail of lost footprints', place: 'ada', tags: ['ahali', 'meslek'],
    parts: { body: { shape: 'block', paint: { pattern: 'checker', colors: ['wood', 'ink'] } }, neck: { height: 0.05 },
             head: { shape: 'box', paint: { color: 'paper' } }, face: { eyes: 'wink', mustache: true, mouth: false },
             arms: { type: 'pegs', pose: 'front' }, held: { type: 'glass' }, hat: { type: 'cap', paint: { color: 'wood' } } },
    motion: { personality: 'proud' } },
  { id: 'char.frog', version: 1, kind: 'character', name: 'Frog', role: 'islander · on the stones by the shore', place: 'ada', tags: ['ahali', 'hayvan'],
    parts: { body: { shape: 'pear', paint: { pattern: 'dots', colors: ['green', 'paper'] } },
             head: { shape: 'owl', paint: { color: 'green' } }, face: { eyes: 'wide', brows: false, mouth: 'smile', gap: 0.09, y: 0.04 }, arms: { type: 'pegs', paint: { color: 'green' } } },
    motion: { personality: 'jittery' }, scale: 0.85 },
  { id: 'char.bear', version: 1, kind: 'character', name: 'Bear', role: 'islander · beekeeper', place: 'ada', tags: ['ahali', 'hayvan'],
    parts: { body: { shape: 'barrel', paint: { pattern: 'fur', colors: ['wood', 'ink'] } }, neck: { height: 0.04, paint: { color: 'wood' } },
             head: { shape: 'ball', paint: { color: 'wood' } }, ears: { shape: 'round', paint: { color: 'wood' } }, face: { eyes: 'dot', nose: true, mouth: 'line' },
             arms: { type: 'pegs', paint: { color: 'wood' } } },
    motion: { personality: 'calm' }, scale: 1.1 },
  { id: 'char.fox', version: 1, kind: 'character', name: 'Fox', role: 'islander · talks with its tail', place: 'ada', tags: ['ahali', 'hayvan'],
    parts: { body: { shape: 'hourglass', paint: { pattern: 'stripe', colors: ['warm', 'paper'] } }, neck: { height: 0.06, paint: { color: 'paper' } },
             head: { shape: 'drop', paint: { color: 'warm' } }, ears: { shape: 'cat', paint: { color: 'warm' } }, face: { eyes: 'ring', mask: 'paper', brows: false, nose: true, mouth: false },
             extras: [{ type: 'tail', paint: { color: 'warm' } }] },
    motion: { personality: 'jittery' } },
  { id: 'char.snowman', version: 1, kind: 'character', name: 'Snowman', role: 'islander · comes in winter', place: 'ada', tags: ['ahali', 'mevsim'],
    parts: { body: { shape: 'barrel', paint: { color: 'paper' } },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'dot', nose: true, mouth: 'smile', cheeks: true }, arms: { type: 'pegs', paint: { color: 'wood' } },
             hat: { type: 'top', paint: { color: 'ink' } }, extras: [{ type: 'scarf', paint: { color: 'cool' } }] },
    motion: { personality: 'calm' } },
  { id: 'char.mushroom', version: 1, kind: 'character', name: 'Mushroom', role: 'islander · comes out after the rain', place: 'ada', tags: ['ahali', 'doğa'],
    parts: { body: { shape: 'barrel', paint: { color: 'paper' } },
             head: { shape: 'acorn', paint: { color: 'paper' } }, face: { eyes: 'sleepy', cheeks: true, mouth: 'o' }, hat: { type: 'mushroom' } },
    motion: { personality: 'sleepy' }, scale: 0.8 },
  { id: 'char.moon', version: 1, kind: 'character', name: 'Old Moon', role: 'islander · only seen at night', place: 'ada', tags: ['ahali', 'gök'],
    parts: { body: { shape: 'cone', paint: { pattern: 'stars', colors: ['ink', 'warm'] } }, neck: { height: 0.05, paint: { color: 'ink' } },
             head: { shape: 'disk', paint: { color: 'warm' } }, face: { eyes: 'sleepy', mouth: 'smile', cheeks: true } },
    motion: { personality: 'floaty' } },
  { id: 'char.cactus', version: 1, kind: 'character', name: 'Cactus', role: 'islander · waits at the greenhouse door', place: 'ada', tags: ['ahali', 'doğa'],
    parts: { body: { shape: 'column', paint: { pattern: 'ribs', colors: ['green', 'ink'] } },
             head: { shape: 'acorn', paint: { pattern: 'ribs', colors: ['green', 'ink'] } }, face: { eyes: 'dot', mouth: 'smile' }, arms: { type: 'pegs', pose: 'up', paint: { color: 'green' } },
             held: { type: 'flower' } },
    motion: { personality: 'proud' } },
  { id: 'char.robot', version: 1, kind: 'character', name: 'Box Bot', role: 'islander · built from an old radio', place: 'ada', tags: ['ahali', 'tuhaf'],
    parts: { body: { shape: 'block', paint: { pattern: 'buttons', colors: ['cool', 'ink', 'hot'] } }, neck: { height: 0.06, paint: { color: 'ink' } },
             head: { shape: 'box', paint: { color: 'paper' } }, face: { eyes: 'wide', brows: false, mouth: 'line' }, arms: { type: 'pegs', pose: 'front', paint: { color: 'ink' } },
             hat: { type: 'antenna', paint: { color: 'hot' } } },
    motion: { personality: 'jittery' } },
  { id: 'char.crowned', version: 1, kind: 'character', name: 'Crowned', role: 'islander · thinks it is queen of the island', place: 'ada', tags: ['ahali', 'tuhaf'],
    parts: { body: { shape: 'bell', paint: { pattern: 'harl', colors: ['pink', 'hot', 'paper', 'warm'], repeat: [2, 2] } }, neck: { height: 0.1, paint: { color: 'paper' } },
             head: { shape: 'ball', paint: { color: 'paper' } }, face: { eyes: 'closed', cheeks: true, mouth: 'smile' }, hat: { type: 'crown', paint: { color: 'warm' } } },
    motion: { personality: 'proud' } },
  { id: 'char.bee', version: 1, kind: 'character', name: 'Bee', role: 'islander · counts the greenhouse flowers', place: 'ada', tags: ['ahali', 'hayvan'],
    parts: { body: { shape: 'barrel', paint: { pattern: 'stripe', colors: ['warm', 'ink'] } },
             head: { shape: 'ball', paint: { color: 'ink' } }, face: { eyes: 'ring', brows: false, mouth: false }, arms: { type: 'wings', paint: { color: 'paper' } },
             hat: { type: 'antenna', paint: { color: 'warm' } } },
    motion: { personality: 'floaty' }, scale: 0.8 }
);

// Etiketler: oyun alanı karakterlerine tür etiketi (sakinlerde zaten var)
(function () {
  const T = {
    'char.traveler': ['oyuncu'], 'char.keeper': ['merkez', 'meslek'], 'char.conductor': ['mekân', 'bando', 'meslek'],
    'char.band.bells': ['mekân', 'bando'], 'char.band.brass': ['mekân', 'bando'], 'char.band.strings': ['mekân', 'bando'], 'char.band.drums': ['mekân', 'bando'],
    'char.owl': ['mekân', 'hayvan'], 'char.owl.snow': ['mekân', 'hayvan'], 'char.clockmaker': ['mekân', 'meslek'], 'char.ghost': ['mekân', 'ruh'],
    'char.captain': ['mekân', 'meslek'], 'char.sandkid': ['mekân'], 'char.forecaster': ['mekân', 'meslek'],
    'char.towner.a': ['mekân', 'ahali', 'hayvan'], 'char.towner.b': ['mekân', 'ahali', 'hayvan'], 'char.towner.c': ['mekân', 'ahali', 'hayvan'], 'char.gardener': ['mekân', 'meslek']
  };
  window.KUTUPHANE.karakterler.forEach((r) => { if (!r.tags) r.tags = T[r.id] || []; });
})();

// Takımada · mekân tarifleri (Interaction Island: deniz feneri + 8 premise mekânı)
// Yerel koordinat: zemin y = 0, mekânın ortası (0, 0); +z kameraya bakan ön. Renkler rol adıdır.
// Şema: TAKIMADA.md §5 · parça türleri: kutuphane/yapilar.js başlığı.

window.KUTUPHANE = window.KUTUPHANE || {};
(function () {
  // ---- küçük yardımcılar (tarif yazımını kısaltır; çıktı yine düz JSON) ----
  const lamp = (x, z, h = 1.3) => ({ type: 'group', at: [x, 0, z], parts: [
    { type: 'cyl', r: 0.035, h, at: [0, h / 2, 0], paint: { color: 'ink' } },
    { type: 'box', size: [0.18, 0.22, 0.18], at: [0, h + 0.1, 0], paint: { color: 'paper' }, emit: 0.5 },
    { type: 'cone', r: 0.16, h: 0.12, seg: 4, at: [0, h + 0.27, 0], rot: [0, Math.PI / 4, 0], paint: { color: 'ink' } } ] });
  const tree = (x, z, h = 1.6, pat = 'diag', cols = ['green', 'ink'], kind = 'cone') => ({ type: 'group', at: [x, 0, z], parts: [
    { type: 'cyl', r: 0.07, rTop: 0.05, h: 0.5, at: [0, 0.25, 0], paint: { color: 'wood' } },
    kind === 'cone' ? { type: 'cone', r: h * 0.28, h, at: [0, 0.45 + h / 2, 0], paint: { pattern: pat, colors: cols, repeat: [3, 2] } }
                    : { type: 'lathe', profile: [[0, 0], [h * 0.22, h * 0.08], [h * 0.27, h * 0.28], [h * 0.17, h * 0.62], [0, h]], at: [0, 0.4, 0], paint: { pattern: pat, colors: cols, repeat: [3, 2] } } ] });
  const house = (x, z, w, d, h, wall, roof, ry = 0) => ({ type: 'group', at: [x, 0, z], rot: [0, ry, 0], parts: [
    { type: 'box', size: [w, h, d], at: [0, h / 2, 0], paint: { pattern: 'window', colors: wall } },
    { type: 'gable', w: w + 0.16, d: d + 0.16, at: [0, h, 0], paint: { pattern: 'stripe', colors: roof, repeat: [1, 3] } },
    { type: 'box', size: [0.14, 0.42, 0.14], at: [w * 0.25, h + 0.32, -d * 0.15], paint: { color: roof[0] } } ] });
  const disk = (r, h, paint, seg) => ({ type: 'cyl', r, h, seg, at: [0, h / 2, 0], paint, shadow: false });

  window.KUTUPHANE.mekanlar = [
    // ======================================================================
    { id: 'place.lighthouse', version: 1, kind: 'place', place: 'hub', name: 'Lighthouse', premise: 'Hub', promise: 'The tiny lighthouse that keeps the whole island running; every place you light adds a light to it.',
      footprint: 2.2, height: 4.8,
      parts: [
        { type: 'lathe', profile: [[0, 0], [1.6, 0], [1.55, 0.18], [1.25, 0.38], [0, 0.42]], paint: { pattern: 'rock', colors: ['mid', 'ink'], repeat: [4, 1] } },
        { type: 'lathe', at: [0, 0.4, 0], profile: [[0, 0], [0.75, 0], [0.66, 0.3], [0.48, 2.8], [0.55, 2.9], [0, 2.9]], paint: { pattern: 'harl', colors: ['paper', 'ink', 'hot', 'mid'], repeat: [3, 3] } },
        { type: 'cyl', r: 0.72, h: 0.06, at: [0, 3.33, 0], paint: { color: 'ink' } },
        { type: 'ring', count: 16, radius: 0.67, part: { type: 'cyl', r: 0.014, h: 0.26, at: [0, 3.48, 0], paint: { color: 'ink' } } },
        { type: 'torus', r: 0.67, tube: 0.014, at: [0, 3.6, 0], rot: [Math.PI / 2, 0, 0], paint: { color: 'ink' } },
        { type: 'cyl', r: 0.4, h: 0.5, at: [0, 3.61, 0], paint: { pattern: 'glass', colors: ['paper', 'ink'], repeat: [4, 1] }, emit: 0.35 },
        { type: 'box', size: [0.7, 0.08, 0.14], at: [0, 3.62, 0], paint: { color: 'warm' }, emit: 0.6, anim: { spin: 1.2 } },
        { type: 'cone', r: 0.58, h: 0.7, at: [0, 4.21, 0], paint: { color: 'hot' } },
        { type: 'sphere', r: 0.07, at: [0, 4.6, 0], paint: { color: 'ink' } },
        house(1.35, 0.55, 1.0, 0.8, 0.7, ['paper', 'ink', 'cool', 'hot'], ['hot', 'paper'], -0.5),
        { type: 'char', id: 'char.keeper', at: [-0.95, 0.42, 1.05], rot: [0, 0.4, 0] }
      ] },
    // ======================================================================
    { id: 'place.orchestra', version: 1, kind: 'place', place: '01', name: 'Bandstand', premise: 'Agency', promise: 'Participation can be designed.', game: 'Key Orchestra',
      footprint: 2.3, height: 3.6,
      parts: [
        { type: 'cyl', r: 2.0, h: 0.3, seg: 8, at: [0, 0.15, 0], rot: [0, Math.PI / 8, 0], paint: { pattern: 'planks', colors: ['wood', 'ink'], repeat: [2, 2] } },
        { type: 'box', size: [2.6, 0.02, 1.0], at: [0, 0.31, 0.25], paint: { pattern: 'keys', colors: ['paper', 'ink'] } },
        { type: 'box', size: [1.0, 0.15, 0.35], at: [0, 0.075, 2.05], paint: { color: 'wood' } },
        { type: 'ring', count: 8, radius: 1.82, start: Math.PI / 8, part: { type: 'cyl', r: 0.07, h: 1.8, at: [0, 1.2, 0], paint: { pattern: 'stripe', colors: ['paper', 'hot'], repeat: [1, 4] } } },
        { type: 'torus', r: 2.05, tube: 0.05, at: [0, 2.1, 0], rot: [Math.PI / 2, 0, 0], paint: { color: 'ink' } },
        { type: 'cone', r: 2.3, h: 1.1, seg: 8, at: [0, 2.65, 0], rot: [0, Math.PI / 8, 0], paint: { pattern: 'bars', colors: ['paper', 'hot'], repeat: [4, 1] } },
        { type: 'cyl', r: 0.02, h: 0.5, at: [0, 3.4, 0], paint: { color: 'ink' } },
        { type: 'box', size: [0.32, 0.18, 0.02], at: [0.17, 3.55, 0], paint: { color: 'warm' }, anim: { swing: 0.25, speed: 3 } },
        { type: 'char', id: 'char.conductor', at: [0, 0.3, 0.95], rot: [0, Math.PI, 0] },
        { type: 'char', id: 'char.band.bells', at: [-1.05, 0.3, -0.45], rot: [0, 0.3, 0], scale: 0.9 },
        { type: 'char', id: 'char.band.brass', at: [-0.38, 0.3, -0.8], scale: 0.9 },
        { type: 'char', id: 'char.band.strings', at: [0.38, 0.3, -0.8], scale: 0.9 },
        { type: 'char', id: 'char.band.drums', at: [1.05, 0.3, -0.45], rot: [0, -0.3, 0], scale: 0.9 }
      ] },
    // ======================================================================
    { id: 'place.owlforest', version: 1, kind: 'place', place: '02', name: 'Owl Forest', premise: 'Reciprocity', promise: 'Design the dialogue, not the message.', game: 'Eye Field',
      footprint: 2.6, height: 2.6,
      parts: [
        disk(2.6, 0.08, { pattern: 'grass', colors: ['green', 'ink'], repeat: [3, 3] }),
        { type: 'ring', count: 9, radius: 2.25, part: tree(0, 0, 1.7, 'diag', ['green', 'ink']) },
        { type: 'ring', count: 7, radius: 2.55, start: 0.35, part: tree(0, 0, 1.3, 'fur', ['ink', 'paper'], 'drop') },
        { type: 'grid', nx: 3, nz: 2, step: [0.85, 0.9], at: [0, 0.08, -0.1], part: { type: 'group', parts: [
          { type: 'cyl', r: 0.22, rTop: 0.2, h: 0.28, at: [0, 0.14, 0], paint: { pattern: 'ribs', colors: ['wood', 'ink'] } },
          { type: 'char', id: 'char.owl', at: [0, 0.28, 0], scale: 0.75 } ] } },
        lamp(1.3, 1.3),
        { type: 'char', id: 'char.owlkeeper', at: [-1.2, 0.08, 1.3], rot: [0, 0.5, 0], scale: 0.9 }
      ] },
    // ======================================================================
    { id: 'place.clocktower', version: 1, kind: 'place', place: '03', name: 'Clock Tower', premise: 'Feedback', promise: 'Design the feedback loop, not the outcome.', game: 'Mini Sequencer',
      footprint: 1.8, height: 4.6,
      parts: [
        { type: 'box', size: [1.9, 0.3, 1.9], at: [0, 0.15, 0], paint: { pattern: 'cobbles', colors: ['mid', 'ink'], repeat: [2, 2] } },
        { type: 'box', size: [1.2, 2.6, 1.2], at: [0, 1.6, 0], paint: { pattern: 'bricks', colors: ['paper', 'ink'], repeat: [1, 2] } },
        { type: 'cyl', r: 0.46, h: 0.06, at: [0, 2.35, 0.62], rot: [Math.PI / 2, 0, 0], paint: { pattern: 'clockface', colors: ['paper', 'ink', 'hot'] } },
        { type: 'group', at: [0, 2.35, 0.66], anim: { spin: -0.25, axis: 'z' }, parts: [{ type: 'box', size: [0.045, 0.24, 0.02], at: [0, 0.1, 0], paint: { color: 'ink' } }] },
        { type: 'group', at: [0, 2.35, 0.67], anim: { spin: -1.5, axis: 'z' }, parts: [{ type: 'box', size: [0.03, 0.36, 0.02], at: [0, 0.16, 0], paint: { color: 'hot' } }] },
        { type: 'box', size: [1.32, 0.08, 1.32], at: [0, 2.94, 0], paint: { color: 'ink' } },
        { type: 'ring', count: 4, radius: 0.7, start: Math.PI / 4, part: { type: 'box', size: [0.12, 0.6, 0.12], at: [0, 3.28, 0], paint: { color: 'paper' } } },
        { type: 'group', at: [0, 3.5, 0], anim: { swing: 0.35, axis: 'z', speed: 2.2 }, parts: [
          { type: 'cyl', r: 0.01, h: 0.12, at: [0, -0.06, 0], paint: { color: 'ink' } },
          { type: 'cone', r: 0.2, h: 0.28, open: true, at: [0, -0.24, 0], paint: { color: 'warm' } } ] },
        { type: 'cone', r: 1.0, h: 1.0, seg: 4, at: [0, 4.08, 0], rot: [0, Math.PI / 4, 0], paint: { pattern: 'shingles', colors: ['cool', 'ink'], repeat: [2, 2] } },
        { type: 'sphere', r: 0.08, at: [0, 4.62, 0], paint: { color: 'hot' } },
        { type: 'char', id: 'char.clockmaker', at: [0.95, 0.3, 1.05], rot: [0, -0.5, 0] }
      ] },
    // ======================================================================
    { id: 'place.pier', version: 1, kind: 'place', place: '04', name: 'Haunted Pier', premise: 'Temporality', promise: 'Design time as much as space.', game: 'Ghost Chase',
      footprint: 2.6, height: 1.9, arena: { at: [0, 0.43, -1.6], w: 4.0, d: 2.6 },
      parts: [
        { type: 'box', size: [1.1, 0.1, 2.8], at: [0, 0.38, 0.9], paint: { pattern: 'planks', colors: ['wood', 'ink'], repeat: [1, 3] } },
        { type: 'box', size: [4.4, 0.1, 3.0], at: [0, 0.38, -1.6], paint: { pattern: 'planks', colors: ['wood', 'ink'], repeat: [3, 2] } }, // Ghost Chase sahası (arena)
        { type: 'row', count: 5, step: [0, 0, 0.7], at: [-0.55, 0, -0.1], part: { type: 'cyl', r: 0.06, h: 0.8, at: [0, 0.3, 0], paint: { color: 'ink' } } },
        { type: 'row', count: 5, step: [0, 0, 0.7], at: [0.55, 0, -0.1], part: { type: 'cyl', r: 0.06, h: 0.8, at: [0, 0.3, 0], paint: { color: 'ink' } } },
        { type: 'row', count: 6, step: [0.8, 0, 0], at: [-2.0, 0, -3.0], part: { type: 'cyl', r: 0.06, h: 0.8, at: [0, 0.3, 0], paint: { color: 'ink' } } },
        { type: 'group', at: [0, 0.43, 0], parts: [lamp(-2.05, -2.95, 1.0), lamp(2.05, -2.95, 1.0), lamp(-2.05, -0.25, 1.0), lamp(2.05, -0.25, 1.0)] },
        { type: 'group', at: [1.6, 0.06, 0.9], rot: [0, 0.5, 0], anim: { bob: 0.03, speed: 1.2 }, parts: [
          { type: 'box', size: [0.55, 0.22, 1.1], at: [0, 0.11, 0], paint: { pattern: 'stripe', colors: ['paper', 'hot'], repeat: [1, 2] } },
          { type: 'cone', r: 0.28, h: 0.4, seg: 4, at: [0, 0.11, 0.72], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.55], paint: { color: 'hot' } },
          { type: 'box', size: [0.5, 0.05, 0.16], at: [0, 0.24, 0], paint: { color: 'wood' } } ] },
        { type: 'char', id: 'char.ghost', at: [-0.4, 0.43, -1.35], rot: [0, 0.3, 0], anim: { bob: 0.05 } },
        { type: 'char', id: 'char.captain', at: [0.35, 0.43, 1.6], rot: [0, -0.3, 0] }
      ] },
    // ======================================================================
    { id: 'place.beach', version: 1, kind: 'place', place: '05', name: 'Beach', premise: 'Possibility', promise: 'Design the space of possibilities, not the object.', game: 'Sand Box',
      footprint: 2.6, height: 2.0,
      parts: [
        { type: 'cyl', r: 2.7, h: 0.03, at: [0.5, 0.015, 0.6], paint: { pattern: 'waves', colors: ['cool', 'paper'], repeat: [3, 3] }, shadow: false },
        disk(2.5, 0.1, { pattern: 'dots', colors: ['paper', 'warm'], repeat: [6, 6] }),
        { type: 'group', at: [-0.9, 0.1, -0.5], parts: [
          { type: 'cyl', r: 0.025, h: 1.6, at: [0, 0.8, 0], rot: [0, 0, 0.08], paint: { color: 'ink' } },
          { type: 'cone', r: 0.95, h: 0.38, seg: 8, at: [0.06, 1.62, 0], paint: { pattern: 'bars', colors: ['paper', 'hot'], repeat: [4, 1] } } ] },
        { type: 'group', at: [-0.4, 0.1, 0.2], rot: [0, 0.4, 0], parts: [
          { type: 'box', size: [0.45, 0.04, 0.7], at: [0, 0.2, 0], rot: [-0.25, 0, 0], paint: { pattern: 'stripe', colors: ['paper', 'cool'], repeat: [1, 2] } },
          { type: 'box', size: [0.45, 0.6, 0.04], at: [0, 0.45, -0.38], rot: [-0.35, 0, 0], paint: { pattern: 'stripe', colors: ['paper', 'cool'], repeat: [1, 2] } } ] },
        { type: 'group', at: [0.9, 0.1, -0.6], parts: [
          { type: 'box', size: [0.8, 0.3, 0.8], at: [0, 0.15, 0], paint: { pattern: 'dots', colors: ['warm', 'wood'], repeat: [2, 1] } },
          { type: 'ring', count: 4, radius: 0.5, start: Math.PI / 4, part: { type: 'group', parts: [
            { type: 'cyl', r: 0.12, h: 0.55, at: [0, 0.28, 0], paint: { color: 'warm' } },
            { type: 'cone', r: 0.14, h: 0.22, at: [0, 0.66, 0], paint: { color: 'hot' } } ] } },
          { type: 'lathe', at: [0, 0.3, 0], profile: [[0, 0], [0.2, 0], [0.16, 0.4], [0.2, 0.45], [0, 0.45]], paint: { color: 'warm' } },
          { type: 'box', size: [0.14, 0.09, 0.01], at: [0.06, 0.95, 0], paint: { color: 'cool' }, anim: { swing: 0.3, speed: 4 } },
          { type: 'cyl', r: 0.008, h: 0.25, at: [0, 0.85, 0], paint: { color: 'ink' } } ] },
        { type: 'group', at: [1.3, 0.1, 0.9], rot: [0, 0, 0], parts: [ { type: 'ring', count: 5, radius: 0.07, face: true, part: { type: 'cone', r: 0.05, h: 0.16, seg: 4, at: [0, 0.03, 0], rot: [0, 0, Math.PI / 2], paint: { color: 'hot' } } } ] },
        { type: 'char', id: 'char.sandkid', at: [0.25, 0.1, 0.9], rot: [0, -0.4, 0] }
      ] },
    // ======================================================================
    { id: 'place.weather', version: 1, kind: 'place', place: '06', name: 'Weather Station', premise: 'Context', promise: 'Treat the world beyond the screen as design space.', game: 'Letter Rain',
      footprint: 2.3, height: 3.4,
      parts: [
        disk(2.3, 0.08, { pattern: 'grass', colors: ['green', 'ink'], repeat: [3, 3] }),
        house(-0.65, -0.45, 1.3, 1.0, 0.95, ['paper', 'ink', 'cool', 'hot'], ['cool', 'paper'], 0.2),
        { type: 'group', at: [-0.65, 1.75, -0.45], anim: { spin: 0.4 }, parts: [
          { type: 'box', size: [0.5, 0.03, 0.03], paint: { color: 'ink' } }, { type: 'cone', r: 0.06, h: 0.14, seg: 4, at: [0.3, 0, 0], rot: [0, 0, -Math.PI / 2], paint: { color: 'hot' } } ] },
        { type: 'cyl', r: 0.045, h: 2.7, at: [1.05, 1.35, -0.3], paint: { color: 'ink' } },
        { type: 'group', at: [1.05, 2.72, -0.3], anim: { spin: 3 }, parts: [
          { type: 'ring', count: 3, radius: 0.18, face: true, part: { type: 'box', size: [0.03, 0.03, 0.36], paint: { color: 'ink' } } },
          { type: 'ring', count: 3, radius: 0.36, face: true, part: { type: 'sphere', r: 0.08, half: true, rot: [0, 0, Math.PI / 2], paint: { color: 'warm' } } } ] },
        { type: 'group', at: [1.15, 0.08, 0.9], parts: [
          { type: 'row', count: 2, step: [0.36, 0, 0], at: [-0.18, 0, 0], part: { type: 'cyl', r: 0.025, h: 0.7, at: [0, 0.35, 0], paint: { color: 'ink' } } },
          { type: 'box', size: [0.55, 0.4, 0.4], at: [0, 0.85, 0], paint: { pattern: 'stripe', colors: ['paper', 'ink'], repeat: [1, 3] } },
          { type: 'gable', w: 0.62, d: 0.5, at: [0, 1.05, 0], paint: { color: 'paper' } } ] },
        { type: 'group', at: [0.2, 2.9, 0.1], anim: { bob: 0.08, speed: 0.9 }, parts: [
          { type: 'sphere', r: 0.32, at: [0, 0, 0], paint: { color: 'paper' } }, { type: 'sphere', r: 0.24, at: [0.35, -0.06, 0], paint: { color: 'paper' } }, { type: 'sphere', r: 0.22, at: [-0.33, -0.08, 0.05], paint: { color: 'paper' } },
          { type: 'row', count: 5, step: [0.15, 0, 0], at: [-0.3, -0.5, 0], part: { type: 'cyl', r: 0.008, h: 0.3, paint: { color: 'cool' } } } ] },
        { type: 'char', id: 'char.forecaster', at: [0.25, 0.08, 0.95], rot: [0, -0.3, 0] }
      ] },
    // ======================================================================
    { id: 'place.square', version: 1, kind: 'place', place: '07', name: 'Town Square', premise: 'Emergence', promise: 'Design conditions, not outcomes.', game: 'Boundary Lines',
      footprint: 2.6, height: 2.0,
      parts: [
        disk(2.6, 0.08, { pattern: 'cobbles', colors: ['paper', 'mid'], repeat: [4, 4] }, 8),
        { type: 'lathe', at: [0, 0.08, 0], profile: [[0, 0], [0.95, 0], [1.0, 0.32], [0.88, 0.34], [0, 0.3]], paint: { pattern: 'stripe', colors: ['paper', 'cool'], repeat: [1, 1] } },
        { type: 'cyl', r: 0.86, h: 0.02, at: [0, 0.4, 0], paint: { pattern: 'waves', colors: ['cool', 'paper'], repeat: [2, 2] } },
        { type: 'lathe', at: [0, 0.38, 0], profile: [[0, 0], [0.16, 0], [0.1, 0.5], [0.4, 0.62], [0.42, 0.7], [0, 0.66]], paint: { color: 'paper' } },
        { type: 'sphere', r: 0.1, at: [0, 1.15, 0], paint: { color: 'cool' }, anim: { bob: 0.06, speed: 4 } },
        { type: 'group', at: [-1.6, 0.08, 0.7], rot: [0, 1.2, 0], parts: [
          { type: 'box', size: [0.9, 0.06, 0.28], at: [0, 0.3, 0], paint: { pattern: 'planks', colors: ['wood', 'ink'] } }, { type: 'box', size: [0.9, 0.25, 0.04], at: [0, 0.45, -0.14], paint: { color: 'wood' } },
          { type: 'row', count: 2, step: [0.7, 0, 0], at: [-0.35, 0, 0], part: { type: 'box', size: [0.06, 0.3, 0.24], at: [0, 0.15, 0], paint: { color: 'ink' } } } ] },
        { type: 'group', at: [1.6, 0.08, 0.7], rot: [0, -1.2, 0], parts: [
          { type: 'box', size: [0.9, 0.06, 0.28], at: [0, 0.3, 0], paint: { pattern: 'planks', colors: ['wood', 'ink'] } }, { type: 'box', size: [0.9, 0.25, 0.04], at: [0, 0.45, -0.14], paint: { color: 'wood' } },
          { type: 'row', count: 2, step: [0.7, 0, 0], at: [-0.35, 0, 0], part: { type: 'box', size: [0.06, 0.3, 0.24], at: [0, 0.15, 0], paint: { color: 'ink' } } } ] },
        lamp(-1.5, -1.3, 1.5), lamp(1.5, -1.3, 1.5),
        { type: 'cyl', r: 0.006, h: 3.0, at: [0, 1.6, -1.3], rot: [0, 0, Math.PI / 2], paint: { color: 'ink' } },
        { type: 'row', count: 9, step: [0.33, 0, 0], at: [-1.32, 1.52, -1.3], part: { type: 'cone', r: 0.08, h: 0.16, seg: 3, rot: [Math.PI, 0, 0], scale: [1, 1, 0.2], paint: { color: 'hot' }, anim: { swing: 0.15, axis: 'x', speed: 3 } } },
        { type: 'char', id: 'char.towner.a', at: [-0.9, 0.08, 1.4], rot: [0, 0.5, 0] },
        { type: 'char', id: 'char.towner.b', at: [1.0, 0.08, 1.5], rot: [0, -0.4, 0] },
        { type: 'char', id: 'char.towner.c', at: [0.1, 0.08, -1.6], rot: [0, 0.2, 0] }
      ] },
    // ======================================================================
    { id: 'place.greenhouse', version: 1, kind: 'place', place: '08', name: 'Greenhouse', premise: 'Intervention', promise: 'Prototype possible futures.', game: 'Shhh Plant',
      footprint: 2.4, height: 2.5,
      parts: [
        disk(2.4, 0.08, { pattern: 'grass', colors: ['green', 'ink'], repeat: [3, 3] }),
        { type: 'box', size: [2.4, 0.1, 1.8], at: [0, 0.13, -0.2], paint: { pattern: 'checker', colors: ['paper', 'mid'], repeat: [4, 3] } },
        { type: 'box', size: [2.4, 1.2, 0.04], at: [0, 0.78, -1.08], paint: { pattern: 'glass', colors: ['paper', 'ink'], repeat: [3, 1] } },
        { type: 'box', size: [0.04, 1.2, 1.8], at: [-1.2, 0.78, -0.2], paint: { pattern: 'glass', colors: ['paper', 'ink'], repeat: [2, 1] } },
        { type: 'box', size: [0.04, 1.2, 1.8], at: [1.2, 0.78, -0.2], paint: { pattern: 'glass', colors: ['paper', 'ink'], repeat: [2, 1] } },
        { type: 'row', count: 2, step: [1.54, 0, 0], at: [-0.97, 0, 0.68], part: { type: 'box', size: [0.5, 1.2, 0.04], at: [0, 0.78, 0], paint: { pattern: 'glass', colors: ['paper', 'ink'] } } },
        { type: 'box', size: [0.8, 0.08, 0.06], at: [0, 1.38, 0.68], paint: { color: 'ink' } },
        { type: 'gable', w: 2.5, d: 1.95, h: 0.75, at: [0, 1.38, -0.2], paint: { pattern: 'glass', colors: ['paper', 'ink'], repeat: [3, 2] } },
        { type: 'lathe', at: [0, 0.18, -0.3], profile: [[0, 0], [0.22, 0], [0.3, 0.32], [0.33, 0.34], [0, 0.32]], paint: { color: 'hot' } },
        { type: 'group', at: [0, 0.5, -0.3], anim: { swing: 0.05, axis: 'z', speed: 1.2 }, parts: [
          { type: 'cyl', r: 0.03, h: 0.7, at: [0, 0.35, 0], paint: { color: 'green' } },
          { type: 'sphere', r: 0.22, at: [0, 0.85, 0], scale: [1, 0.8, 1], paint: { pattern: 'feathers', colors: ['green', 'ink'], repeat: [2, 1] } },
          { type: 'sphere', r: 0.16, at: [-0.2, 0.62, 0.05], scale: [1, 0.8, 1], paint: { pattern: 'feathers', colors: ['green', 'ink'], repeat: [2, 1] } },
          { type: 'sphere', r: 0.15, at: [0.2, 0.68, -0.03], scale: [1, 0.8, 1], paint: { pattern: 'feathers', colors: ['green', 'ink'], repeat: [2, 1] } },
          { type: 'sphere', r: 0.06, at: [0.08, 1.05, 0.1], paint: { color: 'pink' } }, { type: 'sphere', r: 0.05, at: [-0.15, 0.95, 0.12], paint: { color: 'pink' } } ] },
        { type: 'row', count: 2, step: [1.8, 0, 0], at: [-0.9, 0.08, 1.35], part: { type: 'group', parts: [
          { type: 'box', size: [0.7, 0.18, 0.35], at: [0, 0.09, 0], paint: { pattern: 'planks', colors: ['wood', 'ink'] } },
          { type: 'row', count: 4, step: [0.16, 0, 0], at: [-0.24, 0.24, 0], part: { type: 'sphere', r: 0.06, paint: { color: 'pink' } } } ] } },
        { type: 'char', id: 'char.gardener', at: [0.35, 0.18, 0.2], rot: [0, -0.4, 0] }
      ] }
  ];
})();
