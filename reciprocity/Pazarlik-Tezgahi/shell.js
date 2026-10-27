// Ada içi oyun kabuğu: sekiz oyun aynı arayüzle, kendi mekânlarında oynanır.
// createGameShell(THREE, env) → { has(key), start(key), stop(), frame(t), active(), ownsKeys(), spec(key) }
// env: { scene, cam, out, store, parts, look, C, CHARS, places: { key → { key, rec, pos, s } }, isNight(), onExit(), shift(dx) }
//
// Oyun tarifi (oyunlar/0X-*.js → window.OYUNLAR[key]):
//   { key, title, sub, premise, promise, source, caption, hint, anat: [girdi, kural, durum, çıktı], hot,
//     hud: [[etiket, id, sınıf?]], design: {…}, knobs: [{ key, step, min, max, note } | { key, type: 'bool' } | { key, type: 'choice', options }],
//     code: [satır html…] (kuralın kısa hâli), tasks: […], question, overlay: { title, text, cta, choices? },
//     view: { at: [x, y, z] (yerel), zoom, pitch, yaw? }, ownsKeys?, make(ctx) → oyun }
// Oyun: { start(), stop(), begin(e?), frame(t, dt), pointer(type, e), key(e, down) → true, hud() → { id: değer }, rule(), caption(), status(), knob(key) }
// ctx: kabuğun oyuna verdiği araçlar (aşağıda, makeCtx).

window.OYUNLAR = window.OYUNLAR || {};

function createGameShell(THREE, env) {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const made = {};                 // key → { spec, game, ctx }
  let cur = null, tab = 'play', playing = false, nFrame = 0, last = 0;
  let gameTime = performance.now() / 1000, manualPause = false, paused = false;
  let lastPointer = { clientX: 0, clientY: 0 };
  const heldKeys = new Map(), audioContexts = new Set();
  const scheduled = [];
  const autoPause = $('autoPause'); autoPause.checked = env.store.get('ada-auto-pause', true);
  function releaseKeys() { if (cur && cur.game.key) heldKeys.forEach((e) => cur.game.key(e, false)); heldKeys.clear(); }
  function updatePause() {
    const reading = tab !== 'play' && autoPause.checked;
    const next = !!cur && (manualPause || reading || document.hidden);
    if (next && !paused) { releaseKeys(); if (cur.game.pointer) cur.game.pointer('up', lastPointer); audioContexts.forEach((a) => { if (a.state === 'running') a.suspend().catch(() => {}); }); }
    if (!next && paused) audioContexts.forEach((a) => { if (a.state === 'suspended') a.resume().catch(() => {}); });
    paused = next;
    $('pauseGame').textContent = paused ? 'RESUME' : 'PAUSE';
    $('pauseGame').setAttribute('aria-pressed', String(paused));
    $('pauseStatus').textContent = paused ? (reading && !manualPause ? 'Paused while reading' : 'Paused') : '';
  }
  $('pauseGame').addEventListener('click', () => {
    if (paused) { manualPause = false; if (tab !== 'play') setTab('play'); }
    else manualPause = true;
    updatePause();
    if (!paused) env.out.focus({ preventScroll: true });
  });
  autoPause.addEventListener('change', () => { env.store.set('ada-auto-pause', autoPause.checked); updatePause(); });
  document.addEventListener('visibilitychange', () => { last = performance.now() / 1000; updatePause(); });
  addEventListener('blur', () => { releaseKeys(); if (cur) { manualPause = true; updatePause(); } });

  // ---- etiket havuzu (oyunlar sahnedeki noktalara yazı iliştirir) ----
  const tagsEl = $('tags');
  const tagPool = Array.from({ length: 28 }, () => { const el = document.createElement('div'); el.className = 'tag'; el.hidden = true; tagsEl.append(el); return el; });
  const v = new THREE.Vector3();

  // ---- ctx: her oyuna bir tane ----
  function makeCtx(spec) {
    const place = env.places[spec.key], root = place.s.root;
    const group = new THREE.Group(); group.visible = false; root.add(group);
    const D = Object.assign({}, spec.design), DEF = Object.assign({}, spec.design);
    const mats = new Map();
    const hidden = [];
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), pl = new THREE.Plane(), hit = new THREE.Vector3();
    let audio = null;
    const ctx = {
      THREE, C: env.C, D, DEF, group, place, root, parts: env.parts, store: env.store, cam: env.cam, out: env.out, dt: 0.016,
      now: () => gameTime,
      schedule(fn, ms) { scheduled.push({ at: gameTime + ms / 1000, fn }); },
      night: () => env.isNight(),
      // Montour malzemesi: rol adı ya da renk; desen atlası sonra (patch) uygulanır
      toon(c, extra) { const k = c + JSON.stringify(extra || {}); if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial(Object.assign({ color: new THREE.Color(env.C[c] || c), gradientMap: env.parts.LAMBERT }, extra))); return mats.get(k); },
      // desen dışı düz renk (yazılar, ışıklar, imleçler): atlas dokunmaz
      flat(c, extra) { const m = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(env.C[c] || c) }, extra)); m.userData.noAtlas = true; return m; },
      mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; },
      char(id) { return env.parts.build(env.CHARS[id], env.C); },
      animChar: (o, t) => env.parts.animate(o, t),
      patch(obj = group) { env.look.patchObject(obj); },
      // ekran → mekânın yerel düzlemi (y = h)
      toLocal(e, h = 0, axis = 'y', at = 0) {
        const r = env.out.getBoundingClientRect();
        ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
        ray.setFromCamera(ndc, env.cam); root.updateMatrixWorld(); inv.copy(root.matrixWorld).invert(); ray.ray.applyMatrix4(inv);
        if (axis === 'y') pl.set(new THREE.Vector3(0, 1, 0), -h); else pl.set(new THREE.Vector3(0, 0, 1), -at); // dikey düzlem: z = at
        return ray.ray.intersectPlane(pl, hit) ? hit.clone() : null;
      },
      world: (p) => root.localToWorld(p.clone()),
      tag(i, text, p, hot, lift = 0, cls) {
        if (i >= tagPool.length) return; v.copy(root.localToWorld(p.clone())).project(env.cam);
        const el = tagPool[i]; el.hidden = false; if (el.textContent !== text) el.textContent = text; el.className = 'tag' + (hot ? ' hot' : '') + (cls ? ' ' + cls : '');
        el.style.left = (v.x * 0.5 + 0.5) * env.out.clientWidth + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * env.out.clientHeight - lift) + 'px';
      },
      tagsFrom(n) { for (; n < tagPool.length; n++) tagPool[n].hidden = true; },
      text(id, s) { const el = $(id); if (el && el.textContent !== String(s)) el.textContent = s; },
      overlay(o) { showOverlay(o); },
      playing(on) { setPlaying(on); },
      isPlaying: () => playing,
      flash(i) { const el = $('gAnat').children[i]; if (!el) return; el.classList.add('hot'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.toggle('hot', i === spec.hot), 700); },
      bump(id) { const el = $(id); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
      audio() {
        if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; } }
        if (audio) audioContexts.add(audio);
        if (audio && audio.state === 'suspended' && !paused) audio.resume().catch(() => {}); return audio;
      },
      // mekânın kendi parçalarını oyun süresince gizle (tarif sırası = root.children sırası)
      hide(...idx) { idx.forEach((i) => { const o = root.children[i]; if (o && o.visible) { o.visible = false; hidden.push(o); } }); },
      hideObj(o) { if (o && o.visible) { o.visible = false; hidden.push(o); } },
      restore() { hidden.splice(0).forEach((o) => { o.visible = true; }); },
      exit: () => env.onExit(),
      renderTexts: () => renderTexts()
    };
    return ctx;
  }

  // ---- arayüz parçaları ----
  function fillDom(spec) {
    $('gTitle').textContent = spec.key + ' · ' + spec.title;
    $('gSub').textContent = 'premise ' + spec.key + ' · ' + spec.premise.toLowerCase();
    $('gHud').innerHTML = spec.hud.map(([l, id, cls]) => '<div' + (cls ? ' class="' + cls + '"' : '') + '><small>' + l + '</small><b id="' + id + '">–</b></div>').join('');
    $('gAnat').innerHTML = ['INPUT', 'RULE', 'STATE', 'OUTPUT'].map((k, i) => '<div' + (i === spec.hot ? ' class="hot"' : '') + '><small>' + k + '</small><b' + (i === 1 ? ' id="anatRule"' : '') + '>' + esc(spec.anat[i]) + '</b></div>').join('');
    $('gHint').textContent = spec.hint;
    $('codeName').textContent = 'script.js — ' + spec.title;
    $('notesName').textContent = 'README.md — ' + spec.key + ' ' + spec.title;
    $('codeName').title = $('codeName').textContent; $('notesName').title = $('notesName').textContent;
    $('codeWin').setAttribute('aria-label', 'Code — ' + spec.title); $('notesWin').setAttribute('aria-label', 'Notes — ' + spec.title);
    const a = spec.anat;
    $('notesBody').innerHTML = '<p class="pp"><b>PREMISE</b>' + esc(spec.premiseText) + '</p><p class="pp"><b>PROMISE</b>' + esc(spec.promise) + '</p>' +
      (spec.source ? '<p class="src">after ' + esc(spec.source) + '</p>' : '') +
      '<table><tr><th>INPUT</th><th>RULE</th><th>STATE</th><th>OUTPUT</th></tr><tr>' + a.map((x, i) => '<td' + (i === spec.hot ? ' class="hot"' : '') + '>' + esc(x) + '</td>').join('') + '</tr></table>' +
      '<h3>DESIGN TASKS</h3>' + spec.tasks.map((t) => '<label class="task"><input type="checkbox"><span>' + t + '</span></label>').join('') +
      '<p class="q serif">' + esc(spec.question) + '</p>';
    buildCode(spec);
  }
  function buildCode(spec) {
    const D = made[spec.key].ctx.D, line = (n, html, key) => '<span class="ln"' + (key ? ' data-key="' + key + '"' : '') + '><i>' + n + '</i><span>' + html + '</span></span>';
    let n = 1, html = line(n++, '<span class="c">// 1) DESIGN PARAMETERS · change them, try at once</span>') + line(n++, '<span class="k">const</span> DESIGN = {');
    spec.knobs.forEach((k) => {
      let f;
      if (k.type === 'bool') f = '<input type="checkbox" data-knob="' + k.key + '">';
      else if (k.type === 'choice') f = '<select data-knob="' + k.key + '">' + k.options.map((o) => '<option value="' + o + '">\'' + o + '\'</option>').join('') + '</select>';
      else f = '<input type="number" data-knob="' + k.key + '" step="' + k.step + '" min="' + k.min + '" max="' + k.max + '">';
      html += line(n++, '  ' + k.key + ': ' + f + ',  <span class="c">// ' + (k.note || '') + '</span>', k.key);
    });
    html += line(n++, '};') + line(n++, ' ');
    (spec.code || []).forEach((c) => { html += line(n++, c); });
    const el = $('code'); el.innerHTML = html;
    el.querySelectorAll('[data-knob]').forEach((input) => input.setAttribute('aria-label', input.dataset.knob));
    el.querySelectorAll('[data-knob]').forEach((input) => input.addEventListener('input', () => {
      const k = input.dataset.knob, sp = spec.knobs.find((q) => q.key === k);
      if (input.type === 'number' && (input.value === '' || !input.validity.valid)) return;
      D[k] = input.type === 'checkbox' ? input.checked : sp.type === 'choice' ? input.value : Number(input.value);
      const g = made[spec.key].game; if (g.knob) g.knob(k);
      syncCode(); made[spec.key].ctx.flash(1); renderTexts();
    }));
    syncCode();
  }
  function syncCode() {
    if (!cur) return; const { ctx } = cur;
    $('code').querySelectorAll('[data-knob]').forEach((input) => {
      const k = input.dataset.knob;
      if (input.type === 'checkbox') input.checked = !!ctx.D[k]; else if (document.activeElement !== input) input.value = ctx.D[k];
      input.closest('.ln').classList.toggle('changed', ctx.D[k] !== ctx.DEF[k]);
    });
  }
  function renderTexts() {
    if (!cur) return; const { spec, game } = cur;
    if (game.rule) $('anatRule').textContent = game.rule();
    $('gameCaption').textContent = game.caption ? game.caption() : spec.caption;
  }
  function showOverlay(o) {
    $('ovKick').textContent = (o.kick || ('PREMISE ' + cur.spec.key + ' · ' + cur.spec.premise)).toUpperCase();
    $('overlayTitle').textContent = o.title; $('overlayText').textContent = o.text;
    const ch = $('ovChoices'); ch.innerHTML = '';
    $('ovCta').hidden = !!o.choices;
    if (o.choices) o.choices.forEach(([label, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn go'; b.innerHTML = '<b>▶</b>' + esc(label); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); ch.append(b); });
    else $('overlayCta').textContent = o.cta || 'CLICK TO START';
    $('ovErr').hidden = !o.error; $('ovErr').textContent = o.error || '';
    cur.overlay = o; setPlaying(false);
  }
  function setPlaying(on) { playing = on; document.body.classList.toggle('playing', on); }
  function setTab(next) {
    const previous = tab;
    tab = next;
    $('codeWin').hidden = next !== 'code'; $('notesWin').hidden = next !== 'notes';
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === next));
    document.body.dataset.tab = next;
    env.shift(next === 'code' ? 1.2 : next === 'notes' ? -1.3 : 0);
    updatePause();
    if (next !== 'play') {
      const panel = $(next === 'code' ? 'codeWin' : 'notesWin'); panel.tabIndex = -1; panel.focus({ preventScroll: true });
    } else if (previous !== 'play') env.out.focus({ preventScroll: true });
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  document.querySelectorAll('.win .close').forEach((b) => b.addEventListener('click', () => setTab('play')));
  $('gameBack').addEventListener('click', () => env.onExit());
  $('reset').addEventListener('click', () => { if (!cur) return; Object.assign(cur.ctx.D, cur.ctx.DEF); Object.keys(cur.ctx.D).forEach((k) => cur.game.knob && cur.game.knob(k)); syncCode(); renderTexts(); });

  // ---- girdi: aktif oyuna iletilir ----
  const inGame = () => !!cur && !paused;
  function beginGame(e) {
    if (!inGame() || playing || (cur.overlay && cur.overlay.choices)) return;
    cur.ctx.audio(); setPlaying(true); if (cur.game.begin) cur.game.begin(e); env.out.focus({ preventScroll: true });
  }
  $('ovCta').addEventListener('click', (e) => beginGame(e.detail === 0 ? undefined : e));
  env.out.addEventListener('pointerdown', (e) => {
    if (!inGame()) return;
    lastPointer = e;
    cur.ctx.audio();
    if (!playing) {
      if (cur.overlay && cur.overlay.choices) return; // izin ekranı: seçim düğmeyle yapılır
      beginGame(e); return;
    }
    if (cur.game.pointer) cur.game.pointer('down', e);
  });
  env.out.addEventListener('pointermove', (e) => { lastPointer = e; if (inGame() && cur.game.pointer) cur.game.pointer('move', e); });
  addEventListener('pointerup', (e) => { if (inGame() && cur.game.pointer) cur.game.pointer('up', e); });
  env.out.addEventListener('pointerleave', (e) => { if (inGame() && cur.game.pointer) cur.game.pointer('leave', e); });
  env.out.addEventListener('dblclick', (e) => { if (inGame() && cur.game.pointer) cur.game.pointer('dbl', e); });
  addEventListener('keydown', (e) => {
    if (!cur) return;
    if (e.key === 'Escape' && tab !== 'play') { e.preventDefault(); e.stopImmediatePropagation(); setTab('play'); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && (e.target.closest('input, select, textarea') || ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, a, summary')))) return;
    if (e.key === 'Escape') return; // çıkış: oyun.js
    const k = e.key.toLowerCase();
    if (!inGame()) {
      if (k === 'c' && !e.shiftKey) setTab(tab === 'code' ? 'play' : 'code');
      else if (k === 'n' && e.shiftKey) setTab(tab === 'notes' ? 'play' : 'notes');
      return;
    }
    if (cur.game.key && cur.game.key(e, true)) { heldKeys.set(e.code, e); cur.ctx.audio(); if (!playing && !(cur.overlay && cur.overlay.choices)) { setPlaying(true); if (cur.game.begin) cur.game.begin(); } return; }
    if (cur.spec.ownsKeys) return;
    if (k === 'c' && !e.shiftKey) setTab(tab === 'code' ? 'play' : 'code');
    else if (k === 'n' && e.shiftKey) setTab(tab === 'notes' ? 'play' : 'notes');
  });
  addEventListener('keyup', (e) => { heldKeys.delete(e.code); if (inGame() && cur.game.key) cur.game.key(e, false); });

  // ---- yaşam döngüsü ----
  function start(key) {
    manualPause = false; gameTime = performance.now() / 1000; last = gameTime;
    const spec = window.OYUNLAR[key];
    if (!made[key]) { const ctx = makeCtx(spec); const game = spec.make(ctx); made[key] = { spec, ctx, game }; ctx.patch(); }
    cur = made[key]; cur.overlay = null;
    fillDom(spec);
    cur.ctx.group.visible = true;
    document.body.classList.add('ingame'); document.body.dataset.game = key;
    setTab('play');
    cur.game.start();
    cur.ctx.patch();
    if (!cur.overlay && !playing) showOverlay(spec.overlay);
    renderTexts();
    env.out.focus({ preventScroll: true });
  }
  function stop() {
    if (!cur) return;
    scheduled.length = 0;
    releaseKeys();
    cur.game.stop(); cur.ctx.restore(); cur.ctx.group.visible = false; cur.ctx.tagsFrom(0);
    document.body.classList.remove('ingame', 'playing'); delete document.body.dataset.game;
    setTab('play'); env.shift(0); cur = null; playing = false; manualPause = false; updatePause();
  }
  function frame(t) {
    if (!cur) return;
    const dt = Math.min(0.05, t - (last || t)); last = t; cur.ctx.dt = dt;
    if (paused) { renderTexts(); return; }
    gameTime += Math.max(0, dt);
    for (let i = scheduled.length - 1; i >= 0; i--) if (scheduled[i].at <= gameTime) scheduled.splice(i, 1)[0].fn();
    cur.game.frame(gameTime, dt);
    if (cur.game.hud) { const h = cur.game.hud(); for (const id in h) cur.ctx.text(id, h[id]); }
    if (++nFrame % 10 === 0) { if (cur.game.status) $('codeStatus').textContent = cur.game.status(); renderTexts(); }
    if (nFrame % 30 === 0) cur.ctx.patch(); // oyunun sonradan eklediği nesneler de Montour'a girsin
  }
  return {
    has: (key) => !!window.OYUNLAR[key], spec: (key) => window.OYUNLAR[key],
    start, stop, frame, active: () => !!cur, ownsKeys: () => !!(cur && cur.spec.ownsKeys),
    current: () => cur, setTab
  };
}
