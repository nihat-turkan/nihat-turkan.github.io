# Late Signal

**Premises:** 03 Feedback × 04 Temporality
**One line:** A hurdle race where the energy bar always shows your energy from 1.5 seconds ago, so you must predict the energy you really have before every tall hurdle.

**Live link:** https://nihat-turkan.github.io/late-signal/

## How to use

- **Hop** low (red-white) hurdles for free: `Space`, `↑`, the **Hop** button, or tap the track.
- **Leap** tall (lime-navy) hurdles for 40 energy: `Shift`, `X`, or the **Leap** button.
  Without 40 energy a leap becomes a weak hop and you hit the tall hurdle.
- Energy refills by itself (15 per second).
- The bar at the top right is **late**: it shows your energy from `feedbackDelay` seconds ago.
- Fall? Press `R` (or **Rewind**) to go back 3 seconds. The failed attempt stays on the track as a fading trace.
- `P` pause · `Enter` start · **Reset** clears all history and traces.
- Compare: **Live bar (0 s)**, **Late bar (1.5 s)**, **Very late (3 s)**. Only the delay changes.

## Where the premises live

| Premise | Where in the code | What the participant sees |
|---|---|---|
| **Feedback** | `jump()` spends energy, `drawEnergyBar()` shows it | energy bar, LEAP line, LOW stripes, weak leap, "real vs bar" box after a fall |
| **Temporality** | `shownEnergy()` reads `energy(t − feedbackDelay)` from `history[]` | the bar lags; purple "BAR SHOWS" mark on the timeline; rewind and fading traces |
| **Both** | the bar and the rewind read the same stored history | after a rewind the bar also "goes back" |

All rules and numbers are in the `DESIGN` object at the top of `script.js`.

## Accessibility

- Every pointer action has a keyboard key and a labelled button.
- Meaning is never colour only: hurdles are labelled HOP / LEAP, low energy is striped and says LOW, traces are solid / dashed.
- Screen readers get short announcements (start, GO, low bar, fall, rewind).
- `prefers-reduced-motion` turns off the crowd wave, shake and confetti.
- The game pauses itself when the tab is hidden.

## Files

| File | What it does |
|---|---|
| `index.html` | page structure, buttons, comparison presets, credits |
| `style.css` | layout and visual style |
| `script.js` | DESIGN → state → rule → input → output |
| `RATIONALE.md` | 350-word design rationale and references |
| `LIVE-CHANGE.md` | (Turkish) where every rule lives and how to make likely live changes |

## Credits

- Premises, promises, prompt structure and readings: *Interactive Media Applications lab*, Mert Seven — https://mertseven.com/ima/lab/
- Builds on my own lab exercises: *Pace Track* (03 Feedback) and *Rewind Runner* (04 Temporality).
- No external images, fonts, libraries or sound files: all graphics are drawn with Canvas, all sounds use the Web Audio API.
- Readings: Hutchins, Hollan & Norman (1985); Jota, Ng, Dietz & Wigdor (2013). See `RATIONALE.md`.

## AI note

> ✏️ **Fill this in yourself and keep it honest.** Below is a suggested starting point based on what actually happened while building this project — edit it so it is true for you.

- **Tool:** Claude (Claude Code) for idea discussion, code generation, testing and README structure.
- **What I decided:** the premise pair, the hop / leap rule, the delayed bar, keeping rewind, the comparison (0 / 1.5 / 3 s).
- **Rejected / corrected:** The AI first proposed "Echo Pass" and "Echo Cave"; I rejected both because a character replaying my past path was too close to the lab's Ghost Chase. *(Add one more of your own: e.g. a value you changed after testing.)*
- **Bug found in testing:** the weak leap was first 70 px high and still cleared the 70 px tall hurdle, so wasting energy had no cost. Hop height was lowered to 58 px.
- The rationale text and the observations in it are my own.
