// 02 · Pazarlık Tezgâhı — Sahil Balıkçısı. İskelenin başında Rıza Kaptan'la pazarlık edersin; kaptan teklifini, sözünü ve sessizliğini hatırlar.
// Girdi: teklif / kibar söz / vazgeçmek / beklemek · Kural: respond() + güven · Durum: güven puanı, hakaret izi, ruh hali · Çıktı: poz, balon, yeni fiyat, martılar, ses
window.OYUNLAR = window.OYUNLAR || {};
window.OYUNLAR['02'] = {
  key: '02', title: 'Pazarlık Tezgâhı', premise: 'Reciprocity', premiseText: 'Every action expects a response.', promise: 'Design the dialogue, not the message.',
  source: 'Eye Field remix — Interaction Island, NMED 3203',
  caption: 'Rıza Kaptan seni süzüyor.', hint: 'ürüne tıkla · kaydırıcıyla teklif ver · KAPTAN, BİR EL AT · ANLAŞTIK / VAZGEÇTİM · beklersen sabrı tükenir · C kod',
  anat: ['teklif · söz · bekleme', 'respond()', 'güven + hakaret izi', 'poz · balon · martılar'], hot: 2,
  hud: [['GÜVEN', 'hTrust', 'gold'], ['FİYAT', 'hAsk', 'ghosts'], ['TUR', 'hTurn']],
  design: { startTrust: 50, insultLine: 0.5, fairLine: 0.7, insultPenalty: 20, fairBonus: 10, kindBonus: 5, friendTrust: 70, patience: 8000, voice: true },
  knobs: [
    { key: 'startTrust', step: 5, min: 5, max: 100, note: 'restart · kaptanın ilk güveni' },
    { key: 'insultLine', step: 0.05, min: 0.1, max: 0.9, note: 'live · bunun altı = ayıp teklif' },
    { key: 'fairLine', step: 0.05, min: 0.3, max: 1, note: 'live · bunun üstü = makul teklif' },
    { key: 'insultPenalty', step: 5, min: 0, max: 60, note: 'live · ayıp teklifin bedeli' },
    { key: 'fairBonus', step: 1, min: 0, max: 30, note: 'live' },
    { key: 'kindBonus', step: 1, min: 0, max: 30, note: 'live · tekrar edilirse işe yaramaz' },
    { key: 'friendTrust', step: 5, min: 10, max: 100, note: 'live · bu güvenin üstünde kabul eder' },
    { key: 'patience', step: 1000, min: 2000, max: 30000, note: 'ms · live' },
    { key: 'voice', type: 'bool', note: 'live' }],
  code: ['<span class="c">// 3) RULE: aynı teklif, farklı geçmiş → farklı cevap</span>',
    '<span class="k">if</span> (offer &gt;= ask) sell(offer);',
    '<span class="k">else if</span> (offer &lt; base * DESIGN.insultLine) { trust -= DESIGN.insultPenalty; insulted = true; ask *= 1.1; }',
    '<span class="k">else if</span> (offer &gt;= base * DESIGN.fairLine) {',
    '  trust += DESIGN.fairBonus;',
    '  <span class="k">if</span> (trust &gt;= DESIGN.friendTrust) sell(offer);',
    '  <span class="k">else</span> ask -= (ask - offer) * (0.3 + trust / 200);',
    '}',
    '<span class="k">if</span> (trust &lt; 25) mood = \'kırgın\';  <span class="c">// sistem sadece bir sayı tutar</span>'],
  tasks: ['Bir ürüne önce <b>çok düşük</b>, sonra makul bir teklif ver. Aynı makul teklifi baştan, temiz bir geçmişle dene. Cevap neden değişti?',
    '<b>insultPenalty</b> değerini 0 ve 50 yap. Kaptan alıngan mı, umursamaz mı?',
    '<b>KAPTAN, BİR EL AT</b> düğmesine üst üste bas. Tekrarlanan bir söz neden etkisini kaybediyor?',
    'Martılar ayıp teklifte kaçışıyor. Kaptan memnun olunca bir martı tezgâha konsun.'],
  question: 'Pazarlıkta karşındakinin "küstüğünü" neden anladın? Sistem gerçekte neyi hatırlıyordu?',
  overlay: { title: 'Pazarlık Tezgâhı', text: 'İskelenin başında Rıza Kaptan tezgâhını kurmuş. Taze levrek, deniz kabuğu, olta… Fiyatlar pazarlığa açık, ama kaptan her teklifini hatırlıyor.', cta: 'TEZGÂHA YAKLAŞ' },
  view: { at: [0, 0.75, -0.15], zoom: 3.3, pitch: 0.5 },

  make(ctx) {
    const { THREE, D, group } = ctx;
    const Y = 0.08, TOP = Y + 0.5;
    const $ = (id) => document.getElementById(id);
    const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const SAHIL = { sky: '#bfe3ec', skyNight: '#14233a', sea: '#3d8fb8', seaNight: '#1b3f5c', sand: '#ecd7a6', foam: '#f7fbfb', plank: '#a8794a', silver: '#9fc0cf', shell: '#f2a7a0' };

    // ---- sahil: gökyüzü, deniz, köpük, kumsal, iskele, kayık ----
    const shore = new THREE.Group(); group.add(shore);
    const skyMat = ctx.flat(SAHIL.sky), seaMat = ctx.toon(SAHIL.sea);
    const sky = ctx.mesh(new THREE.PlaneGeometry(40, 10), skyMat, 0, 4, -4.5, false); shore.add(sky);
    const sun = ctx.mesh(new THREE.CircleGeometry(0.35, 24), ctx.flat('warm'), -1.7, 0.3, -4.45, false); shore.add(sun);
    shore.add(ctx.mesh(new THREE.BoxGeometry(40, 0.1, 6), seaMat, 0, -0.05, -1.5, false));
    const waves = Array.from({ length: 12 }, (_, i) => {
      const w = ctx.mesh(new THREE.BoxGeometry(0.5 + (i % 3) * 0.3, 0.01, 0.025), ctx.flat(SAHIL.foam), 0, 0.01, 0, false);
      w.userData = { x: ((i * 37) % 80) / 10 - 4, z: -1.1 - ((i * 53) % 30) / 10, s: 0.3 + (i % 4) * 0.1 }; shore.add(w); return w; });
    shore.add(ctx.mesh(new THREE.BoxGeometry(40, 0.1, 5), ctx.toon(SAHIL.sand), 0, 0.03, 1.6));
    const foam = ctx.mesh(new THREE.BoxGeometry(40, 0.02, 0.06), ctx.flat(SAHIL.foam), 0, 0.03, -0.86, false); shore.add(foam);
    // iskele: kumsaldan denize uzanan tahtalar
    const pier = new THREE.Group(); pier.position.set(1.9, 0.12, -1.3); shore.add(pier);
    for (let i = 0; i < 9; i++) pier.add(ctx.mesh(new THREE.BoxGeometry(0.7, 0.04, 0.17), ctx.toon(i % 2 ? SAHIL.plank : 'wood'), 0, 0, 0.9 - i * 0.2));
    [[-0.33, 0.6], [0.33, 0.6], [-0.33, -0.6], [0.33, -0.6]].forEach(([x, z]) => pier.add(ctx.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), ctx.toon('ink'), x, -0.15, z)));
    // kayık: dalgada sallanır
    const boat = new THREE.Group(); boat.position.set(-2.1, 0.02, -1.6); shore.add(boat);
    boat.add(ctx.mesh(new THREE.BoxGeometry(0.9, 0.16, 0.34), ctx.toon('hot'), 0, 0.05, 0));
    boat.add(ctx.mesh(new THREE.BoxGeometry(0.92, 0.04, 0.36), ctx.toon('paper'), 0, 0.14, 0));
    boat.add(ctx.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5), ctx.toon('ink'), 0.1, 0.5, 0));
    const sail = ctx.mesh(new THREE.ConeGeometry(0.22, 0.55, 3), ctx.toon('paper'), 0.22, 0.5, 0); sail.rotation.y = Math.PI / 2; boat.add(sail);
    // buz dolu balık kasası
    const crate = new THREE.Group(); crate.position.set(-1.25, Y, 0.3); shore.add(crate);
    crate.add(ctx.mesh(new THREE.BoxGeometry(0.45, 0.2, 0.32), ctx.toon('wood'), 0, 0.1, 0));
    crate.add(ctx.mesh(new THREE.BoxGeometry(0.4, 0.03, 0.27), ctx.toon(SAHIL.foam), 0, 0.2, 0));

    // ---- tezgâh: masa, örtü, tente direkleri, mavi-beyaz tente ----
    const stall = new THREE.Group(); group.add(stall);
    stall.add(ctx.mesh(new THREE.BoxGeometry(1.7, 0.48, 0.55), ctx.toon(SAHIL.plank), 0, Y + 0.24, 0));
    stall.add(ctx.mesh(new THREE.BoxGeometry(1.76, 0.03, 0.61), ctx.toon(SAHIL.foam), 0, TOP - 0.005, 0));
    stall.add(ctx.mesh(new THREE.BoxGeometry(1.76, 0.16, 0.02), ctx.toon('cool'), 0, TOP - 0.09, 0.31));
    const postGeo = new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6);
    [[-0.86, 0.26], [0.86, 0.26], [-0.86, -0.75], [0.86, -0.75]].forEach(([x, z]) => stall.add(ctx.mesh(postGeo, ctx.toon('paper'), x, Y + 0.75, z)));
    const awning = new THREE.Group(); awning.position.set(0, Y + 1.5, -0.25); awning.rotation.x = 0.28; stall.add(awning);
    for (let i = 0; i < 6; i++) awning.add(ctx.mesh(new THREE.BoxGeometry(0.3, 0.03, 1.2), ctx.toon(i % 2 ? 'paper' : 'cool'), -0.75 + i * 0.3, 0, 0));
    // tentenin önünde sallanan can simidi
    const ring = ctx.mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 18), ctx.toon('hot'), 0.62, Y + 1.25, 0.32); stall.add(ring);
    const lamp = new THREE.PointLight(0xffd890, 0, 3.5, 1.3); lamp.position.set(0, Y + 1.25, 0.1); stall.add(lamp);
    stall.add(ctx.mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), ctx.flat('warm'), 0, Y + 1.25, 0.1, false));

    // ---- ürünler: her birinin liste fiyatı (base) ve kaptanın istediği fiyat (ask) ----
    function levrek() { const g = new THREE.Group(); const b = ctx.mesh(new THREE.SphereGeometry(0.1, 14, 10), ctx.toon(SAHIL.silver), 0, 0.07, 0); b.scale.set(1.9, 0.75, 0.6); g.add(b);
      const tail = ctx.mesh(new THREE.ConeGeometry(0.07, 0.12, 4), ctx.toon(SAHIL.silver), -0.22, 0.07, 0); tail.rotation.z = Math.PI / 2; g.add(tail);
      g.add(ctx.mesh(new THREE.SphereGeometry(0.018, 6, 6), ctx.flat('ink'), 0.13, 0.09, 0.05, false)); g.rotation.y = 0.3; return g; }
    function kabuk() { const g = new THREE.Group(); const s = ctx.mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), ctx.toon(SAHIL.shell), 0, 0.01, 0); s.scale.set(1, 0.6, 1.05); g.add(s);
      for (let i = -2; i <= 2; i++) { const r = ctx.mesh(new THREE.BoxGeometry(0.012, 0.012, 0.2), ctx.toon('hot'), i * 0.04, 0.05 - Math.abs(i) * 0.012, 0); r.rotation.y = i * 0.25; g.add(r); } return g; }
    function olta() { const g = new THREE.Group(); const rod = ctx.mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.48, 6), ctx.toon('ink'), 0, 0.03, 0); rod.rotation.z = Math.PI / 2; rod.rotation.y = 0.5; g.add(rod);
      const reel = ctx.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), ctx.toon('warm'), -0.12, 0.04, 0.06); reel.rotation.x = Math.PI / 2; g.add(reel);
      g.add(ctx.mesh(new THREE.SphereGeometry(0.025, 8, 6), ctx.toon('hot'), 0.2, 0.03, -0.1)); return g; }
    const items = [
      { id: 'levrek', name: 'Levrek', base: 250, x: -0.55, obj: levrek(), pitch: '"Sabah tuttum, gözü hâlâ parlıyor!"' },
      { id: 'kabuk', name: 'Deniz kabuğu', base: 80, x: 0, obj: kabuk(), pitch: '"Kulağına tut, deniz sesi gelir!"' },
      { id: 'olta', name: 'Olta', base: 400, x: 0.55, obj: olta(), pitch: '"Bununla kılıç balığı bile çekilir!"' }];
    items.forEach((it) => { it.obj.position.set(it.x, TOP, 0.02); stall.add(it.obj); });

    // ---- karakterler: Rıza Kaptan tezgâhın arkasında, gezgin yanında ----
    const usta = ctx.char('char.captain'); usta.root.name = 'riza-kaptan';
    const USIZE = 0.78; usta.root.scale.setScalar(USIZE); usta.root.position.set(0, Y, -0.5); group.add(usta.root);
    const traveler = ctx.char('char.traveler'); traveler.root.scale.setScalar(0.7); traveler.root.position.set(1.15, Y, 0.7); traveler.root.rotation.y = Math.PI; group.add(traveler.root);
    const headY = Y + (usta.height || 1.4) * USIZE + 0.12;

    // ---- martılar: ayıp teklifte kaçışır, sonra geri döner ----
    const gulls = Array.from({ length: 4 }, (_, i) => {
      const g = new THREE.Group(), body = ctx.mesh(new THREE.SphereGeometry(0.045, 8, 6), ctx.toon('paper'), 0, 0, 0, false); body.scale.set(1, 0.8, 1.9); g.add(body);
      const wings = [-1, 1].map((s) => { const w = ctx.mesh(new THREE.BoxGeometry(0.18, 0.01, 0.06), ctx.toon('paper'), s * 0.1, 0, 0, false); g.add(w); return w; });
      const beak = ctx.mesh(new THREE.ConeGeometry(0.012, 0.04, 4), ctx.toon('warm'), 0, 0, 0.09, false); beak.rotation.x = Math.PI / 2; g.add(beak);
      shore.add(g); return { g, wings, a: i * Math.PI / 2, r: 1.5 + i * 0.25, h: 1.9 + i * 0.15, sp: 0.35 + i * 0.06 };
    });

    // ---- durum: sistemin hatırladığı her şey burada ----
    const S = {};
    let simT = 0, audio = null, lastTrust = 0, panicT = -99;
    function reset() {
      Object.assign(S, { trust: D.startTrust, sel: null, hover: null, turn: 0, mood: 'bekliyor', moodT: 0, say: '', insulted: false, kindStreak: 0, leftOnce: false,
        lastAction: 0, idleFired: false, over: false, log: [], spent: 0, saved: 0, lastOffer: 0, yaw: 0 });
      items.forEach((it) => { it.ask = it.base; it.seen = false; it.sold = false; it.obj.visible = true; });
      lastTrust = S.trust; panicT = -99;
    }

    // ---- ses: yalnız ruh hali DEĞİŞİNCE ----
    function tone(f, dur, type = 'sine', vol = 0.18, delay = 0, glide = 1) {
      if (!D.voice || !(audio = ctx.audio())) return; const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    const VOICE = {
      memnun: () => { tone(330, 0.15); tone(440, 0.2, 'sine', 0.18, 0.13); },
      satış: () => { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, i * 0.07)); },
      kararsız: () => tone(220, 0.4, 'triangle', 0.16, 0, 0.85),
      bozuldu: () => { tone(140, 0.35, 'square', 0.1, 0, 0.7); [0.1, 0.25, 0.4].forEach((d) => tone(1500, 0.12, 'sawtooth', 0.04, d, 0.7)); }, // kaptan + kaçışan martılar
      kırgın: () => tone(196, 0.6, 'sine', 0.14, 0, 0.6),
      sabırsız: () => { [0, 0.15, 0.3].forEach((d) => tone(900, 0.05, 'square', 0.06, d)); },
      kapalı: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.18)); }
    };

    // ---- kural ----
    function setMood(mood, say) {
      S.mood = mood; S.moodT = simT; S.say = say; ctx.flash(2);
      if (mood === 'bozuldu' || mood === 'kapalı') panicT = simT;
      if (VOICE[mood]) VOICE[mood]();
    }
    function addTrust(d) { S.trust = clamp(S.trust + d, 0, 100); }
    function remember(you) { S.log.push({ turn: S.turn, you, him: S.say }); if (S.log.length > 3) S.log.shift(); }
    function touch() { S.lastAction = simT; S.idleFired = false; }

    function select(it) {
      if (S.over || !it || it.sold) return;
      touch(); S.sel = it;
      if (!it.seen) { // önceki ürünlerde yaşananlar yeni ürünün ilk fiyatına yansır
        it.seen = true; it.ask = round5(it.base * (1 + (50 - S.trust) / 250));
      }
      const note = it.ask > it.base ? ' (sana böyle)' : it.ask < it.base ? ' (sana özel)' : '';
      setMood(S.trust < 25 ? 'kırgın' : 'bekliyor', it.name + ' mi? ' + it.ask + '₺' + note + '. ' + it.pitch);
      syncSlider(true); updatePanel();
    }

    function sell(price, say) {
      const it = S.sel; it.sold = true; it.obj.visible = false; it.ask = price;
      S.spent += price; S.saved += it.base - price;
      setMood('memnun', say); VOICE['satış']();
      S.over = true;
      const left = items.filter((x) => !x.sold);
      ctx.schedule(() => {
        if (left.length && S.trust > 0) {
          ctx.overlay({ kick: 'ANLAŞMA · ' + it.name.toUpperCase(), title: it.name + ' ' + price + '₺', text: 'Liste fiyatı ' + it.base + '₺ idi. Rıza Kaptan\'ın sana güveni şimdi ' + S.trust + '/100. Kaptan bunu bir sonraki ürünün fiyatında hatırlayacak.',
            choices: [['BAŞKA ÜRÜNE BAK', () => { S.over = false; S.sel = null; ctx.playing(true); touch(); setMood('bekliyor', 'Başka bir arzun var mı?'); updatePanel(); }], ['BAŞTAN BAŞLA', () => ctx.exit()]] });
        } else finish('Pazar bitti', 'Toplam ' + S.spent + '₺ ödedin. Liste fiyatına göre ' + (S.saved >= 0 ? S.saved + '₺ kârdasın.' : (-S.saved) + '₺ fazla verdin.') + ' Kaptanın sana son güveni: ' + S.trust + '/100.');
      }, 1800);
    }
    function finish(title, text) { S.over = true; ctx.schedule(() => ctx.overlay({ kick: 'SON', title, text, choices: [['BAŞTAN BAŞLA', () => ctx.exit()]] }), 50); }

    function offer(value) {
      const it = S.sel; if (S.over || !it) return;
      touch(); S.turn++; S.kindStreak = 0; S.lastOffer = value;
      const r = value / it.base;
      if (value >= it.ask) { addTrust(5); sell(value, 'Rastgele! ' + value + '₺, afiyet olsun.'); }
      else if (r < D.insultLine) {
        addTrust(-D.insultPenalty); S.insulted = true; it.ask = Math.min(round5(it.base * 1.3), round5(it.ask * 1.1));
        setMood('bozuldu', 'Ayıp ettin! ' + value + '₺ mi? Şimdi ' + it.ask + '₺ oldu.');
      } else if (r < D.fairLine) {
        addTrust(-5);
        setMood('kararsız', 'Olmaz o kadar. ' + it.ask + '₺\'den aşağı inemem.');
      } else {
        addTrust(D.fairBonus);
        if (S.trust >= D.friendTrust && value >= it.base * D.fairLine) { sell(value, 'Hadi senin hatırına ' + value + '₺. Çay da benden!'); }
        else {
          const drop = S.trust < 25 ? 0 : (it.ask - value) * (0.3 + S.trust / 200);
          it.ask = Math.max(value + 5, round5(it.ask - drop));
          setMood('kararsız', (S.insulted ? 'İlk teklifin ayıptı ama… ' : 'Yaklaştık. ') + it.ask + '₺ olsun.');
        }
      }
      afterTurn(value + '₺ teklif');
    }
    function kind() {
      if (S.over) return;
      touch(); S.turn++;
      if (S.kindStreak > 0) { addTrust(-2); setMood('sabırsız', 'Laf değil, teklif ver!'); }
      else {
        addTrust(D.kindBonus);
        if (S.sel && S.trust >= 50) { S.sel.ask = Math.max(5, round5(S.sel.ask * 0.95)); setMood('memnun', 'Eyvallah! Senin için ' + S.sel.ask + '₺.'); }
        else setMood('memnun', 'Eyvallah, sağ ol.');
      }
      S.kindStreak++;
      afterTurn('"Kaptan, bir el at"');
    }
    function deal() { if (S.over || !S.sel) return; touch(); S.turn++; S.kindStreak = 0; addTrust(5); sell(S.sel.ask, 'Rastgele! Bereketini gör.'); afterTurn('Anlaştık (' + S.sel.ask + '₺)'); }
    function leave() {
      if (S.over) return;
      touch(); S.turn++;
      if (!S.leftOnce && S.sel && S.trust >= 30) {
        S.leftOnce = true; const it = S.sel;
        it.ask = Math.max(5, round5((it.ask + (S.lastOffer || it.ask * 0.8)) / 2));
        setMood('kararsız', 'Dur dur! Son fiyat ' + it.ask + '₺!');
        afterTurn('Vazgeçtim');
      } else {
        setMood('kırgın', S.trust >= 30 ? 'Peki, kısmet değilmiş.' : 'Güle güle… Bir daha uğrama.');
        afterTurn('Vazgeçtim');
        S.over = true; ctx.schedule(() => finish('Sahilden ayrıldın', 'Arkandan Rıza Kaptan\'ın sesi geliyor: "' + S.say + '" Güven: ' + S.trust + '/100.'), 1500);
      }
    }
    function afterTurn(you) {
      if (!S.over && S.trust <= 0) { setMood('kapalı', 'Sana balık yok! Ben denize açılıyorum.'); S.over = true; remember(you); ctx.schedule(() => finish('Tezgâh kapandı', 'Güven sıfıra indi. Kaptan artık seninle konuşmuyor. Hangi turda bunun geleceğini fark ettin?'), 2000); updatePanel(); return; }
      if (!S.over && S.trust < 25 && S.mood !== 'bozuldu') S.mood = 'kırgın';
      remember(you); syncSlider(false); updatePanel();
    }

    // ---- arayüz: teklif paneli ----
    const panel = { items: $('dealItems'), ask: $('dealAsk'), range: $('dealOffer'), val: $('dealOfferVal'), log: $('dealLog'),
      offer: $('btnOffer'), kind: $('btnKind'), deal: $('btnDeal'), leave: $('btnLeave') };
    panel.items.innerHTML = items.map((it) => '<button type="button" class="btn" data-item="' + it.id + '">' + it.name + '</button>').join('');
    panel.items.addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (b) select(items.find((it) => it.id === b.dataset.item)); });
    panel.range.addEventListener('input', () => { panel.val.textContent = panel.range.value + '₺'; touch(); });
    panel.offer.addEventListener('click', () => offer(Number(panel.range.value)));
    panel.kind.addEventListener('click', kind);
    panel.deal.addEventListener('click', deal);
    panel.leave.addEventListener('click', leave);
    function syncSlider(fresh) {
      const it = S.sel; if (!it) return;
      panel.range.min = round5(it.base * 0.1); panel.range.max = it.ask; panel.range.step = 5;
      if (fresh || Number(panel.range.value) > it.ask) panel.range.value = round5(Math.min(it.ask, it.base * 0.7));
      panel.val.textContent = panel.range.value + '₺';
    }
    function updatePanel() {
      panel.items.querySelectorAll('[data-item]').forEach((b) => { const it = items.find((x) => x.id === b.dataset.item);
        b.disabled = it.sold || S.over; b.setAttribute('aria-pressed', String(S.sel === it)); b.textContent = it.name + (it.sold ? ' ✓' : ''); });
      const none = !S.sel || S.over;
      panel.ask.textContent = S.sel ? S.sel.ask + '₺' : 'ürün seç';
      [panel.offer, panel.deal, panel.range].forEach((el) => { el.disabled = none; });
      panel.kind.disabled = panel.leave.disabled = S.over;
      panel.log.innerHTML = S.log.map((l) => '<li><b>T' + l.turn + '</b> Sen: ' + l.you + '<br><i>Kaptan: ' + l.him + '</i></li>').join('');
    }

    // ---- animasyon: her ruh hali bir poz; deniz, kayık ve martılar hep canlı ----
    const springy = (u, amp, k = 7, w = 18) => 1 - amp * Math.exp(-u * k) * Math.cos(u * w);
    function animate(dt) {
      const u = simT - S.moodT, breathe = Math.sin(simT * 2) * 0.02;
      let yaw = S.sel ? (S.sel.x * 0.6) : 0, sy = 1 + breathe, jump = 0, tilt = 0, droop = 0;
      if (S.mood === 'memnun') { jump = u < 0.45 ? 0.1 * Math.sin(u / 0.45 * Math.PI) : 0; sy = springy(u, 0.18); tilt = Math.sin(simT * 4) * 0.12 * Math.exp(-u * 0.6); }
      else if (S.mood === 'kararsız') { tilt = Math.sin(simT * 1.6) * 0.2; yaw += Math.sin(simT * 0.9) * 0.15; }
      else if (S.mood === 'bozuldu') { yaw = Math.sin(u * 28) * 0.4 * Math.exp(-u * 2.5); sy = 1 + 0.18 * Math.exp(-u * 4) * Math.sin(u * 22); }
      else if (S.mood === 'kırgın') { yaw = 1.1; droop = 0.35; }
      else if (S.mood === 'sabırsız') { jump = Math.abs(Math.sin(simT * 9)) * 0.03; tilt = 0.1; }
      else if (S.mood === 'kapalı') { yaw = Math.PI; droop = 0.4; }
      S.yaw += (yaw - S.yaw) * Math.min(1, dt * (S.mood === 'bozuldu' ? 30 : 5));
      const sx = 1 / Math.sqrt(sy);
      usta.root.rotation.y = S.yaw; usta.root.rotation.z = tilt * 0.3;
      usta.root.scale.set(USIZE * sx, USIZE * sy, USIZE * sx); usta.root.position.y = Y + jump;
      if (usta.head) { usta.head.rotation.z = tilt; usta.head.rotation.x = droop; }
      items.forEach((it) => { const on = S.sel === it, hov = S.hover === it;
        it.obj.position.y = TOP + (on ? 0.05 + Math.sin(simT * 3) * 0.015 : hov ? 0.025 : 0); it.obj.scale.setScalar(on ? 1.12 : 1); });
      traveler.root.rotation.y = Math.atan2((S.sel ? S.sel.x : 0) - 1.15, -0.7);
      // deniz
      waves.forEach((w) => { const d = w.userData; w.position.set(d.x + Math.sin(simT * d.s + d.z) * 0.4, 0.01, d.z); });
      foam.position.z = -0.91 - Math.sin(simT * 0.8) * 0.05;
      boat.position.y = 0.02 + Math.sin(simT * 1.3) * 0.025; boat.rotation.z = Math.sin(simT * 1.1) * 0.06; boat.rotation.x = Math.sin(simT * 0.9) * 0.04;
      ring.rotation.z = Math.sin(simT * 1.4) * 0.15;
      // martılar: panik anında açılır, yükselir ve hızlanır; sonra yavaşça geri gelir
      const p = Math.exp(-Math.max(0, simT - panicT) * 0.5);
      gulls.forEach((m) => {
        m.a += dt * m.sp * (1 + p * 3);
        const r = m.r + p * 2.5;
        m.g.position.set(Math.cos(m.a) * r, m.h + p * 1.2 + Math.sin(simT * 2 + m.r) * 0.05, -0.6 + Math.sin(m.a) * r * 0.6);
        m.g.rotation.y = -m.a; const flap = Math.sin(simT * (8 + p * 10) + m.r * 3) * 0.5;
        m.wings[0].rotation.z = flap; m.wings[1].rotation.z = -flap;
      });
    }
    function pick(e) {
      const p = ctx.toLocal(e, TOP); if (!p) return null;
      let best = null, bd = 0.28; items.forEach((it) => { if (it.sold) return; const d = Math.hypot(p.x - it.x, p.z - 0.02); if (d < bd) { bd = d; best = it; } });
      return best;
    }

    reset();
    return {
      start() { ctx.hide(0, 1, 2, 3, 4, 5); simT = 0; reset(); updatePanel(); }, // orman mekânının tamamı gizlenir; sahili bu oyun kurar
      stop() { lamp.intensity = 0; },
      begin(e) { touch(); setMood('bekliyor', 'Hoş geldin! Buyur, neye bakmıştın?'); updatePanel(); if (e) this.pointer('down', e); },
      pointer(type, e) {
        if (type === 'move') { S.hover = pick(e); ctx.out.style.cursor = S.hover ? 'pointer' : ''; }
        if (type === 'down') { const it = pick(e); if (it) select(it); }
      },
      frame(t, dt) {
        simT += dt;
        if (ctx.isPlaying() && !S.over && (simT - S.lastAction) * 1000 > D.patience && !S.idleFired) {
          S.idleFired = true; addTrust(-3); setMood('sabırsız', S.sel ? 'Balık bekler mi? Kokmadan al!' : 'Hadi ama, bir şeye bak!'); updatePanel();
        }
        animate(dt);
        const night = ctx.night();
        lamp.intensity = night ? 3.5 : 0;
        skyMat.color.set(night ? SAHIL.skyNight : SAHIL.sky); seaMat.color.set(night ? SAHIL.seaNight : SAHIL.sea);
        sun.material.color.set(night ? '#f1e9d8' : ctx.C.warm); // gece ay olur
        if (S.trust !== lastTrust) { lastTrust = S.trust; ctx.bump('hTrust'); }
        let n = 0;
        if (ctx.isPlaying() && S.say) ctx.tag(n++, S.say, new THREE.Vector3(0, headY, -0.5), S.mood === 'bozuldu' || S.mood === 'kapalı', 0, 'say');
        items.forEach((it) => { if (!it.sold) ctx.tag(n++, it.ask + '₺', new THREE.Vector3(it.x, TOP - 0.12, 0.31), S.sel === it, 0, 'price'); });
        ctx.tagsFrom(n);
      },
      // panel sağda: dar ekranda kamerayı kaydır, tezgâh panelin soluna otursun
      view() { const w = ctx.out.clientWidth, h = Math.max(1, ctx.out.clientHeight);
        if (w < 700) return { at: [0, 0.35, -0.15], zoom: 2.7 };
        return { at: [(w >= 1500 ? 0 : 190) * 14.8 / (3.3 * h), 0.75, -0.15] }; },
      hud() { return { hTrust: S.trust, hAsk: S.sel ? S.sel.ask + '₺' : '–', hTurn: S.turn }; },
      rule: () => 'teklif < %' + Math.round(D.insultLine * 100) + ' → güven −' + D.insultPenalty,
      caption() {
        return { bekliyor: 'Rıza Kaptan seni süzüyor.', memnun: 'Kaptan keyifli.', kararsız: 'Kaptan tartıyor…', bozuldu: 'Kaptan bozuldu, martılar kaçıştı.',
          kırgın: 'Kaptan sana küs. İndirim yok.', sabırsız: 'Kaptan sabırsızlanıyor.', kapalı: 'Tezgâh kapandı.' }[S.mood] || '';
      },
      status: () => 'güven ' + S.trust + ' · ruh hali ' + S.mood + ' · hakaret izi ' + (S.insulted ? 'var' : 'yok') + ' · tur ' + S.turn,
      knob(k) { if (k === 'startTrust' && S.turn === 0) { S.trust = D.startTrust; lastTrust = S.trust; } }
    };
  }
};
