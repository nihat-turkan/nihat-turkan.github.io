# Late Signal — Design rationale

**NMED 3203 · Midterm · Premises 03 Feedback × 04 Temporality**
**Live link:** https://nihat-turkan.github.io/late-signal/

## Idea

Late Signal is a hurdle race with two actions: a free hop for low hurdles and a leap that costs 40 energy for tall ones. Energy refills slowly, so every leap is a small bet. The energy bar is late: it shows the runner's energy from 1.5 seconds ago. To clear a tall hurdle, the participant has to predict the energy they actually have, not the energy they see.

## Premise A and B

Feedback lives in the leap rule and the bar. Energy is a hidden state that decides whether a leap works, and the bar is the only way to read it. Temporality lives in the delay: the bar reads the stored history at t – 1.5 s instead of the present. The premises depend on each other. Without the bar the delay would be invisible; without the delay the bar would be an ordinary meter. Together they open a gap that is widest right after a leap, when the bar still shows energy that is already spent. Rewind reads the same history, so going back also moves the bar back.

## Theory

Hutchins, Hollan and Norman (1985) describe the gulf of evaluation: the distance between what a system displays and what a person can conclude about its state. I narrowed it with a LEAP line on the bar, labelled hurdles and a REAL / BAR box after a fall. Their account assumes a current display; mine lags on purpose. My playtest showed another limit: a cue narrows the gulf only once it is noticed.

Jota et al. (2013) varied touch latency between 1 and 50 ms in a dragging task and found that performance fell as latency rose, especially in the final adjustment phase. Following their method of changing only latency, I made the delay one named value, feedbackDelay, and compare 0, 1.5 and 3 seconds on the same course. Their latency is an unwanted flaw measured in milliseconds; mine is a deliberate rule measured in seconds.

## What I learned

I let a friend play without explanation. They pressed only Space and crashed into tall hurdles until they read the text beside the game. Then they leapt every hurdle, ran out of energy and fell. They never noticed the "SHOWN 1.5 s AGO" label or read the REAL / BAR box, so the delay stayed invisible.

---

*Word count (rationale text, excluding headings and references): 379*

## References

- Hutchins, E. L., Hollan, J. D., & Norman, D. A. (1985). Direct manipulation interfaces. *Human–Computer Interaction, 1*(4), 311–338. https://doi.org/10.1207/s15327051hci0104_2 — paper copy: https://www.lri.fr/~mbl/ENS/FONDIHM/2013/papers/Hutchins-HCI-85.pdf
- Jota, R., Ng, A., Dietz, P., & Wigdor, D. (2013). How fast is fast enough? A study of the effects of latency in direct-touch pointing tasks. *Proceedings of CHI 2013*. https://doi.org/10.1145/2470654.2481317 — paper copy: https://www.tactuallabs.com/papers/howFastIsFastEnoughCHI13.pdf
