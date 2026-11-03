# 03 · Pace Track (Tempo Pisti)

**PREMISE** The system’s state must be understandable.
**PROMISE** Design the feedback loop, not the outcome.

Oval bir pist 8 parçaya bölünmüş. Her parçaya bir komut koyuyorsun: **S**print, **J**og, **W**alk.
Koşucu tur atar ve geçtiği parçanın komutuna göre koşar. Gizli durum **enerji**: Sprint −18, Jog −6, Walk +12.
Enerji planlanan tempoya yetmezse koşucu bir alt tempoya düşer (Sprint → Jog → Walk).
Böylece **kaydedilen plan** ile **gerçekleşen davranış** ayrışır.

| INPUT | RULE | STATE | OUTPUT |
|---|---|---|---|
| tıklama · klavye · Space | `enterSegment()` · `resolveMode()` | `track[8]` · `energy` · `segment` | koşucu · enerji çubuğu · adım sesi · nefes sesi · HUD |

## Kurulum

Kütüphane yok, build yok. `index.html` dosyasını tarayıcıda çift tıklayarak aç.
Ses için sayfaya bir kez tıkla ya da bir tuşa bas (tarayıcılar sesi kullanıcı etkileşiminden önce başlatmaz).

## Kontroller

- Pistteki parçaya ya da **Plan** şeridindeki butona tıkla: Jog → Sprint → Walk → Jog
- Plan şeridinde **← →** gez, **S / J / W** ile doğrudan ata
- **Space** koş / duraklat (duraklatınca konum, enerji ve plan korunur)
- **Z** (veya Ctrl+Z) geri al: neyin geri geldiği yazıyla ve sesle onaylanır
- **R** koşucuyu sıfırla: konum ve enerji başa döner, plan korunur
- **Default plan**: başlangıç planını geri yükler (geri alınabilir)

## Geri bildirim katmanları

| Katman | Ne gösterir | Kanal |
|---|---|---|
| Onay (acknowledge) | Parça zıplar, düdük çalar, "Saved: …" yazar. Sadece *kaydedildi* demek, koşucunun yapabileceği anlamına gelmez. | görsel + ses |
| Durum: konum | Koşucu ve koyulaşan parça | görsel |
| Durum: enerji | Çubuk (düşükken çizgili), koşucunun eğilmesi, nefes sesi | görsel + ses |
| Durum: plan ≠ davranış | Üstü çizili harf ve "now J" rozeti, alt yazı | görsel |
| Düzeltmeyi destekle | Parçaya girince maliyet (−18) o parçada belirir, çubuk hemen değişir | görsel |
| Gerçekleşen tempo | Adım sesinin sıklığı ve perdesi | ses |

## DESIGN objesi (`script.js` en üstü)

- `baseSegmentMs` — Jog modunda bir parçanın süresi. Küçültürsen her şey hızlanır, tahmin etmek zorlaşır.
- `speedFactor` — modların hız çarpanı.
- `energyDelta` — her modun enerji etkisi. Walk'u küçültürsen toparlanma yavaşlar, uyumsuzluk daha sık olur.
- `startEnergy`, `maxEnergy`, `lowThreshold` — başlangıç, üst sınır ve "low" eşiği.
- `lastEditMs` — son düzenlenen parçanın işaretli kalma süresi.
- `defaultPlan` — başlangıç planı. Varsayılan plan ilk turda rahat, ikinci turda enerjiyi yetersiz bırakacak şekilde seçildi.
- `showRunner`, `showEnergyBar`, `runnerPosture`, `showCostPulse`, `showMismatch`, `showStatus` — görsel kanallar.
- `footstepSound`, `breathSound`, `ackOnEdit` — ses kanalları.
- `uphill`, `uphillSegments` — kural değişikliği: yokuş parçalarında harcama iki katı.

Hepsi sayfadaki **Design · feedback channels** panelinden canlı olarak değiştirilebilir.
**All signals / Visual only / Sound only** ön ayarları sadece kanalları değiştirir; kural ve tempo aynı kalır.

## Tasarım görevleri

1. `showEnergyBar`'ı kapat, sadece koşucunun duruşuna bak. Enerjinin düştüğünü hâlâ fark edebiliyor musun?
2. **Sound only** ön ayarına geç. Sadece adım ve nefes sesiyle, koşucunun bir sonraki sprinti kaldırıp kaldıramayacağını tahmin et.
3. `showMismatch`'i kapat. Plan "Sprint" derken koşucunun Jog yaptığını nereden anlıyorsun?
4. `uphill`'i aç. 3. ve 4. parçalardaki farkı nereden fark ediyorsun?
5. **Soru:** Varsayılan planla koş. İkinci turda hangi parçada plan ile davranış ayrışacak? Nereden biliyorsun?

## Manuel kontrol listesi

- [ ] Run → koşucu 1. parçadan başlıyor, HUD `1 / 8` gösteriyor.
- [ ] Sprint parçasında enerji 18 düşüyor, Walk parçasında 12 artıyor, 100'ü geçmiyor.
- [ ] Enerji 18'in altındayken Sprint parçasında koşucu Jog'a düşüyor, harf üstü çiziliyor, "now J" rozeti çıkıyor.
- [ ] Pause → koşucu yerinde kalıyor, ortada "Paused at segment X" yazıyor; Resume aynı yerden devam ediyor.
- [ ] Bir parçayı değiştir → parça zıplıyor, kesikli halka 2.5 sn kalıyor, düdük çalıyor.
- [ ] Undo → "Restored: segment X → …" yazıyor, ters tonlu ses çalıyor.
- [ ] Reset runner → enerji 100, konum başa dönüyor, plan değişmiyor.
- [ ] Sadece klavyeyle (Tab, ← →, S/J/W, Space, Z, R) her şey yapılabiliyor.
- [ ] Ön ayar butonları kanalları değiştiriyor, kuralı değiştirmiyor.

## Karşılaştırma (sınıf arkadaşıyla)

- **Değişen:** sadece kanal. Koşul A **Visual only**, koşul B **Sound only**.
- **Sabit kalan:** plan (Default plan), tempo, `uphill` kapalı, başlangıç enerjisi 100.
- **Her deneme:** Default plan → Reset runner → Run.
- **Katılımcıdan istenen:** İkinci turun başında duraklat ve şunu sor: "Şu an enerji yaklaşık kaç? 4. parçadaki sprint gerçekten sprint olacak mı?"
- **Gözlem:** tahmin ile gerçekleşen arasındaki fark, katılımcının düzeltme yapıp yapmadığı, tereddüt anları.
- Sonucu önceden varsayma; katılımcının kendi söylediklerini not et.

Not: Arayüz metinleri İngilizce, kod yorumları ve bu notlar Türkçe.
