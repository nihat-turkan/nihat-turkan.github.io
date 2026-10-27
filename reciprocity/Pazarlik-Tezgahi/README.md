# Pazarlık Tezgâhı / Reciprocity (Eye Field remix)

Eye Field (02 · Reciprocity) kaynak paketinin yapısı korunarak yazılmış bir remix. Tema: **Sahil Balıkçısı**. Orman mekânı gizlenir; deniz, kumsal, iskele, kayık ve martıları `script.js` kurar. Satıcı Rıza Kaptan (`char.captain`). Motor ve kabuk orijinal paketle aynı.

## Çalıştırma

Bu klasörde `npx http-server -p 8000 -c-1` (Node) ya da `python -m http.server 8000` çalıştırın, sonra http://localhost:8000 adresini açın.

## Oynanış

- Ürüne (levrek, deniz kabuğu, olta) tıklayın ya da paneldeki düğmeden seçin.
- Kaydırıcıyla fiyat seçip **TEKLİF VER**, **KAPTAN, BİR EL AT**, **ANLAŞTIK** veya **VAZGEÇTİM**.
- Hiçbir şey yapmazsanız (`patience`) kaptan sabırsızlanır.

## Input → Rule → State → Output

| INPUT | RULE | STATE | OUTPUT |
|---|---|---|---|
| teklif · kibar söz · vazgeçmek · beklemek | `offer()`, `kind()`, `leave()`, sabır | `trust` (0–100), `insulted`, `kindStreak`, `leftOnce`, `ask` | poz, konuşma balonu, yeni fiyat, martılar, ses |

## Önceki durumu kullanan kural

- Ayıp teklif (`< base × insultLine`): güven −`insultPenalty`, `insulted = true`, fiyat %10 artar, martılar kaçışır.
- Makul teklif (`≥ base × fairLine`): güven +`fairBonus`. Güven `friendTrust` üstündeyse kabul; değilse fiyat güvene göre iner. `insulted` ise kaptan "İlk teklifin ayıptı ama…" der.
- Güven < 25: kaptan küser, indirim yapmaz. Güven 0: tezgâh kapanır.
- Kibar söz bir kez işe yarar; üst üste tekrarlanırsa "Laf değil, teklif ver!"
- İlk vazgeçişte (güven ≥ 30) kaptan "Dur dur! Son fiyat" der; ikincisinde biter.
- Yeni bir ürünün ilk fiyatı o anki güvene göre belirlenir: kaptan önceki alışverişi hatırlar.

## Örnek üç tur (olta, liste 400₺)

1. 80₺ teklif → **bozuldu**: "Ayıp ettin! Şimdi 440₺ oldu." Martılar kaçışır. (güven 50 → 30)
2. 320₺ teklif → **kararsız**: "İlk teklifin ayıptı ama… …₺ olsun." (güven 40)
3. "Kaptan, bir el at" → **memnun**: güven 45, kaptan teşekkür eder; güven 50'yi geçince fiyatı da %5 indirir.

Sistem yalnızca birkaç sayı ve bayrak tutar; oyuncu bunları "küstü", "affetti", "beni sevdi" diye bir tavır olarak yorumlar.

## Düzenleme

- `script.js`: tasarım parametreleri (`design`, `knobs`), kural (`offer`, `kind`, `leave`) ve animasyon. CODE sekmesinden canlı denenebilir.
- `index.html`: teklif paneli (`#dealPanel`). `style.css`: panel ve balon stilleri (dosyanın sonu).
- `runner.js`, `engine.js`, `shell.js`, `vendor/`, `fonts/`, `licenses/`: orijinal paketten değiştirilmeden alındı.
