# Canlı değişiklik kılavuzu (sunum için, Türkçe)

Hoca sunumda küçük bir değişiklik isteyecek. Hepsi `script.js` içinde. Satır numaraları bu sürüm içindir; dosyayı değiştirirsen `Ctrl+F` ile **anahtar kelimeyi** ara.

## Düzenleme ve yayınlama akışı (sunumdan önce MUTLAKA dene)

1. GitHub'da repoyu aç → klavyede **`.`** tuşuna bas → web editörü açılır.
2. `late-signal/script.js` dosyasını aç, değişikliği yap.
3. Soldaki **Source Control** → mesaj yaz (ör. `live change: delay x2`) → **Commit & Push**.
4. Repodaki **Actions** sekmesinde yeşil tik çıkana kadar bekle (1–2 dk).
5. Oyunu **Ctrl+Shift+R** ile yenile.

**Daha hızlı yol:** Birçok değişiklik sayfadaki **Design** panelinden kodsuz da yapılabilir (kaydırıcılar / onay kutuları). Önce panelde göster, sonra koddaki satırı göster: "Bu kaydırıcı şu satırdaki değeri değiştiriyor."

**Yedek:** Çalışan sürümün bir kopyasını bilgisayarında tut. Bir şey bozulursa: "Şunu değiştirdim, şu yüzden bozuldu" de, eski satırı geri yaz.

## Kurallar nerede?

| Ne | Anahtar kelime | Satır |
|---|---|---|
| Bütün sayılar | `const DESIGN` | 18 |
| Koşu hızı | `runSpeed` | 20 |
| Hop / leap yüksekliği | `hopHeight`, `leapHeight` | 22–23 |
| Leap maliyeti | `leapCost` | 29 |
| Enerji dolma hızı | `energyRegen` | 30 |
| **Çubuğun gecikmesi (Temporality)** | `feedbackDelay` | 33 |
| Çubuğu gizle/göster | `showEnergyBar` | 34 |
| Geri sarma süresi | `rewindLength` | 38 |
| Parkur (engel yerleri) | `course` | 53 |
| Karşılaştırma butonları | `const PRESETS` | 80 |
| **Gecikmeli okuma kuralı** | `function shownEnergy` | 148 |
| **Leap kuralı (Feedback)** | `function jump` | 180 |
| Enerjinin dolması | `state.energy = Math.min` | 205 |
| Tuşlar | `act('hop')`, `act('leap')` | 376–378 |
| Çubuğun çizimi | `function drawEnergyBar` | 837 |

## Olası istekler ve yapılacak değişiklik

### 1. "Gecikmeyi iki katına çıkar"
`feedbackDelay: 1.5` → `feedbackDelay: 3`
**Premise açısından söyle:** "Çubuk artık 3 saniye önceki durumu gösteriyor. Leap'ten sonra çubuk daha uzun süre harcadığım enerjiyi göstermeye devam ediyor, yani tahmin etmem gereken boşluk büyüdü."

### 2. "Geri bildirimi kaldır" / "Bir modda çubuğu kapat"
`showEnergyBar: true` → `false` (ya da panelde **Energy bar** kutusunun işaretini kaldır).

**Sadece BİR modda kapatmak için** (brifteki örnek: "remove the feedback from one mode"): `const PRESETS` (satır 80) içini şöyle yap:
```js
  delay0: { feedbackDelay: 0, showEnergyBar: true },
  delay15: { feedbackDelay: 1.5, showEnergyBar: true },
  delay3: { feedbackDelay: 3, showEnergyBar: false }
```
Artık **Very late (3 s)** butonu çubuğu gizler, diğer iki buton geri açar. (Paneldeki onay kutusu kendiliğinden güncellenmez; sorun değil, çubuk yine doğru davranır.)
**Söyle:** "Feedback tamamen gitti; oyuncu artık sadece zayıf zıplamadan ve düşmeden öğrenebiliyor. Gecikmeli çubuk bile hiç çubuk olmamasından daha çok bilgi veriyor mu, bunu karşılaştırabiliriz."

### 3. "Girdileri yer değiştir"
Satır 376 ve 378'de `act('hop')` ile `act('leap')` yerlerini değiştir. (Butonlar için satır 360–361'deki `btnHop` / `btnLeap` satırlarını da değiştir.)
**Söyle:** "Eylem aynı, sadece eşleme değişti; Feedback ve Temporality kuralları değişmedi."

### 4. "Ne sıklıkla eylem yapılabileceğini sınırlayan bir kural ekle" (ör. leap bekleme süresi)
DESIGN içine ekle:
```js
  leapCooldown: 2,      // sn · iki leap arasında en az bu kadar süre
```
`function jump` içinde, `if (kind === 'leap') {` satırının hemen ÜSTÜNE ekle:
```js
  const sinceLeap = state.simT - (state.lastLeapT ?? -99);
  if (kind === 'leap' && sinceLeap >= 0 && sinceLeap < DESIGN.leapCooldown) {
    flash('Leap is cooling down.');
    kind = 'hop';
  }
  if (kind === 'leap') state.lastLeapT = state.simT;
```
Not: `kind = 'hop'` olunca alttaki leap bloğu hiç çalışmaz, kod hop yapar. `sinceLeap >= 0` kontrolü şart: Rewind veya Reset zamanı geri alınca `lastLeapT` eski (büyük) değerde kalır; bu kontrol olmadan leap uzun süre kilitlenirdi. Daha basit isteniyorsa `leapCost`'u artırmak da sıklığı sınırlar.
**Söyle:** "Artık zaman sadece çubuğu değil, eylemin kendisini de sınırlıyor. Bekleme süresi görünmüyorsa bu yeni bir gizli durum olur; feedback olarak çubuğun yanına bir sayaç eklemek gerekir."

### 5. "Leap daha pahalı olsun" / "Enerji daha yavaş dolsun"
`leapCost: 40` → `60` ya da `energyRegen: 15` → `8`
**Söyle:** "Her leap daha büyük bir bahis oldu; gecikmeli çubukla yanılmanın bedeli arttı."

### 6. "Çubuk canlı olsun"
`feedbackDelay: 0` ya da **Live bar** butonu.
**Söyle:** "Temporality bu kuraldan çıktı; artık sadece Feedback var. Karşılaştırmanın kontrol koşulu bu."

### 7. "Geri sarma daha uzun / kısa olsun"
`rewindLength: 3` → `5` / `1`

### 8. "Çubuk düşükken ses çıkarsın"
`function watchShownEnergy` (satır 236) içindeki satırı şöyle değiştir:
```js
  if (low && !state.lowAnnounced) { announce('Bar shows energy below leap cost.'); sfx.weak(); }
```
**Söyle:** "Ses de gecikmeli değeri okuyor; kanal değişti ama zaman kuralı aynı."

## Kodu açıklarken kullanacağın 3 cümle

1. "Bütün sayılar en üstteki `DESIGN` objesinde; kod DESIGN → state → rule → input → output sırasıyla gidiyor."
2. "**Feedback** `jump()` fonksiyonunda: leap 40 enerji ister, yoksa zayıf zıplama olur. Çubuk bu gizli durumu gösteren tek şey."
3. "**Temporality** `shownEnergy()` fonksiyonunda: çubuk `history` dizisinden `t − feedbackDelay` anındaki enerjiyi okuyor. Geri sarma da aynı diziyi okuyor, o yüzden iki premise aynı veriye bağlı."
