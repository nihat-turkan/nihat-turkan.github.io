// 03 · Feedback — Pace Track (Tempo Pisti)
// Oval pist 8 parçaya bölünmüş; her parçada bir komut var: Sprint, Jog, Walk.
// Koşucu tur atar ve geçtiği parçanın komutuna göre koşar. Gizli durum: ENERJİ.
// Enerji yetmezse koşucu bir alt tempoya düşer → plan ile davranış ayrışır.
//
// Girdi: piste / plan şeridine tıklama, klavye · Kural: enterSegment(), resolveMode()
// Durum: track[8], energy, segment, status · Çıktı: koşucu, enerji çubuğu, adım sesi, nefes sesi, HUD
//
// Sıra: DESIGN → state → rule → input → output

'use strict';

// ================================================================
// 1) DESIGN — tasarım parametreleri · değiştir, hemen dene
// ================================================================
const DESIGN = {
  segments: 8,                              // pist parça sayısı
  baseSegmentMs: 1400,                      // Jog modunda bir parçanın süresi (ms)
  speedFactor: { S: 0.55, J: 1, W: 1.7 },   // süre çarpanı: küçük = hızlı
  energyDelta: { S: -18, J: -6, W: 12 },    // parçaya girerken enerji değişimi
  startEnergy: 100,                         // her denemenin başlangıç enerjisi
  maxEnergy: 100,
  lowThreshold: 30,                         // bunun altı "low" bölgesi
  lastEditMs: 2500,                         // son düzenlenen parçanın işaretli kalma süresi
  defaultPlan: ['S', 'S', 'J', 'S', 'S', 'J', 'W', 'J'],

  // --- geri bildirim kanalları (karşılaştırma için tek tek kapat) ---
  showRunner: true,      // SHOW STATE · koşucu ve şu anki parça nerede?
  showEnergyBar: true,   // SHOW STATE · enerji çubuğu
  runnerPosture: true,   // SHOW STATE · eğilme ve adım genişliği tempoyu / yorgunluğu gösterir
  showCostPulse: true,   // SUPPORT CORRECTION · parçaya girince maliyet (−18) o parçada belirir
  showMismatch: true,    // SHOW STATE · planlanan ≠ gerçekleşen (üstü çizili harf + rozet)
  showStatus: true,      // HUD sayıları; kapalıyken "?"
  footstepSound: true,   // SES · adım temposu = gerçekleşen mod
  breathSound: true,     // SES · enerji düştükçe nefes sıklaşır ve güçlenir
  ackOnEdit: true,       // ACKNOWLEDGE · düzenleme alındı düdüğü (sadece "kaydedildi" demek)

  // --- kural değişikliği (README görevi) ---
  uphill: false,         // açıkken yokuş parçalarında harcama iki katı
  uphillSegments: [2, 3] // 0'dan sayılır → ekranda 3. ve 4. parça
};

const MODES = {
  S: { name: 'Sprint' },
  J: { name: 'Jog' },
  W: { name: 'Walk' }
};
const CYCLE = { J: 'S', S: 'W', W: 'J' };        // tıklama sırası
const DOWNSHIFT = { S: ['S', 'J', 'W'], J: ['J', 'W'], W: ['W'] };
const STEP_MS = { S: 170, J: 290, W: 480 };      // adım sesi aralığı
const STRIDE = { S: 0.028, J: 0.018, W: 0.010 }; // bacak salınım hızı (rad/ms)
const SWING = { S: 40, J: 28, W: 16 };           // bacak salınım açısı (derece)
const LEAN = { S: 16, J: 7, W: 0 };              // öne eğilme (derece)

// panelde gösterilen anahtarlar: [anahtar, etiket, not]
const KNOBS = [
  ['showRunner', 'Runner + current segment', 'SHOW STATE · where is the runner?'],
  ['showEnergyBar', 'Energy bar', 'SHOW STATE · how much is left?'],
  ['runnerPosture', 'Runner posture', 'SHOW STATE · lean and stride'],
  ['showCostPulse', 'Cost pulse', 'SUPPORT CORRECTION · what did it cost?'],
  ['showMismatch', 'Planned vs actual', 'SHOW STATE · plan ≠ behaviour'],
  ['showStatus', 'HUD numbers', 'status text'],
  ['footstepSound', 'Footstep sound', 'SOUND · pace'],
  ['breathSound', 'Breath sound', 'SOUND · energy'],
  ['ackOnEdit', 'Edit whistle', 'ACKNOWLEDGE · edit received'],
  ['uphill', 'Uphill on 3–4', 'RULE · double cost (task)']
];

// karşılaştırma ön ayarları — kural (uphill) ve tempo değişmez, sadece kanallar
const PRESETS = {
  all: { showRunner: true, showEnergyBar: true, runnerPosture: true, showCostPulse: true, showMismatch: true, showStatus: true, footstepSound: true, breathSound: true, ackOnEdit: true },
  visual: { showRunner: true, showEnergyBar: true, runnerPosture: true, showCostPulse: true, showMismatch: true, showStatus: true, footstepSound: false, breathSound: false, ackOnEdit: false },
  sound: { showRunner: true, showEnergyBar: false, runnerPosture: false, showCostPulse: false, showMismatch: false, showStatus: false, footstepSound: true, breathSound: true, ackOnEdit: true }
};

// ================================================================
// 2) STATE — sistemin sakladığı her şey
// ================================================================
const N = DESIGN.segments;
const state = {
  track: DESIGN.defaultPlan.slice(), // kaydedilen plan
  energy: DESIGN.startEnergy,        // gizli durum
  segment: -1,                       // -1 = henüz başlamadı
  progress: 0,                       // parça içindeki ilerleme 0..1
  status: 'ready',                   // ready | running | paused
  planned: null,                     // şu anki parçanın planı
  actual: null,                      // şu an gerçekte koşulan mod
  mismatch: Array(N).fill(null),     // parça başına son geçişte gerçekleşen mod (plandan farklıysa)
  lastEdit: { i: -1, t: -1e9 },
  history: [],                       // undo yığını
  lap: 0,
  zone: 'ok',                        // ok | low (duyuru için)
  flash: { text: '', until: 0 },     // kısa süreli alt yazı
  // animasyon / ses zamanlayıcıları
  phase: 0, stepTimer: 0, breathTimer: 0
};

// ================================================================
// 3) RULE — tasarım kuralları (çizimden bağımsız)
// ================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// bir modun bu parçadaki enerji etkisi
function costOf(mode, i) {
  let d = DESIGN.energyDelta[mode];
  if (DESIGN.uphill && d < 0 && DESIGN.uphillSegments.includes(i)) d *= 2;
  return d;
}

// enerji yetmiyorsa bir alt tempoya düş: Sprint → Jog → Walk
function resolveMode(planned, i) {
  for (const m of DOWNSHIFT[planned]) {
    const d = costOf(m, i);
    if (d >= 0 || state.energy + d >= 0) return m;
  }
  return 'W';
}

function zoneOf(e) { return e < DESIGN.lowThreshold ? 'low' : 'ok'; }

// koşucu yeni bir parçaya girer: mod belirlenir, enerji hemen değişir
function enterSegment(i) {
  const planned = state.track[i];
  const actual = resolveMode(planned, i);
  const before = state.energy;
  state.energy = clamp(before + costOf(actual, i), 0, DESIGN.maxEnergy);
  state.planned = planned;
  state.actual = actual;
  state.mismatch[i] = actual !== planned ? actual : null;
  onEnter(i, planned, actual, state.energy - before);
}

function advance() {
  state.segment = (state.segment + 1) % N;
  if (state.segment === 0) state.lap++;
  enterSegment(state.segment);
}

function segDuration() {
  return DESIGN.baseSegmentMs * DESIGN.speedFactor[state.actual || 'J'];
}

function setCommand(i, mode) {
  if (state.track[i] === mode) return;
  state.history.push({ type: 'one', i, prev: state.track[i] });
  state.track[i] = mode;
  state.lastEdit = { i, t: performance.now() };
  onEdit(i);
}

function cycleCommand(i) { setCommand(i, CYCLE[state.track[i]]); }

function undo() {
  const h = state.history.pop();
  if (!h) { flash('Nothing to undo.'); announce('Nothing to undo.'); return; }
  let msg;
  if (h.type === 'one') {
    state.track[h.i] = h.prev;
    state.lastEdit = { i: h.i, t: performance.now() };
    msg = `Restored: segment ${h.i + 1} → ${MODES[h.prev].name}`;
    bump(h.i);
  } else {
    state.track = h.prev.slice();
    state.lastEdit = { i: -1, t: -1e9 };
    msg = 'Restored: previous plan';
  }
  flash(msg);
  announce(msg);
  if (DESIGN.ackOnEdit) undoSound();
}

function loadDefaultPlan() {
  if (state.track.join('') === DESIGN.defaultPlan.join('')) return;
  state.history.push({ type: 'all', prev: state.track.slice() });
  state.track = DESIGN.defaultPlan.slice();
  flash('Default plan loaded.');
  announce('Default plan loaded.');
}

// koşu / duraklat — duraklatınca konum, enerji ve plan korunur
function toggleRun() {
  if (state.status === 'running') {
    state.status = 'paused';
    announce(`Paused at segment ${state.segment + 1}.`);
  } else if (state.status === 'paused') {
    state.status = 'running';
    announce('Running.');
  } else {
    state.status = 'running';
    state.segment = -1;
    state.progress = 0;
    state.lap = 0;
    state.stepTimer = 0;
    state.breathTimer = 600;
    advance();
    announce('Running.');
  }
}

// koşucuyu başa al: konum ve enerji sıfırlanır, plan kalır (her deneme aynı başlasın)
function resetRunner() {
  Object.assign(state, {
    energy: DESIGN.startEnergy, segment: -1, progress: 0, status: 'ready',
    planned: null, actual: null, lap: 0, zone: 'ok', mismatch: Array(N).fill(null)
  });
  flash('Runner reset. Energy back to ' + DESIGN.startEnergy + '.');
  announce('Runner reset.');
}

// ================================================================
// 4) INPUT — fare, dokunmatik, klavye
// ================================================================
const $ = (id) => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const trackPath = $('trackPath');
const TOTAL = trackPath.getTotalLength();
const SEG_LEN = TOTAL / N;

document.addEventListener('pointerdown', ensureAudio, { passive: true });

$('btnRun').addEventListener('click', () => { ensureAudio(); toggleRun(); });
$('btnUndo').addEventListener('click', undo);
$('btnReset').addEventListener('click', resetRunner);
$('btnDefault').addEventListener('click', loadDefaultPlan);

document.addEventListener('keydown', (e) => {
  ensureAudio();
  const t = e.target;
  const isField = t instanceof HTMLInputElement; // checkbox / range kendi tuşlarını kullanır
  const k = e.key.toLowerCase();

  if (e.code === 'Space' && !isField) {
    e.preventDefault();
    if (!e.repeat) toggleRun();
    return;
  }
  if (isField || e.ctrlKey || e.metaKey || e.altKey) {
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
    return;
  }
  if (k === 'z') { undo(); return; }
  if (k === 'r') { resetRunner(); return; }

  // plan şeridinde gezinme ve doğrudan komut verme
  const idx = t.dataset ? Number(t.dataset.seg) : NaN;
  if (!Number.isNaN(idx)) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowRight' ? 1 : N - 1)) % N;
      planBtns[next].focus();
    } else if (k === 's' || k === 'j' || k === 'w') {
      setCommand(idx, k.toUpperCase());
    }
  }
});
// Space'in odaklı butonu ayrıca tıklamasını engelle
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault();
});

// ================================================================
// 5) OUTPUT — pist, koşucu, çubuk, HUD, ses
// ================================================================

// --- pist parçaları ve etiketler (bir kez kurulur) ---
const segEls = [];
const outlineEls = [];
const labelEls = [];
const center = { x: 300, y: 180 };

function pointAt(len) { return trackPath.getPointAtLength(((len % TOTAL) + TOTAL) % TOTAL); }
function outward(p, dist) {
  const dx = p.x - center.x, dy = p.y - center.y, m = Math.hypot(dx, dy) || 1;
  return { x: p.x + dx / m * dist, y: p.y + dy / m * dist };
}
function el(tag, attrs, parent) {
  const n = document.createElementNS(svgNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

const d = trackPath.getAttribute('d');
for (let i = 0; i < N; i++) {
  const dash = `${SEG_LEN - 4} ${TOTAL}`;
  const off = -(i * SEG_LEN + 2);
  const o = el('path', { d, class: 'seg-outline', 'stroke-dasharray': dash, 'stroke-dashoffset': off }, $('segLayer'));
  const s = el('path', { d, class: 'seg', 'stroke-dasharray': dash, 'stroke-dashoffset': off }, $('segLayer'));
  s.addEventListener('click', () => { ensureAudio(); cycleCommand(i); });
  outlineEls.push(o);
  segEls.push(s);

  const mid = pointAt((i + 0.5) * SEG_LEN);
  const g = el('g', { class: 'label', transform: `translate(${mid.x},${mid.y})` }, $('labelLayer'));
  const wrap = el('g', { class: 'chip-wrap' }, g);
  el('circle', { class: 'edit-ring', r: 21 }, wrap);
  el('circle', { class: 'chip', r: 15 }, wrap);
  const letter = el('text', { class: 'letter', 'text-anchor': 'middle', y: 5 }, wrap);
  el('line', { class: 'strike', x1: -10, y1: 8, x2: 10, y2: -8 }, wrap);
  // parça numarası iç tarafta
  const inner = outward(mid, -42);
  el('text', { class: 'num', 'text-anchor': 'middle', x: inner.x - mid.x, y: inner.y - mid.y + 4 }, g).textContent = String(i + 1);
  // "now: J" rozeti dış tarafta
  const out = outward(mid, 44);
  const badge = el('g', { class: 'badge', transform: `translate(${out.x - mid.x},${out.y - mid.y})` }, g);
  el('rect', { x: -26, y: -10, width: 52, height: 20, rx: 10 }, badge);
  const badgeText = el('text', { 'text-anchor': 'middle', y: 4 }, badge);
  g.addEventListener('click', () => { ensureAudio(); cycleCommand(i); });
  labelEls.push({ g, letter, badgeText, ring: wrap.querySelector('.edit-ring'), mid });
}

// --- plan şeridi (erişilebilir native butonlar) ---
const planBtns = [];
for (let i = 0; i < N; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'plan-btn';
  b.dataset.seg = String(i);
  b.innerHTML = `<span class="num">${i + 1}</span><b class="glyph"></b><span class="name"></span><span class="actual"></span>`;
  b.addEventListener('click', () => { ensureAudio(); cycleCommand(i); });
  $('planStrip').appendChild(b);
  planBtns.push(b);
}

// --- DESIGN anahtar paneli ---
const knobInputs = {};
for (const [key, label, note] of KNOBS) {
  const l = document.createElement('label');
  l.className = 'knob';
  l.innerHTML = `<input type="checkbox"><span><code>${key}</code> ${label}<small>${note}</small></span>`;
  const input = l.querySelector('input');
  input.checked = DESIGN[key];
  input.addEventListener('change', () => { DESIGN[key] = input.checked; syncPresetButtons(); });
  $('knobList').appendChild(l);
  knobInputs[key] = input;
}
document.querySelectorAll('[data-preset]').forEach((b) => {
  b.addEventListener('click', () => {
    Object.assign(DESIGN, PRESETS[b.dataset.preset]);
    for (const k in knobInputs) knobInputs[k].checked = DESIGN[k];
    syncPresetButtons();
    announce(b.textContent + ' preset.');
  });
});
function syncPresetButtons() {
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const p = PRESETS[b.dataset.preset];
    b.setAttribute('aria-pressed', String(Object.keys(p).every((k) => DESIGN[k] === p[k])));
  });
}
syncPresetButtons();

const tempo = $('tempo');
tempo.value = DESIGN.baseSegmentMs;
$('tempoOut').textContent = DESIGN.baseSegmentMs;
tempo.addEventListener('input', () => {
  DESIGN.baseSegmentMs = Number(tempo.value);
  $('tempoOut').textContent = tempo.value;
});

// --- olay çıktıları ---
function onEdit(i) {
  bump(i);
  if (DESIGN.ackOnEdit) whistle();
  const name = MODES[state.track[i]].name;
  // koşucu tam o parçadaysa değişiklik bir sonraki geçişte geçerli
  const msg = state.status !== 'ready' && i === state.segment
    ? `Saved: segment ${i + 1} → ${name}. Applies next lap.`
    : `Saved: segment ${i + 1} → ${name}.`;
  flash(msg);
  announce(msg);
}

function onEnter(i, planned, actual, delta) {
  if (DESIGN.showCostPulse) costPulse(i, delta);
  const z = zoneOf(state.energy);
  if (z !== state.zone) {
    state.zone = z;
    if (DESIGN.showEnergyBar || DESIGN.showStatus) announce(z === 'low' ? 'Energy low.' : 'Energy recovered.');
  }
  if (planned !== actual && DESIGN.showMismatch) {
    announce(`Segment ${i + 1}: planned ${MODES[planned].name}, running ${MODES[actual].name}.`);
  }
}

function bump(i) {
  for (const n of [labelEls[i].g, planBtns[i]]) {
    n.classList.remove('bump');
    void n.getBoundingClientRect(); // animasyonu yeniden başlat
    n.classList.add('bump');
  }
}

function costPulse(i, delta) {
  const p = outward(labelEls[i].mid, -20);
  const layer = $('pulseLayer');
  const ring = el('circle', { class: 'pulse-ring', cx: labelEls[i].mid.x, cy: labelEls[i].mid.y, r: 15 }, layer);
  const txt = el('text', { class: 'pulse-text', x: p.x, y: p.y, 'text-anchor': 'middle' }, layer);
  txt.textContent = (delta > 0 ? '+' : delta < 0 ? '−' : '±') + Math.abs(delta);
  setTimeout(() => { ring.remove(); txt.remove(); }, 1250);
}

function flash(text) { state.flash = { text, until: performance.now() + 2200 }; }

let lastAnnounce = '';
function announce(text) {
  // aynı metni tekrar duyurabilmek için önce temizle
  const live = $('live');
  live.textContent = '';
  lastAnnounce = text;
  setTimeout(() => { live.textContent = lastAnnounce; }, 30);
}

// --- ses (Web Audio, kütüphane yok) ---
let audio = null, noiseBuf = null;
function ensureAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
    noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function noise({ type, freq, q = 1, attack = 0.005, dur, gain }) {
  if (!audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  const f = audio.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f).connect(g).connect(audio.destination);
  src.start(now, Math.random() * 0.5);
  src.stop(now + dur + 0.02);
}

function tone(freqs, step = 0.08, gain = 0.12) {
  if (!audio || audio.state !== 'running') return;
  freqs.forEach((fq, n) => {
    const t = audio.currentTime + n * step;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = fq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.4);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + step * 1.5);
  });
}

// adım: gerçekleşen moda göre perde ve sıklık
function footstep(mode) { noise({ type: 'bandpass', freq: { S: 950, J: 700, W: 480 }[mode], q: 1.4, dur: 0.07, gain: 0.55 }); }
// nefes: yorgunluk arttıkça uzun ve yüksek
function breath(tired) { noise({ type: 'lowpass', freq: 900 + 900 * tired, attack: 0.08, dur: 0.22 + 0.25 * tired, gain: 0.03 + 0.3 * tired }); }
function whistle() { tone([1320, 1760], 0.06, 0.08); }     // düzenleme alındı
function undoSound() { tone([990, 660], 0.09, 0.1); }      // geri alındı

// --- çizim ---
const runner = $('runner');
const body = $('runnerBody');
const legF = $('legFront'), legB = $('legBack'), armF = $('armFront'), armB = $('armBack');

function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
function setAttr(node, name, val) { if (node.getAttribute(name) !== val) node.setAttribute(name, val); }

function render(now) {
  const started = state.status !== 'ready';
  const tired = 1 - state.energy / DESIGN.maxEnergy;

  // pist parçaları ve etiketler
  for (let i = 0; i < N; i++) {
    const mode = state.track[i];
    const current = DESIGN.showRunner && started && i === state.segment;
    setAttr(segEls[i], 'class', `seg m-${mode}${current ? ' is-current' : ''}`);
    setAttr(outlineEls[i], 'class', `seg-outline${current ? ' is-current' : ''}`);
    const L = labelEls[i];
    setText(L.letter, mode);
    const mm = DESIGN.showMismatch && state.mismatch[i];
    L.g.classList.toggle('has-mismatch', !!mm);
    setText(L.badgeText, mm ? 'now ' + mm : '');
    const editAge = i === state.lastEdit.i ? (now - state.lastEdit.t) / DESIGN.lastEditMs : 1;
    L.ring.style.opacity = String(Math.max(0, 1 - editAge));

    const b = planBtns[i];
    setText(b.querySelector('.glyph'), mode);
    b.querySelector('.glyph').className = 'glyph g-' + mode;
    setText(b.querySelector('.name'), MODES[mode].name);
    setText(b.querySelector('.actual'), mm ? 'last: ' + MODES[mm].name : '');
    b.classList.toggle('is-current', current);
    b.classList.toggle('is-edited', editAge < 1);
    setAttr(b, 'aria-label', `Segment ${i + 1}: ${MODES[mode].name}${mm ? ', last lap ran ' + MODES[mm].name : ''}. Press to change.`);
  }

  // koşucu
  runner.style.display = DESIGN.showRunner ? '' : 'none';
  const len = (started ? state.segment + state.progress : 0) * SEG_LEN;
  const p = pointAt(len), q = pointAt(len + 3);
  const dir = q.x - p.x >= -0.2 ? 1 : -1;
  const mode = state.actual || 'J';
  const lean = DESIGN.runnerPosture ? LEAN[mode] + (state.zone === 'low' ? 10 : 0) : 6;
  const swing = DESIGN.runnerPosture ? SWING[mode] : 24;
  const a = state.status === 'running' ? Math.sin(state.phase) * swing : 0;
  setAttr(runner, 'transform', `translate(${p.x.toFixed(1)},${(p.y + 8).toFixed(1)})`);
  setAttr(body, 'transform', `scale(${dir * 1.25},1.25) rotate(${lean})`);
  setAttr(legF, 'transform', `translate(0,-18) rotate(${a.toFixed(1)})`);
  setAttr(legB, 'transform', `translate(0,-18) rotate(${(-a).toFixed(1)})`);
  setAttr(armF, 'transform', `translate(0,-30) rotate(${(-a * 0.8).toFixed(1)})`);
  setAttr(armB, 'transform', `translate(0,-30) rotate(${(a * 0.8).toFixed(1)})`);

  // pist ortası
  let centerText = '';
  if (state.status === 'ready') centerText = 'Ready · Space to run';
  else if (state.status === 'paused') centerText = `Paused at segment ${state.segment + 1}` + (DESIGN.showStatus ? ` · energy ${Math.round(state.energy)}` : '');
  else if (DESIGN.showStatus) centerText = `Lap ${state.lap}`;
  setText($('centerLabel'), centerText);

  // enerji çubuğu
  const meter = $('meter');
  meter.classList.toggle('is-off', !DESIGN.showEnergyBar);
  meter.classList.toggle('is-low', state.zone === 'low');
  $('meterFill').style.height = (state.energy / DESIGN.maxEnergy * 100) + '%';
  $('meterLow').style.bottom = (DESIGN.lowThreshold / DESIGN.maxEnergy * 100) + '%';
  setText($('meterValue'), String(Math.round(state.energy)));
  setText($('meterZone'), state.zone === 'low' ? 'Low' : '');

  // HUD
  const show = DESIGN.showStatus;
  setText($('hudState'), show ? state.status : '?');
  setText($('hudSegment'), show ? (started ? `${state.segment + 1} / ${N}` : `– / ${N}`) : '?');
  setText($('hudEnergy'), show ? String(Math.round(state.energy)) : '?');
  setText($('hudMode'), show ? (started ? `${state.planned} → ${state.actual}` : '–') : '?');

  // buton etiketi
  setText($('btnRun'), state.status === 'running' ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Run');

  // alt yazı
  let cap;
  if (now < state.flash.until) cap = state.flash.text;
  else if (state.status === 'ready') cap = 'Plan the track, then press Space to run.';
  else if (state.status === 'paused') cap = 'Paused. Position, energy and plan are kept.';
  else if (DESIGN.showMismatch && state.planned !== state.actual) cap = `Energy too low: planned ${MODES[state.planned].name}, running ${MODES[state.actual].name}.`;
  else if (!DESIGN.showRunner) cap = 'No runner. Can you hear the pace?';
  else cap = 'The runner shows where the pace is now.';
  setText($('caption'), cap);
}

// ================================================================
// döngü: zaman ilerler → kural çalışır → çizilir
// ================================================================
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(100, now - lastT); // sekme arka plandaysa büyük sıçramayı engelle
  lastT = now;

  if (state.status === 'running') {
    state.progress += dt / segDuration();
    while (state.progress >= 1) { state.progress -= 1; advance(); }
    state.phase += dt * STRIDE[state.actual];

    state.stepTimer -= dt;
    if (state.stepTimer <= 0) {
      if (DESIGN.footstepSound) footstep(state.actual);
      state.stepTimer += STEP_MS[state.actual];
    }
    const tired = 1 - state.energy / DESIGN.maxEnergy;
    state.breathTimer -= dt;
    if (state.breathTimer <= 0) {
      if (DESIGN.breathSound) breath(tired);
      state.breathTimer += 1800 - 1200 * tired;
    }
  }

  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
