// Late Signal — Feedback × Temporality (NMED 3203 midterm)
// Stadyumda engelli koşu. Alçak engelleri HOP ile (bedava), uzun engelleri LEAP ile (40 enerji) geç.
// FEEDBACK  : koşucunun gizli bir enerjisi var; sağ üstteki çubuk bu durumu gösterir.
// TEMPORALITY: çubuk ŞU ANKİ enerjiyi değil, feedbackDelay saniye ÖNCEKİ enerjiyi gösterir.
// Bağ: çubuk ve geri sarma aynı saklanan geçmişi (history[]) okur. Düşersen R ile geri sar;
//      geri sarılan deneme pistte iz olarak kalır ve zamanla solar.
//
// Girdi: hop · leap · rewind · Kural: leap() enerji harcar, shownEnergy() = energy(t − delay)
// Durum: energy, history[], traces[] · Çıktı: gecikmeli çubuk, koşucu, izler, zaman şeridi, ses
//
// Sıra: DESIGN → state → rule → input → output

'use strict';

// ================================================================
// 1) DESIGN — bütün kurallar ve sayılar burada (canlı değişiklik için)
// ================================================================
const DESIGN = {
  // hareket
  runSpeed: 320,        // px/sn · koşu hızı (50 px = 1 m)
  jumpTime: 0.62,       // sn · havada kalma süresi (hop ve leap aynı)
  hopHeight: 58,        // px · HOP yüksekliği: alçak engeli (46) geçer, uzun engeli (70) geçemez
  leapHeight: 125,      // px · LEAP yüksekliği: uzun engeli geçer
  pxPerMeter: 50,

  // FEEDBACK: gizli durum = enerji
  maxEnergy: 200,
  startEnergy: 100,
  leapCost: 40,         // LEAP bu kadar enerji harcar; yetmezse zayıf zıplama (= hop) olur
  energyRegen: 15,      // enerji/sn · sürekli dolar

  // TEMPORALITY: çubuğun gecikmesi
  feedbackDelay: 1.5,   // sn · çubuk bu kadar önceki enerjiyi gösterir (0 = canlı)
  showEnergyBar: true,  // çubuğu tamamen gizle / göster
  showDelayLabel: true, // çubuğun üstünde "1.5 s AGO" etiketi

  // geri sarma ve hafıza
  rewindLength: 3,      // sn · R ile kaç saniye geri gidilir
  rewindSpeed: 3,       // geri sarma oynatma hızı
  historyWindow: 5,     // sn · zaman şeridinde görünen geçmiş
  readyMs: 1200,        // ms · "3-2-1-GO" beklemesi
  traceFade: 25,        // sn · iz bu sürede yavaşça solar
  keepTraces: 2,        // gösterilen eski deneme sayısı

  // sinyaller
  showTraces: true,
  showArrivalCue: true, // sonraki engele kalan saniye + HOP / LEAP ipucu
  showTimeline: true,
  vhsEffect: true,
  sound: true,

  // parkur — her denemede aynı (karşılaştırılabilir hareket)
  course: [
    { x: 900 }, { x: 1350, tall: true }, { x: 1800 }, { x: 2050 },
    { x: 2500, tall: true }, { x: 2950, tall: true }, { x: 3450 }, { x: 3700 },
    { x: 3950, tall: true }, { x: 4600 }, { x: 5200, tall: true }, { x: 5650, tall: true },
    { x: 6100, tall: true }
  ],
  finish: 6700
};

// panelde gösterilen anahtarlar
const TOGGLES = [
  ['showEnergyBar', 'Energy bar', 'FEEDBACK · the only view of energy'],
  ['showDelayLabel', 'Delay label on bar', 'FEEDBACK · say the bar is late'],
  ['showTraces', 'Attempt traces', 'MEMORY · the past leaves a mark'],
  ['showArrivalCue', 'Arrival cue', 'seconds to hurdle · hop or leap'],
  ['showTimeline', 'Timeline strip', 'now · shown · history · rewind'],
  ['vhsEffect', 'Rewind tape effect', 'feel of rewinding'],
  ['sound', 'Sound', 'steps · beeps · tape']
];
const RANGES = [
  ['feedbackDelay', 'Bar delay', 0, 4, 0.5, 's', 'TEMPORALITY · how late the bar is'],
  ['leapCost', 'Leap cost', 10, 80, 5, '', 'FEEDBACK · energy per leap'],
  ['energyRegen', 'Energy regen', 5, 30, 1, '/s', 'how fast energy returns'],
  ['rewindLength', 'Rewind length', 1, 5, 0.5, 's', 'how far R goes back'],
  ['runSpeed', 'Run speed', 240, 420, 20, 'px/s', 'keep equal across trials']
];
// karşılaştırma ön ayarları — sadece çubuğun gecikmesi değişir
const PRESETS = {
  delay0: { feedbackDelay: 0 },
  delay15: { feedbackDelay: 1.5 },
  delay3: { feedbackDelay: 3 }
};

const W = 960, H = 540;          // mantıksal canvas boyutu
const RUNNER_X = 250;            // koşucunun ekrandaki sabit x'i
const FOOT_Y = 448;              // pistte ayak çizgisi
const HIT_HALF = 16;             // engel çarpışma yarı genişliği
const FALL_TIME = 0.7;           // düşme animasyonu süresi
const STRIDE = 0.05;             // px başına adım fazı
const LOW_H = 46, TALL_H = 70;   // engel yükseklikleri
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ================================================================
// 2) STATE — sistemin sakladığı her şey
// ================================================================
const START_FRAME = { t: 0, dist: 0, y: 0, mode: 'run', airT: 0, jumpH: 0, phase: 0, fallStart: -1, energy: 100 };

const state = {
  status: 'idle',          // idle | ready | running | fallen | rewinding | paused | finished
  pausedFrom: null,
  clock: 0,                // gerçek zaman (sekme gizliyken durur) · solma ve efektler için
  simT: 0,                 // simülasyon zamanı · geri sarınca geri gider
  dist: 0, y: 0, mode: 'run', airT: 0, jumpH: 0, phase: 0, fallStart: -1,
  energy: DESIGN.startEnergy, // GİZLİ DURUM: oyuncu bunu doğrudan görmez
  history: [],             // SAKLANAN GEÇMİŞ: çubuk ve geri sarma buradan okur
  events: [],              // { t, type: 'hop' | 'leap' | 'weak' | 'fall', dist, energy, shown }
  traces: [],              // geri sarılan denemeler
  hurdles: [],
  attempt: 1, rewinds: 0,
  rewind: { from: 0, cursor: 0, target: 0 },
  readyStart: 0, readyPausedAt: 0, readyBeat: -1, goT: -9, finishT: 0, shakeT: -9,
  takeoff: null,           // son sıçramadaki gerçek ve gösterilen enerji
  lastFall: null,          // son düşmenin gerçek ve gösterilen enerjisi
  lowAnnounced: false,
  flash: { text: '', until: 0 }
};

function makeHurdles() {
  return DESIGN.course.map((h) => ({ x: h.x, tall: !!h.tall, knockT: null }));
}
state.hurdles = makeHurdles();

// ================================================================
// 3) RULE — tasarım kuralları (çizimden bağımsız)
// ================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hurdleHeight = (h) => (h.tall ? TALL_H : LOW_H);
const keepSeconds = () => Math.max(DESIGN.historyWindow, DESIGN.rewindLength, DESIGN.feedbackDelay) + 0.5;
const meters = (px) => Math.round(px / DESIGN.pxPerMeter);

function record() {
  const { simT: t, dist, y, mode, airT, jumpH, phase, fallStart, energy } = state;
  state.history.push({ t, dist, y, mode, airT, jumpH, phase, fallStart, energy });
  const oldest = state.simT - keepSeconds();
  while (state.history.length > 2 && state.history[0].t < oldest) state.history.shift();
}

// geçmişten t anını oku (zaman damgasına göre, kare hızından bağımsız)
function sample(t) {
  const h = state.history;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i];
  return h[0] || START_FRAME;
}

// FEEDBACK × TEMPORALITY: çubuğun gösterdiği enerji = feedbackDelay saniye önceki enerji
function shownEnergy(t = state.simT) {
  if (state.status === 'idle') return DESIGN.startEnergy;
  return sample(t - DESIGN.feedbackDelay).energy;
}

function startRun() {
  fullReset(false);
  state.history = [{ ...START_FRAME, energy: DESIGN.startEnergy }];
  beginReady();
  announce('Get ready.');
}

function beginReady() {
  state.status = 'ready';
  state.readyStart = state.clock;
  state.readyBeat = -1;
}

// girdi: kind = 'hop' | 'leap'
function act(kind) {
  ensureAudio();
  const s = state.status;
  if (s === 'idle' || s === 'finished') { startRun(); return; }
  if (s === 'paused') { togglePause(); return; }
  if (s === 'ready') { flash('Wait for GO.'); return; }
  if (s === 'fallen') { flash('Press R to rewind.'); return; }
  if (s !== 'running') return;
  if (state.mode === 'air') { flash('Already in the air.'); return; }
  jump(kind);
}

// KURAL: HOP bedava ve alçak. LEAP yüksek ama leapCost enerji ister; yetmezse zayıf zıplama.
function jump(kind) {
  // sıçrama anındaki gerçek ve gösterilen enerji (düşersen ekranda karşılaştırılır)
  state.takeoff = { t: state.simT, energy: Math.round(state.energy), shown: Math.round(shownEnergy()) };
  let type = 'hop', h = DESIGN.hopHeight;
  if (kind === 'leap') {
    if (state.energy >= DESIGN.leapCost) {
      type = 'leap';
      h = DESIGN.leapHeight;
      state.energy -= DESIGN.leapCost;
    } else {
      type = 'weak'; // enerji yetmedi: sadece hop kadar zıplar, enerji harcanmaz
      flash(`Weak leap: only ${Math.round(state.energy)} energy, a leap needs ${DESIGN.leapCost}.`);
      announce('Weak leap. Not enough energy.');
    }
  }
  state.mode = 'air';
  state.airT = 0;
  state.jumpH = h;
  state.events.push({ t: state.simT, type, dist: state.dist });
  if (type === 'weak') { sfx.weak(); burst(state.dist, 6); } else sfx.whoosh(type === 'leap');
}

function stepSim(dt) {
  state.simT += dt;
  // enerji sürekli dolar
  state.energy = Math.min(DESIGN.maxEnergy, state.energy + DESIGN.energyRegen * dt);

  if (state.mode === 'run' || state.mode === 'air') {
    state.dist += DESIGN.runSpeed * dt;
    if (state.mode === 'air') {
      state.airT += dt;
      const u = state.airT / DESIGN.jumpTime;
      if (u >= 1) { state.mode = 'run'; state.airT = 0; state.y = 0; onLand(); }
      else state.y = 4 * state.jumpH * u * (1 - u);
      state.phase += dt * 4;
    } else {
      const prev = state.phase;
      state.phase += DESIGN.runSpeed * dt * STRIDE;
      if (Math.floor(state.phase / Math.PI) !== Math.floor(prev / Math.PI)) onFootstep();
    }
    // çarpışma: ayak engelin üstünden geçmediyse düş
    for (const h of state.hurdles) {
      if (h.knockT !== null) continue;
      if (Math.abs(h.x - state.dist) < HIT_HALF && state.y < hurdleHeight(h) - 4) { fall(h); break; }
    }
    if (state.status === 'running' && state.dist >= DESIGN.finish) { finish(); return; }
  } else if (state.mode === 'fallen') {
    const u = (state.simT - state.fallStart) / FALL_TIME;
    state.dist += DESIGN.runSpeed * dt * Math.max(0, 1 - u) * 0.6;
    state.y = Math.max(0, state.y - 320 * dt);
  }
  record();
  watchShownEnergy();
}

// gösterilen (gecikmeli) enerji LEAP eşiğinin altına inince duyur — gerçek enerji değil
function watchShownEnergy() {
  const low = shownEnergy() < DESIGN.leapCost;
  if (low && !state.lowAnnounced) announce('Bar shows energy below leap cost.');
  state.lowAnnounced = low;
}

function fall(h) {
  h.knockT = state.simT;
  // zıplarken düştüysen sıçrama anını, hiç zıplamadıysan şu anı göster
  const tk = state.takeoff && state.simT - state.takeoff.t <= DESIGN.jumpTime + 0.05
    ? state.takeoff
    : { energy: Math.round(state.energy), shown: Math.round(shownEnergy()) };
  state.lastFall = { energy: tk.energy, shown: tk.shown, dist: state.dist };
  state.mode = 'fallen';
  state.fallStart = state.simT;
  state.status = 'fallen';
  state.events.push({ t: state.simT, type: 'fall', dist: state.dist, energy: tk.energy, shown: tk.shown });
  state.shakeT = state.clock;
  sfx.clatter();
  burst(state.dist, 16);
  announce(`Fell at ${meters(state.dist)} m. Real energy ${state.lastFall.energy}, the bar showed ${state.lastFall.shown}. Press R to rewind.`);
}

function finish() {
  state.status = 'finished';
  state.finishT = state.clock;
  confettiBurst();
  sfx.cheer();
  announce(`Finish. ${state.attempt} attempts, ${state.rewinds} rewinds. Press Space to run again.`);
}

// geri sarma: geçmişi tersten oynat, sonra t − rewindLength anından devam et
function startRewind() {
  ensureAudio();
  const s = state.status;
  if (s !== 'running' && s !== 'fallen') {
    if (s === 'idle' || s === 'finished') flash('Start a run first.');
    return;
  }
  if (state.history.length < 2 || state.simT < 0.2) { flash('Nothing to rewind yet.'); return; }
  const target = Math.max(state.history[0].t, state.simT - DESIGN.rewindLength);
  state.rewind = { from: state.simT, cursor: state.simT, target };
  state.status = 'rewinding';
  particles.length = 0;
  sfx.tapeStart();
  announce('Rewinding.');
}

function stepRewind(dt) {
  const r = state.rewind;
  r.cursor -= dt * DESIGN.rewindSpeed;
  if (r.cursor <= r.target) { r.cursor = r.target; endRewind(); }
}

function endRewind() {
  const { from, target } = state.rewind;
  // geri sarılan kısım silinmez → iz olur
  const discarded = state.history.filter((e) => e.t > target);
  const evs = state.events.filter((e) => e.t > target);
  if (discarded.length) {
    state.traces.unshift({
      attempt: state.attempt,
      born: state.clock,
      points: discarded.filter((_, i) => i % 2 === 0).map((e) => ({ d: e.dist, y: e.y })),
      jumps: evs.filter((e) => e.type !== 'fall').map((e) => ({ d: e.dist, type: e.type })),
      fall: evs.find((e) => e.type === 'fall') || null,
      dropAt: null
    });
    state.traces.forEach((tr, i) => { if (i >= DESIGN.keepTraces && tr.dropAt === null) tr.dropAt = state.clock; });
  }
  state.history = state.history.filter((e) => e.t <= target);
  state.events = state.events.filter((e) => e.t <= target);
  const e = state.history[state.history.length - 1] || START_FRAME;
  Object.assign(state, {
    simT: e.t, dist: e.dist, y: e.y, airT: e.airT, jumpH: e.jumpH, phase: e.phase, energy: e.energy,
    mode: e.mode === 'fallen' ? 'run' : e.mode, fallStart: -1
  });
  for (const h of state.hurdles) if (h.knockT !== null && h.knockT > target) h.knockT = null;
  state.attempt++;
  state.rewinds++;
  sfx.tapeStop();
  beginReady();
  announce(`Rewound ${(from - target).toFixed(1)} seconds. Attempt ${state.attempt}. Get ready.`);
}

function togglePause() {
  if (state.status === 'paused') {
    state.status = state.pausedFrom;
    if (state.status === 'ready') state.readyStart = state.clock - state.readyPausedAt;
    announce('Resumed.');
  } else if (state.status === 'running' || state.status === 'ready') {
    state.pausedFrom = state.status;
    state.readyPausedAt = state.clock - state.readyStart;
    state.status = 'paused';
    announce('Paused.');
  }
}

// Reset: kayıtlı bütün konumları ve izleri siler
function fullReset(say = true) {
  Object.assign(state, {
    status: 'idle', simT: 0, dist: 0, y: 0, mode: 'run', airT: 0, jumpH: 0, phase: 0, fallStart: -1,
    energy: DESIGN.startEnergy, history: [], events: [], traces: [], attempt: 1, rewinds: 0,
    goT: -9, takeoff: null, lastFall: null, lowAnnounced: false
  });
  state.hurdles = makeHurdles();
  particles.length = 0;
  confetti.length = 0;
  sfx.tapeStop();
  if (say) { flash('Reset. All history and traces cleared.'); announce('Reset.'); }
}

function onFootstep() { sfx.step(); if (!reduceMotion) burst(state.dist - 8, 2); }
function onLand() { sfx.step(); burst(state.dist, 7); }

// ================================================================
// 4) INPUT — klavye, dokunmatik, etiketli butonlar
// ================================================================
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

// sahneye dokunmak = hop (butonlar ve klavye aynı işi yapar)
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.focus(); act('hop'); });
$('btnHop').addEventListener('click', () => act('hop'));
$('btnLeap').addEventListener('click', () => act('leap'));
$('btnRewind').addEventListener('click', startRewind);
$('btnStart').addEventListener('click', () => {
  ensureAudio();
  if (state.status === 'idle' || state.status === 'finished') startRun();
  else togglePause();
});
$('btnReset').addEventListener('click', () => fullReset());

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return; // kaydırıcı / onay kutusu kendi tuşlarını kullanır
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'a' || e.code === 'Space' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!e.repeat) act('hop');
  } else if (k === 's' || e.key === 'Shift' || k === 'x') {
    if (!e.repeat) act('leap');
  } else if (k === 'r') {
    startRewind();
  } else if (k === 'p') {
    togglePause();
  } else if (e.key === 'Enter' && (state.status === 'idle' || state.status === 'finished')) {
    if (e.target === canvas || e.target === document.body) { e.preventDefault(); startRun(); }
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault();
});

// sekme gizlenince simülasyon zamanı ve geçmiş donar
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state.status === 'running' || state.status === 'ready')) togglePause();
});

// --- DESIGN paneli ---
const rangeInputs = {};
for (const [key, label, note] of TOGGLES) {
  const l = document.createElement('label');
  l.className = 'toggle';
  l.innerHTML = `<input type="checkbox"><span><code>${key}</code> ${label}<small>${note}</small></span>`;
  const input = l.querySelector('input');
  input.checked = DESIGN[key];
  input.addEventListener('change', () => { DESIGN[key] = input.checked; });
  $('toggleList').appendChild(l);
}
for (const [key, label, min, max, step, unit, note] of RANGES) {
  const l = document.createElement('label');
  l.className = 'range';
  l.innerHTML = `<span><code>${key}</code> ${label} <span class="val"></span><small>${note}</small></span><input type="range" min="${min}" max="${max}" step="${step}">`;
  const input = l.querySelector('input'), val = l.querySelector('.val');
  input.value = DESIGN[key];
  val.textContent = DESIGN[key] + ' ' + unit;
  input.addEventListener('input', () => {
    DESIGN[key] = Number(input.value);
    val.textContent = input.value + ' ' + unit;
    syncPresets();
  });
  $('rangeList').appendChild(l);
  rangeInputs[key] = { input, val, unit };
}
document.querySelectorAll('[data-preset]').forEach((b) => {
  b.addEventListener('click', () => {
    Object.assign(DESIGN, PRESETS[b.dataset.preset]);
    for (const k in rangeInputs) {
      rangeInputs[k].input.value = DESIGN[k];
      rangeInputs[k].val.textContent = DESIGN[k] + ' ' + rangeInputs[k].unit;
    }
    syncPresets();
    fullReset(false);
    const name = b.textContent.replace(/\s+/g, ' ').trim();
    flash(`${name}: fresh trial. Same course, history cleared.`);
    announce(`${name}. Fresh trial.`);
  });
});
function syncPresets() {
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const p = PRESETS[b.dataset.preset];
    b.setAttribute('aria-pressed', String(Object.keys(p).every((k) => DESIGN[k] === p[k])));
  });
}
syncPresets();

// ================================================================
// 5) OUTPUT — stadyum, koşucu, gecikmeli çubuk, izler, zaman şeridi, ses
// ================================================================
let scale = 1;
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.getBoundingClientRect().width || W;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * dpr * H / W);
  scale = canvas.width / W;
}
window.addEventListener('resize', fit);
fit();

function flash(text) { state.flash = { text, until: state.clock + 2.4 }; }
let pendingAnnounce = '';
function announce(text) {
  const live = $('live');
  live.textContent = '';
  pendingAnnounce = text;
  setTimeout(() => { live.textContent = pendingAnnounce; }, 30);
}

// --- parçacıklar ---
const particles = [];   // toz: dünya koordinatında
const confetti = [];    // konfeti: ekran koordinatında
function burst(wx, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      wx: wx + (Math.random() - 0.5) * 10, y: FOOT_Y - 2,
      vx: -40 - Math.random() * 90, vy: -30 - Math.random() * 70,
      life: 0, max: 0.4 + Math.random() * 0.35, r: 3 + Math.random() * 4
    });
  }
}
function confettiBurst() {
  if (reduceMotion) return;
  const cols = ['#c6f432', '#1f6fff', '#ffd166', '#ff4d6d', '#ffffff', '#b388ff'];
  for (let i = 0; i < 140; i++) {
    confetti.push({
      x: W / 2 + (Math.random() - 0.5) * 200, y: 200,
      vx: (Math.random() - 0.5) * 700, vy: -250 - Math.random() * 400,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      c: cols[i % cols.length], life: 0, max: 2.2 + Math.random()
    });
  }
}

// --- ses (Web Audio, kütüphane yok) ---
let audio = null, noiseBuf = null, tape = null;
function ensureAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume();
}
const canPlay = () => DESIGN.sound && audio && audio.state === 'running';
function noise({ type = 'bandpass', freq, q = 1, attack = 0.005, dur, gain }) {
  if (!canPlay()) return;
  const t = audio.currentTime, src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(audio.destination);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, gain = 0.1, type = 'square', delay = 0) {
  if (!canPlay()) return;
  const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  step: () => noise({ freq: 320, q: 1.6, dur: 0.05, gain: 0.22 }),
  whoosh: (big) => noise({ type: 'highpass', freq: big ? 600 : 1100, attack: 0.03, dur: big ? 0.4 : 0.22, gain: big ? 0.18 : 0.1 }),
  weak: () => { tone(160, 0.22, 0.14, 'triangle'); noise({ freq: 400, q: 0.8, dur: 0.15, gain: 0.15 }); },
  clatter: () => { noise({ freq: 2400, q: 0.8, dur: 0.3, gain: 0.35 }); tone(110, 0.25, 0.18, 'triangle'); },
  beep: () => tone(660, 0.12, 0.08),
  go: () => tone(990, 0.32, 0.1),
  cheer: () => { noise({ freq: 1100, q: 0.6, attack: 0.35, dur: 2.2, gain: 0.22 }); [1400, 1700, 1500].forEach((f, i) => tone(f, 0.25, 0.04, 'sine', 0.3 + i * 0.35)); },
  tapeStart() {
    if (!canPlay() || tape) return;
    const t = audio.currentTime, o = audio.createOscillator(), lfo = audio.createOscillator(), lg = audio.createGain(), f = audio.createBiquadFilter(), g = audio.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(180, t + 2);
    lfo.frequency.value = 9; lg.gain.value = 40; lfo.connect(lg).connect(o.detune);
    f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0.045;
    o.connect(f).connect(g).connect(audio.destination); o.start(t); lfo.start(t);
    tape = { o, lfo };
  },
  tapeStop() {
    if (!tape) return;
    try { tape.o.stop(); tape.lfo.stop(); } catch (err) { /* zaten durmuş */ }
    tape = null;
  }
};

// --- yardımcılar ---
const sx = (wx, cam) => RUNNER_X + (wx - cam);
const font = (size, w = 900, italic = true) => `${italic ? 'italic ' : ''}${w} ${size}px "Segoe UI Black", "Arial Black", system-ui, sans-serif`;
const mono = (size, w = 700) => `${w} ${size}px ui-monospace, Consolas, monospace`;
function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ekranda gösterilecek an: canlı durum ya da geri sarılan geçmiş
function viewState() {
  if (state.status === 'rewinding') return { ...sample(state.rewind.cursor), t: state.rewind.cursor };
  const { simT: t, dist, y, mode, airT, jumpH, phase, fallStart, energy } = state;
  return { t, dist, y, mode, airT, jumpH, phase, fallStart, energy };
}

// --- arka plan: gökyüzü, ışıklar, tribün, reklam panoları ---
function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, 340);
  g.addColorStop(0, '#120f3d');
  g.addColorStop(0.55, '#3a3a9e');
  g.addColorStop(1, '#f39a58');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 340);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i))) * 0.7;
    ctx.fillRect(hash(i) * W, hash(i + 50) * 120, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawLights(cam) {
  const off = (cam * 0.12) % 520;
  for (let x = -off - 40; x < W + 80; x += 520) {
    ctx.fillStyle = '#1a2246';
    ctx.fillRect(x + 18, 40, 6, 120);
    const glow = ctx.createRadialGradient(x + 21, 40, 4, x + 21, 40, 120);
    glow.addColorStop(0, 'rgba(255,250,220,.55)');
    glow.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 100, -80, 242, 240);
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(x, 30, 42, 18);
    ctx.fillStyle = '#c9c2a0';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 10, 33, 6, 12);
  }
}

const CROWD = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff', '#c6f432', '#ff8c42', '#b388ff'];
function drawStands(cam, t) {
  ctx.fillStyle = '#111733';
  ctx.fillRect(0, 150, W, 182);
  ctx.fillStyle = '#0a0f24';
  ctx.fillRect(0, 140, W, 14);
  const par = cam * 0.25, col = 15;
  const first = Math.floor(par / col) - 1;
  for (let r = 0; r < 6; r++) {
    const rowY = 178 + r * 25;
    ctx.fillStyle = r % 2 ? '#18204a' : '#1c2656';
    ctx.fillRect(0, rowY + 8, W, 14);
    for (let i = first; i < first + W / col + 3; i++) {
      const x = i * col - par + (r % 2) * 7;
      const hsh = hash(i * 7.1 + r * 13.7);
      if (hsh < 0.12) continue; // boş koltuk
      // tribün dalgası: kalabalık sırayla ayağa kalkar
      const wave = reduceMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * 1.6 - i * 0.12)), 6) * 9;
      const bob = reduceMotion ? 0 : Math.sin(t * 6 + i * 1.7 + r) * 1.2;
      const y = rowY - wave + bob;
      ctx.fillStyle = CROWD[Math.floor(hsh * CROWD.length)];
      ctx.fillRect(x - 5, y + 3, 10, 10);
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = hsh > 0.55 ? '#e8b38a' : '#8d5a3b';
      ctx.fill();
      if (wave > 6) { // kollar havada
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x - 7, y - 6); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 7, y - 6); ctx.stroke();
      }
    }
  }
  // dalgalanan bayraklar
  const foff = (cam * 0.25) % 300;
  for (let x = -foff; x < W + 40; x += 300) {
    ctx.fillStyle = '#2a3260';
    ctx.fillRect(x, 96, 3, 46);
    ctx.beginPath();
    ctx.moveTo(x + 3, 98);
    for (let k = 0; k <= 8; k++) ctx.lineTo(x + 3 + k * 5, 98 + Math.sin(t * 5 + k * 0.7 + x) * 3);
    for (let k = 8; k >= 0; k--) ctx.lineTo(x + 3 + k * 5, 118 + Math.sin(t * 5 + k * 0.7 + x) * 3);
    ctx.closePath();
    ctx.fillStyle = (Math.round(x / 300) & 1) ? '#c6f432' : '#b388ff';
    ctx.fill();
  }
}

const BOARDS = [
  ['#0f1730', '#c6f432', 'FEEDBACK'], ['#b388ff', '#0f1730', 'TEMPORALITY'],
  ['#c6f432', '#0f1730', 'LATE SIGNAL'], ['#1f6fff', '#ffffff', 'HOP · LEAP'],
  ['#ffd166', '#0f1730', 'READ THE PAST'], ['#0f1730', '#ffffff', 'NMED 3203']
];
function drawBoards(cam) {
  const bw = 240, par = cam * 0.7, first = Math.floor(par / bw) - 1;
  ctx.textAlign = 'center';
  for (let i = first; i < first + W / bw + 3; i++) {
    const x = i * bw - par;
    const [bg, fg, txt] = BOARDS[((i % BOARDS.length) + BOARDS.length) % BOARDS.length];
    ctx.fillStyle = bg;
    ctx.fillRect(x, 332, bw - 4, 34);
    ctx.fillStyle = fg;
    ctx.font = font(17);
    ctx.fillText(txt, x + bw / 2 - 2, 355);
  }
  ctx.textAlign = 'left';
}

// --- pist ---
function drawTrack(cam) {
  const g = ctx.createLinearGradient(0, 366, 0, 484);
  g.addColorStop(0, '#e2643a');
  g.addColorStop(1, '#b23d1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 366, W, 118);
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  const toff = cam % 12;
  for (let x = -toff; x < W; x += 12) ctx.fillRect(x, 366, 1, 118);
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  [372, 412, 462, 480].forEach((y) => ctx.fillRect(0, y, W, 2.5));
  ctx.font = font(20);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  const loff = cam % 800;
  for (let x = -loff + 80; x < W; x += 800) ctx.fillText('3', x, 403);
  // mesafe işaretleri (her 10 m)
  const step = 10 * DESIGN.pxPerMeter;
  for (let m = Math.floor((cam - RUNNER_X) / step) * step; m < cam + W; m += step) {
    if (m <= 0 || m >= DESIGN.finish) continue;
    const x = sx(m, cam);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillRect(x, 412, 2, 50);
    ctx.font = font(13);
    ctx.fillText(meters(m) + ' m', x + 5, 476);
  }
  const s0 = sx(0, cam);
  if (s0 > -20 && s0 < W + 20) { ctx.fillStyle = '#fff'; ctx.fillRect(s0 - 3, 412, 6, 50); }
  // bitiş: damalı çizgi ve kemer
  const fx = sx(DESIGN.finish, cam);
  if (fx > -120 && fx < W + 120) {
    for (let r = 0; r < 10; r++) for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
      ctx.fillRect(fx - 8 + c * 8, 412 + r * 5, 8, 5);
    }
    ctx.fillStyle = '#e9ecff';
    ctx.fillRect(fx - 70, 250, 6, 200);
    ctx.fillRect(fx + 64, 250, 6, 200);
    ctx.fillStyle = '#c6f432';
    ctx.fillRect(fx - 76, 236, 152, 34);
    ctx.fillStyle = '#0f1730';
    ctx.font = font(22);
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', fx, 261);
    ctx.textAlign = 'left';
  }
}

// --- engeller: alçak (HOP) ve uzun (LEAP) ---
function drawHurdles(cam, t) {
  for (const h of state.hurdles) {
    const x = sx(h.x, cam);
    if (x < -60 || x > W + 60) continue;
    let ang = 0;
    if (h.knockT !== null && h.knockT <= t) ang = clamp((t - h.knockT) / 0.3, 0, 1) * 1.35;
    const hh = hurdleHeight(h);
    ctx.save();
    ctx.translate(x, FOOT_Y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(-16, 1, 34, 4);
    ctx.strokeStyle = '#3a3f5c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(8, -hh - 4); ctx.moveTo(-6, -6); ctx.lineTo(20, -6); ctx.stroke();
    // çizgili tahta: uzun engel lime-lacivert, alçak engel kırmızı-beyaz (yazı da var)
    const bx = -6, by = -hh - 10, bw2 = 20, bh = 15;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = h.tall ? (i % 2 ? '#0f1730' : '#c6f432') : (i % 2 ? '#ffffff' : '#ff3355');
      ctx.fillRect(bx + i * (bw2 / 4), by, bw2 / 4 + 0.5, bh);
    }
    ctx.strokeStyle = '#1b1b28'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw2, bh);
    ctx.strokeStyle = '#1b1b28'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hh + 4); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.restore();
    if (ang === 0) {
      ctx.font = mono(13, 900); ctx.fillStyle = h.tall ? '#c6f432' : '#ffffff';
      ctx.textAlign = 'center'; ctx.fillText(h.tall ? 'LEAP · S' : 'HOP · A', x + 4, FOOT_Y - hh - 16); ctx.textAlign = 'left';
    }
  }
}

// --- izler: geri sarılan denemeler silinmez, soluk iz olarak kalır ---
function traceAlpha(tr) {
  let a = Math.exp(-(state.clock - tr.born) / DESIGN.traceFade);
  if (tr.dropAt !== null) a *= Math.max(0, 1 - (state.clock - tr.dropAt) / 1.2);
  return a;
}
function drawTraces(cam) {
  state.traces = state.traces.filter((tr) => traceAlpha(tr) > 0.03);
  state.traces.forEach((tr, i) => {
    const solid = i === 0;
    const a = traceAlpha(tr) * (solid ? 1 : 0.7);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = solid ? '#c6f432' : '#ffffff';
    ctx.lineWidth = solid ? 3 : 2;
    ctx.setLineDash(solid ? [] : [7, 6]);
    ctx.beginPath();
    let started = false;
    for (const p of tr.points) {
      const x = sx(p.d, cam);
      if (x < -20 || x > W + 20) { started = false; continue; }
      const y = FOOT_Y - 4 - p.y;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // zayıf zıplamalar işaretlenir: "burada enerji yetmedi"
    for (const j of tr.jumps) {
      if (j.type !== 'weak') continue;
      const x = sx(j.d, cam);
      if (x < -40 || x > W + 40) continue;
      ctx.fillStyle = '#ff8c42';
      ctx.font = mono(10, 800); ctx.textAlign = 'center';
      ctx.fillText('WEAK LEAP', x, FOOT_Y + 26);
      ctx.beginPath(); ctx.moveTo(x, FOOT_Y + 8); ctx.lineTo(x - 6, FOOT_Y + 16); ctx.lineTo(x + 6, FOOT_Y + 16); ctx.closePath(); ctx.fill();
      ctx.textAlign = 'left';
    }
    // düşme noktası: gerçek ve gösterilen enerji
    if (tr.fall) {
      const x = sx(tr.fall.dist, cam);
      if (x > -60 && x < W + 60) {
        ctx.strokeStyle = solid ? '#ff4d6d' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash(solid ? [] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(x - 8, FOOT_Y - 18); ctx.lineTo(x + 8, FOOT_Y - 2);
        ctx.moveTo(x + 8, FOOT_Y - 18); ctx.lineTo(x - 8, FOOT_Y - 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // okunaklı etiket: koyu zemin üstünde
        const label = `TRY ${tr.attempt}: REAL ${tr.fall.energy} · BAR ${tr.fall.shown}`;
        ctx.font = mono(10, 800);
        const lw = ctx.measureText(label).width + 14;
        ctx.fillStyle = 'rgba(10,15,36,.85)';
        roundRect(x - lw / 2, FOOT_Y - 132, lw, 18, 9); ctx.fill();
        ctx.fillStyle = solid ? '#ff8fa3' : '#ffffff'; ctx.textAlign = 'center';
        ctx.fillText(label, x, FOOT_Y - 119);
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
  });
}

// --- geliş işareti: sonraki engele kaç saniye ve ne gerekiyor ---
function drawArrivalCue(cam, v) {
  if (state.status !== 'running' && state.status !== 'ready' && state.status !== 'paused') return;
  const next = state.hurdles.find((h) => h.knockT === null && h.x > v.dist + HIT_HALF);
  if (!next) return;
  const eta = (next.x - v.dist) / DESIGN.runSpeed;
  if (eta > 2.5) return;
  const k = 1 - eta / 2.5, need = next.tall ? 'LEAP' : 'HOP';
  const x = sx(next.x, cam), hh = hurdleHeight(next);
  ctx.save();
  ctx.fillStyle = next.tall ? '#c6f432' : '#ffffff';
  if (x > W - 20) {
    ctx.globalAlpha = 0.4 + 0.6 * k;
    roundRect(W - 150, FOOT_Y - 96, 138, 30, 8); ctx.fill();
    ctx.fillStyle = '#0a0f24'; ctx.font = font(13);
    ctx.fillText(`${need} IN ${eta.toFixed(1)} s ▶`, W - 140, FOOT_Y - 76);
  } else {
    ctx.globalAlpha = 0.5 + 0.5 * k;
    roundRect(x - 30, FOOT_Y - hh - 62, 68, 22, 6); ctx.fill();
    ctx.fillStyle = '#0a0f24'; ctx.font = mono(12, 800); ctx.textAlign = 'center';
    ctx.fillText(eta.toFixed(1) + ' s', x + 4, FOOT_Y - hh - 47);
  }
  ctx.restore();
}

// --- GECİKMELİ ENERJİ ÇUBUĞU (Feedback × Temporality'nin kalbi) ---
function drawEnergyBar(v) {
  const delay = DESIGN.feedbackDelay;
  const shown = shownEnergy(v.t);
  const x = 682, y = 16, w = 262, h = 74;
  const low = shown < DESIGN.leapCost;
  ctx.save();
  ctx.fillStyle = 'rgba(10,15,36,.82)';
  roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = delay > 0 ? '#b388ff' : '#c6f432'; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 10); ctx.stroke();
  // başlık: gecikme etiketi
  ctx.font = mono(11, 800);
  ctx.fillStyle = '#9aa6cc';
  ctx.fillText('ENERGY', x + 12, y + 18);
  if (DESIGN.showDelayLabel) {
    // playtest sonrası: etiket artık dolu bir rozet; leap'ten sonra çubuk geride kaldığı sürece yanıp söner
    const label = delay > 0 ? `◷ SHOWN ${delay} s AGO` : '● LIVE';
    ctx.font = mono(12, 900);
    const tw = ctx.measureText(label).width, px = x + w - 10 - tw - 14, py = y + 5;
    let lastLeap = null;
    for (let i = state.events.length - 1; i >= 0; i--) if (state.events[i].type === 'leap') { lastLeap = state.events[i]; break; }
    const behind = delay > 0 && lastLeap && v.t - lastLeap.t >= 0 && v.t - lastLeap.t < delay;
    ctx.globalAlpha = behind ? 0.55 + 0.45 * Math.abs(Math.sin(state.clock * 8)) : 1;
    ctx.fillStyle = delay > 0 ? '#b388ff' : '#c6f432';
    roundRect(px, py, tw + 14, 18, 9); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0f24';
    ctx.fillText(label, px + 7, py + 13);
    ctx.font = mono(11, 800);
  }
  // çubuk
  const bx = x + 12, by = y + 28, bw = w - 70, bh = 18;
  ctx.fillStyle = '#1a2340';
  ctx.fillRect(bx, by, bw, bh);
  const fw = bw * clamp(shown / DESIGN.maxEnergy, 0, 1);
  if (low) {
    // düşük: renk + çizgili desen (renk tek sinyal değil)
    for (let k = 0; k < fw; k += 8) {
      ctx.fillStyle = (k / 8) % 2 ? '#ff4d6d' : '#ff8fa3';
      ctx.fillRect(bx + k, by, Math.min(8, fw - k), bh);
    }
  } else {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#1f6fff'); g.addColorStop(1, '#6ea2ff');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, fw, bh);
  }
  // LEAP maliyet çizgisi
  const cx = bx + bw * DESIGN.leapCost / DESIGN.maxEnergy;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 1.5, by - 4, 3, bh + 8);
  ctx.font = mono(9, 800);
  ctx.fillText('LEAP', cx - 11, by + bh + 14);
  // sayı ve durum sözcüğü
  ctx.font = font(24);
  ctx.fillStyle = low ? '#ff8fa3' : '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(shown)), x + w - 12, by + 17);
  ctx.font = mono(10, 800);
  ctx.fillText(low ? 'LOW' : 'OK', x + w - 12, by + bh + 14);
  ctx.textAlign = 'left';
  ctx.restore();
}

// --- koşucu: prosedürel animasyon (koşu, hop / leap, düşme) ---
const SKIN = '#b97a56', JERSEY = '#b388ff', SHORTS = '#0e1a3a', SHOE = '#c6f432';
function limb(x, y, a1, a2, l1, l2, w, color) {
  // açı aşağıdan ölçülür, pozitif = ileri (sağa)
  const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a2) * l2, ey = ky + Math.cos(a2) * l2;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
  return { x: ex, y: ey, a: a2 };
}
function shoe(end, color) {
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(-end.a * 0.6); // ayakkabı baldıra dik kalır
  ctx.beginPath(); ctx.ellipse(4, 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawRunner(v) {
  const finished = state.status === 'finished';
  let lean = 0.22, bob = 0, rot = 0;
  const legs = [], arms = [];
  if (v.mode === 'air') {
    const u = clamp(v.airT / DESIGN.jumpTime, 0, 1);
    const tuck = Math.sin(u * Math.PI) * clamp(v.jumpH / DESIGN.leapHeight, 0.5, 1);
    lean = 0.35;
    legs.push([0.4 + 1.0 * tuck, 0.4 + 1.0 * tuck - (0.5 + 1.1 * tuck)]);
    legs.push([-0.35 - 0.4 * tuck, -0.35 - 0.4 * tuck - (0.6 + 0.6 * tuck)]);
    arms.push([1.2 * tuck + 0.3, 1.2 * tuck + 1.6]);
    arms.push([-0.6 - 0.6 * tuck, -0.6 - 0.6 * tuck + 1.2]);
  } else if (v.mode === 'fallen') {
    const u = clamp((v.t - v.fallStart) / FALL_TIME, 0, 1), e = 1 - Math.pow(1 - u, 3);
    rot = e * 1.35;
    lean = 0.3;
    legs.push([0.5 - 0.6 * e, 0.5 - 0.6 * e - 0.4]);
    legs.push([-0.4, -1.2]);
    arms.push([1.6 * e + 0.2, 1.6 * e + 0.8]);
    arms.push([1.2 * e, 1.2 * e + 0.6]);
  } else {
    const speed = finished ? Math.max(0.2, 1 - (state.clock - state.finishT) / 1.5) : 1;
    bob = -Math.abs(Math.sin(v.phase)) * 4 * speed;
    lean = 0.12 + 0.12 * speed;
    for (let k = 0; k < 2; k++) {
      const p = v.phase + k * Math.PI;
      const thigh = Math.sin(p) * 0.85 * speed;
      const knee = 0.2 + (Math.cos(p) < 0 ? -Math.cos(p) * 1.5 : 0.1) * speed;
      legs.push([thigh, thigh - knee]);
      const sh = -Math.sin(p) * 0.9 * speed;
      arms.push([sh, sh + 1.4]);
    }
  }

  const footY = FOOT_Y - v.y;
  const shd = clamp(1 - v.y / 240, 0.35, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * shd})`;
  ctx.beginPath(); ctx.ellipse(RUNNER_X, FOOT_Y + 3, 24 * shd, 5 * shd, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(RUNNER_X, footY);
  ctx.rotate(rot);
  const hipX = 0, hipY = -50 + bob;
  const shX = hipX + Math.sin(lean) * 34, shY = hipY - Math.cos(lean) * 34;
  // uzak kol ve bacak (koyu)
  limb(shX, shY, arms[1][0], arms[1][1], 17, 16, 6, '#8a5a3f');
  shoe(limb(hipX, hipY, legs[1][0], legs[1][1], 26, 26, 8, '#8a5a3f'), '#9cbf27');
  // şort ve forma
  ctx.strokeStyle = SHORTS; ctx.lineWidth = 15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + Math.sin(lean) * 8, hipY - Math.cos(lean) * 8); ctx.stroke();
  ctx.strokeStyle = JERSEY; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(hipX + Math.sin(lean) * 6, hipY - Math.cos(lean) * 6); ctx.lineTo(shX, shY); ctx.stroke();
  ctx.save();
  ctx.translate((hipX + shX) / 2 + 1, (hipY + shY) / 2);
  ctx.rotate(lean);
  ctx.fillStyle = '#0f1730'; ctx.font = font(10); ctx.textAlign = 'center';
  ctx.fillText('34', 0, 4);
  ctx.restore();
  // yakın bacak
  shoe(limb(hipX, hipY, legs[0][0], legs[0][1], 26, 26, 9, SKIN), SHOE);
  // kafa ve saç bandı
  const hx = shX + Math.sin(lean) * 13, hy = shY - Math.cos(lean) * 13;
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20140c';
  ctx.beginPath(); ctx.arc(hx - 1, hy - 2, 9.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.strokeStyle = SHOE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hx, hy, 9.6, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke();
  const flap = reduceMotion ? 0 : Math.sin(state.clock * 18) * 3;
  ctx.beginPath(); ctx.moveTo(hx - 8, hy - 4); ctx.lineTo(hx - 18, hy - 2 + flap); ctx.stroke();
  // yakın kol
  limb(shX, shY, arms[0][0], arms[0][1], 17, 16, 7, SKIN);
  ctx.restore();
}

// --- hız çizgileri ve parçacıklar ---
function drawSpeedLines(v) {
  if (reduceMotion || state.status !== 'running' || v.mode === 'fallen') return;
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    const y = 250 + ((k * 53) % 170);
    const x = W - ((state.clock * 1100 + k * 190) % (W + 200));
    if (x > RUNNER_X - 10) continue;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y); ctx.stroke();
  }
}
function updateParticles(dt) {
  for (const p of particles) { p.life += dt; p.wx += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.vx *= 0.96; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life > particles[i].max || particles[i].y > FOOT_Y + 6) particles.splice(i, 1);
  for (const c of confetti) { c.life += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 500 * dt; c.vx *= 0.99; c.rot += c.vr * dt; }
  for (let i = confetti.length - 1; i >= 0; i--) if (confetti[i].life > confetti[i].max) confetti.splice(i, 1);
}
function drawParticles(cam) {
  ctx.fillStyle = '#f3c9a8';
  for (const p of particles) {
    ctx.globalAlpha = (1 - p.life / p.max) * 0.6;
    ctx.beginPath(); ctx.arc(sx(p.wx, cam), p.y, p.r * (1 + p.life * 2), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawConfetti() {
  for (const c of confetti) {
    ctx.save();
    ctx.globalAlpha = 1 - c.life / c.max;
    ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.c; ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}

// --- zaman şeridi: şimdi · çubuğun gösterdiği an · saklanan geçmiş · geri sarma ---
function drawTimeline() {
  ctx.fillStyle = '#0a0f24';
  ctx.fillRect(0, 484, W, 56);
  if (!DESIGN.showTimeline) {
    ctx.fillStyle = '#5b678f'; ctx.font = mono(11);
    ctx.fillText('TIMELINE HIDDEN', 24, 516);
    return;
  }
  const x0 = 120, x1 = 900, y = 500, h = 14;
  const rew = state.status === 'rewinding';
  const now = rew ? state.rewind.from : state.simT;
  const play = rew ? state.rewind.cursor : state.simT;
  const map = (t) => clamp(x1 - (now - t) / DESIGN.historyWindow * (x1 - x0), x0, x1);

  ctx.font = mono(10);
  ctx.fillStyle = '#9aa6cc';
  ctx.fillText('TIME', 24, 504);
  ctx.fillText(`−${DESIGN.historyWindow} s`, x0, 534);
  ctx.fillText('NOW', x1 - 22, 534);
  ctx.fillStyle = '#1a2340';
  ctx.fillRect(x0, y, x1 - x0, h);

  if (state.history.length) {
    // saklanan geçmiş
    const hx = map(state.history[0].t);
    ctx.fillStyle = '#2c4a9e';
    ctx.fillRect(hx, y, x1 - hx, h);
    if (x1 - hx > 160) { ctx.fillStyle = '#cfe0ff'; ctx.fillText('STORED HISTORY', hx + 6, y + 11); }
    // geri sarma penceresi (çizgili)
    const rx = map(now - DESIGN.rewindLength);
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, y - 3, x1 - rx, h + 6); ctx.clip();
    ctx.fillStyle = 'rgba(255,209,102,.5)';
    for (let k = rx - 20; k < x1 + 20; k += 8) {
      ctx.beginPath(); ctx.moveTo(k, y + h + 3); ctx.lineTo(k + 4, y + h + 3); ctx.lineTo(k + 12, y - 3); ctx.lineTo(k + 8, y - 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
    ctx.strokeRect(rx, y - 3, x1 - rx, h + 6);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`REWIND ${DESIGN.rewindLength} s`, rx, y - 6);
    // olaylar
    for (const e of state.events) {
      if (e.t < now - DESIGN.historyWindow) continue;
      const ex = map(e.t);
      if (e.type === 'fall') {
        ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex - 4, y + h + 2); ctx.lineTo(ex + 4, y + h + 10); ctx.moveTo(ex + 4, y + h + 2); ctx.lineTo(ex - 4, y + h + 10); ctx.stroke();
      } else {
        const s = e.type === 'leap' ? 6 : 4;
        ctx.fillStyle = e.type === 'leap' ? '#c6f432' : e.type === 'weak' ? '#ff8c42' : '#ffffff';
        ctx.beginPath(); ctx.moveTo(ex, y + h + 2); ctx.lineTo(ex - s, y + h + 9); ctx.lineTo(ex + s, y + h + 9); ctx.closePath(); ctx.fill();
      }
    }
  }
  // çubuğun gösterdiği an (gecikme ofseti)
  if (DESIGN.feedbackDelay > 0 && state.status !== 'idle') {
    const sxm = map(play - DESIGN.feedbackDelay);
    ctx.fillStyle = '#b388ff';
    ctx.fillRect(sxm - 2, y - 8, 4, h + 16);
    ctx.font = mono(10, 800);
    ctx.textAlign = 'center';
    ctx.fillText('BAR SHOWS', sxm, 534);
    ctx.textAlign = 'left';
  }
  // şimdi imleci
  const px = map(play);
  ctx.strokeStyle = rew ? '#ffd166' : '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, y - 6); ctx.lineTo(px, y + h + 6); ctx.stroke();
  ctx.fillStyle = rew ? '#ffd166' : '#ffffff';
  ctx.beginPath(); ctx.arc(px, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
}

// --- üst katmanlar: başlık, sayım, geri sarma, düşme, bitiş ---
function drawOverlays(v) {
  const s = state.status;

  if (s === 'idle') {
    ctx.fillStyle = 'rgba(10,15,36,.6)';
    ctx.fillRect(0, 0, W, 484);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b388ff'; ctx.font = font(64);
    ctx.fillText('LATE SIGNAL', W / 2, 200);
    ctx.fillStyle = '#fff'; ctx.font = font(20, 800, false);
    ctx.fillText('A = HOP low hurdles (free).  S = LEAP tall hurdles (40 energy).', W / 2, 244);
    ctx.fillText('Your energy bar is late. Leap only when you really have it.', W / 2, 272);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.clock * 4);
    ctx.fillStyle = '#c6f432'; ctx.font = font(22);
    ctx.fillText('SPACE / TAP TO START', W / 2, 326);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (s === 'ready' || (s === 'paused' && state.pausedFrom === 'ready')) {
    const e = (s === 'paused' ? state.readyPausedAt : state.clock - state.readyStart) / (DESIGN.readyMs / 1000);
    const n = 3 - Math.floor(e * 3), frac = (e * 3) % 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,15,36,.35)'; ctx.fillRect(0, 0, W, 484);
    ctx.fillStyle = '#fff'; ctx.font = font(18, 800, false);
    ctx.fillText(state.attempt > 1 ? `ATTEMPT ${state.attempt} · READY` : 'READY', W / 2, 170);
    ctx.save();
    ctx.translate(W / 2, 250);
    const sc = reduceMotion ? 1 : 1 + 0.6 * (1 - frac);
    ctx.scale(sc, sc);
    ctx.globalAlpha = reduceMotion ? 1 : 0.35 + 0.65 * frac;
    ctx.fillStyle = '#c6f432'; ctx.font = font(84);
    ctx.fillText(String(clamp(n, 1, 3)), 0, 30);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  if (s === 'running' && state.clock - state.goT < 0.6) {
    const u = (state.clock - state.goT) / 0.6;
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.translate(W / 2, 240);
    if (!reduceMotion) ctx.scale(1 + u * 0.8, 1 + u * 0.8);
    ctx.fillStyle = '#c6f432'; ctx.font = font(80); ctx.textAlign = 'center';
    ctx.fillText('GO!', 0, 28);
    ctx.restore();
  }

  // düşünce gerçeği göster: gerçek enerji ile çubuğun gösterdiği
  if (s === 'fallen' && state.lastFall && v.t - v.fallStart > FALL_TIME * 0.6) {
    const f = state.lastFall;
    ctx.fillStyle = 'rgba(10,15,36,.9)';
    roundRect(W / 2 - 210, 150, 420, 116, 14); ctx.fill();
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2;
    roundRect(W / 2 - 210, 150, 420, 116, 14); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = font(18, 800, false);
    ctx.fillText(`AT TAKE-OFF: REAL ${f.energy}   ·   BAR ${f.shown}`, W / 2, 186);
    ctx.fillStyle = '#9aa6cc'; ctx.font = mono(12);
    ctx.fillText(DESIGN.feedbackDelay > 0 ? `The bar was ${DESIGN.feedbackDelay} s behind.` : 'The bar was live.', W / 2, 210);
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(state.clock * 6);
    ctx.fillStyle = '#ffd166'; ctx.font = font(22);
    ctx.fillText(`◀◀ R = REWIND ${DESIGN.rewindLength} s`, W / 2, 248);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (s === 'rewinding') {
    const back = state.rewind.from - state.rewind.cursor;
    if (DESIGN.vhsEffect) {
      ctx.fillStyle = 'rgba(60,0,110,.18)';
      ctx.fillRect(0, 0, W, 484);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      for (let yy = 0; yy < 484; yy += 3) ctx.fillRect(0, yy, W, 1);
      if (!reduceMotion) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.06 * k})`;
          ctx.fillRect(0, (state.clock * 400 + k * 170) % 484, W, 4 + k * 2);
        }
      }
    }
    ctx.fillStyle = '#fff'; ctx.font = font(30);
    ctx.fillText(`◀◀ REWIND  −${back.toFixed(1)} s`, 24, 52);
  }

  if (s === 'paused') {
    ctx.fillStyle = 'rgba(10,15,36,.55)'; ctx.fillRect(0, 0, W, 484);
    ctx.fillStyle = '#fff'; ctx.font = font(48); ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, 250);
    ctx.font = font(16, 800, false);
    ctx.fillText('P to resume · time and history are frozen', W / 2, 284);
    ctx.textAlign = 'left';
  }

  if (s === 'finished') {
    ctx.save();
    ctx.globalAlpha = clamp((state.clock - state.finishT) / 0.5, 0, 1);
    ctx.fillStyle = 'rgba(10,15,36,.5)'; ctx.fillRect(0, 0, W, 484);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c6f432'; ctx.font = font(64);
    ctx.fillText('FINISH!', W / 2, 220);
    ctx.fillStyle = '#fff'; ctx.font = font(20, 800, false);
    ctx.fillText(`${state.attempt} attempt${state.attempt > 1 ? 's' : ''} · ${state.rewinds} rewind${state.rewinds === 1 ? '' : 's'} · bar delay ${DESIGN.feedbackDelay} s`, W / 2, 258);
    ctx.fillStyle = '#ffd166'; ctx.font = font(18);
    ctx.fillText('SPACE TO RUN AGAIN · TRY ANOTHER BAR DELAY', W / 2, 300);
    ctx.restore();
  }
  drawConfetti();
}

// --- HTML çıktıları ---
function setText(id, text) { const n = $(id); if (n.textContent !== text) n.textContent = text; }
function updateDom() {
  const s = state.status;
  setText('hudAttempt', String(state.attempt));
  setText('hudRewinds', String(state.rewinds));
  setText('hudPos', `${meters(Math.min(state.dist, DESIGN.finish))} / ${meters(DESIGN.finish)} m`);
  setText('hudDelay', DESIGN.feedbackDelay > 0 ? DESIGN.feedbackDelay + ' s' : 'live');
  setText('btnStart', s === 'idle' || s === 'finished' ? 'Start' : s === 'paused' ? 'Resume' : 'Pause');

  let cap;
  if (state.clock < state.flash.until) cap = state.flash.text;
  else if (s === 'idle') cap = 'Press Space (or tap) to start.';
  else if (s === 'ready') cap = 'Get ready… control returns on GO.';
  else if (s === 'fallen' && state.lastFall) cap = `Fell at ${meters(state.lastFall.dist)} m. At take-off your real energy was ${state.lastFall.energy}, the bar showed ${state.lastFall.shown}. Press R to rewind.`;
  else if (s === 'rewinding') cap = 'Rewinding… the bar and the runner read the same stored history.';
  else if (s === 'paused') cap = 'Paused. Time and history are frozen.';
  else if (s === 'finished') cap = `Finish! ${state.attempt} attempts, ${state.rewinds} rewinds. Try another bar delay.`;
  else if (DESIGN.feedbackDelay > 0) cap = `The bar is ${DESIGN.feedbackDelay} s late. Hop the low ones to save energy for the tall ones.`;
  else cap = 'The bar is live. Hop the low hurdles, leap the tall ones.';
  setText('caption', cap);
}

// ================================================================
// döngü: zaman ilerler → kural çalışır → çizilir
// ================================================================
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); // büyük sıçramaları engelle
  lastT = now;
  const s = state.status;
  if (s !== 'paused') state.clock += dt;

  if (s === 'ready') {
    const e = state.clock - state.readyStart, beat = Math.floor(e / (DESIGN.readyMs / 3000));
    if (beat !== state.readyBeat && beat < 3) { state.readyBeat = beat; sfx.beep(); }
    if (e >= DESIGN.readyMs / 1000) {
      state.status = 'running';
      state.goT = state.clock;
      sfx.go();
      announce('Go.');
    }
  } else if (s === 'running') {
    stepSim(dt);
  } else if (s === 'fallen') {
    if (state.simT - state.fallStart < FALL_TIME * 1.2) stepSim(dt);
  } else if (s === 'rewinding') {
    stepRewind(dt);
  } else if (s === 'finished') {
    // bitişten sonra koşucu yavaşlayarak durur (kayıt yok)
    const k = Math.max(0, 1 - (state.clock - state.finishT) / 1.5);
    state.dist += DESIGN.runSpeed * dt * k;
    state.phase += DESIGN.runSpeed * dt * STRIDE * Math.max(0.2, k);
  }
  if (s !== 'paused') updateParticles(dt);

  render();
  updateDom();
  requestAnimationFrame(frame);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const v = viewState();
  const cam = v.dist;
  let shx = 0, shy = 0;
  if (!reduceMotion) {
    const st = state.clock - state.shakeT;
    if (st < 0.35) { const k = (1 - st / 0.35) * 7; shx = (Math.random() - 0.5) * k; shy = (Math.random() - 0.5) * k; }
    if (state.status === 'rewinding' && DESIGN.vhsEffect) shx += (Math.random() - 0.5) * 3;
  }
  ctx.save();
  ctx.translate(shx, shy);
  drawSky(state.clock);
  drawLights(cam);
  drawStands(cam, state.clock);
  drawBoards(cam);
  drawTrack(cam);
  if (DESIGN.showTraces) drawTraces(cam);
  drawHurdles(cam, v.t);
  if (DESIGN.showArrivalCue) drawArrivalCue(cam, v);
  drawParticles(cam);
  drawRunner(v);
  drawSpeedLines(v);
  ctx.restore();
  if (state.status !== 'idle' && DESIGN.showEnergyBar) drawEnergyBar(v);
  drawTimeline();
  drawOverlays(v);
}

requestAnimationFrame(frame);
