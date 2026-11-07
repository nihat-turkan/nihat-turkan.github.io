# Late Signal — Design rationale

> ⚠️ **TASLAK — teslim etmeden önce kendin düzenle.**
> - `[KÖŞELİ PARANTEZ]` içindeki yerleri **kendi gözleminle** doldur (bir kişiye açıklamadan oynat).
> - Teori kısmını iki makaleyi **kendin açıp okuduktan sonra** kendi cümlelerinle yeniden yaz; buradaki cümleler sadece yön gösterir.
> - Son metin 315–385 kelime olmalı (başlık, bu kutu ve kaynakça sayılmaz). Bu kutuyu teslimden önce sil.

**Live link:** https://nihat-turkan.github.io/late-signal/

## Idea

The participant runs a hurdle race with two actions: a free hop for low hurdles and a leap that costs 40 energy for tall ones. Energy refills slowly, so every leap is a small bet. The catch is that the energy bar is late: it shows my energy from 1.5 seconds ago. To clear a tall hurdle, the participant has to predict the energy they really have, not the energy they see.

## Premise A and B

Feedback lives in the leap rule and the bar: the hidden state (energy) decides whether a leap works, and the bar is the only way to read it. Temporality lives in the delay: the bar does not read the present, it reads the stored history at t − 1.5 s. The two depend on each other. Without the bar, the delay would be invisible; without the delay, the bar would be a simple meter. Together they create a gap that is worst right after a leap, when the bar still shows the energy I just spent. Rewind reads the same history, so going back also moves the bar back.

## Theory

Hutchins, Hollan and Norman (1985) describe the gulf of evaluation: the effort needed to understand system state from what the interface shows. I used this to place every signal near the decision: the LEAP line on the bar and, after a fall, a box comparing real and shown energy. Their account assumes the display reflects the present; my design deliberately breaks that, which shows a limit: a readable display is not the same as a current one. `[Kendi cümlenle düzenle — makaleden kontrol et.]`

Jota et al. (2013) treat latency as a measurable property that changes how people perform. That made me treat delay as one named setting (feedbackDelay) and compare 0, 1.5 and 3 seconds while movement, input and course stay the same. Their study measures short delays in direct-touch pointing, so it does not give a threshold for a delay that is part of the rule. `[Kendi cümlenle düzenle — makaleden kontrol et.]`

## What I learned

`[Bir kişiye açıklama yapmadan oynattım. Gözlem: … (ör. çubuğa bakıp uzun engelde leap yaptı ve düştü / alçak engellerde de leap yaptı). Bunun üzerine şunu değiştirdim: … (ör. düşünce "real vs bar" kutusunu ekledim / çubuğa "SHOWN 1.5 s AGO" etiketini koydum / hop yüksekliğini değiştirdim).]`

## References

- Hutchins, E. L., Hollan, J. D., & Norman, D. A. (1985). Direct manipulation interfaces. *Human–Computer Interaction, 1*(4), 311–338. https://doi.org/10.1207/s15327051hci0104_2 — paper copy: https://www.lri.fr/~mbl/ENS/FONDIHM/2013/papers/Hutchins-HCI-85.pdf
- Jota, R., Ng, A., Dietz, P., & Wigdor, D. (2013). How fast is fast enough? A study of the effects of latency in direct-touch pointing tasks. *Proceedings of CHI 2013*. https://doi.org/10.1145/2470654.2481317 — paper copy: https://www.tactuallabs.com/papers/howFastIsFastEnoughCHI13.pdf
