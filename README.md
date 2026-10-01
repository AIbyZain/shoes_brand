# NOCTIS — Phantom Air

A scroll-driven product launch site. Two 8-second films become three chapters on one pinned canvas:

| Chapter | Footage | Scroll |
|---|---|---|
| 01 Deconstruct | `video-1` forward: assembled → exploded | 300vh |
| 02 Rebuild | `video-1` **in reverse**: exploded → assembled | 250vh |
| 03 Ignite | `video-2` forward: assembled → neon reveal | 350vh |

The first frames of both videos are almost identical, so every join is seamless. The dissolve inside `video-2` (frames ~146–154) is hidden by a 150ms white flash and a 1.0 → 1.03 → 1.0 canvas bump.

Stack: Vite, vanilla JS (ES modules), GSAP + ScrollTrigger, Lenis, and an Express server for production.

---

## Setup

Requires Node 18.18 or newer.

```bash
# 1. Install dependencies (this also downloads a bundled ffmpeg binary)
npm install

# 2. Put your two films in /source-videos. The file name becomes the video name:
#      source-videos/video-1.mp4   ("Deconstruct")
#      source-videos/video-2.mp4   ("Ignite")

# 3. Extract WebP frame sequences + write public/frames/manifest.json
npm run frames                 # all videos
npm run frames -- video-2      # or just one

# 4. Develop
npm run dev                    # http://localhost:5173

# 5. Production
cp .env.example .env           # set PORT if you need to (default 3000)
npm run build && npm start     # http://localhost:3000
```

The repository already includes the extracted frames, so `npm run dev` works straight after `npm install`.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload. Serves `/public` (including the frames). |
| `npm run build` | Builds to `/dist`: hashed JS/CSS/fonts, plus `/public` copied as is. |
| `npm run frames` | Runs `scripts/extract-frames.js`, which turns each `source-videos/*.mp4` into `public/frames/{name}/{desktop,mobile}/frame_0001.webp…` (desktop 1920px at q80, mobile 960px at q75) and writes `manifest.json` with frame counts and a cache-busting version. |
| `npm start` | `server.js`, an Express server for `/dist`. It uses compression, sets `/frames` and `/assets` to `max-age=1y, immutable`, and makes HTML and `manifest.json` `no-cache`. `PORT` comes from `.env`. |

`ffmpeg-static` supplies the ffmpeg binary. If its download was blocked (for example by a corporate proxy), the script falls back to an `ffmpeg` on your `PATH`.

---

## File tree

```
.
├── index.html                 semantic markup: intro, nav, stage + overlays, sections, footer
├── package.json
├── vite.config.js
├── server.js                  Express production server
├── .env.example               PORT=3000
├── scripts/
│   └── extract-frames.js      ffmpeg-static + fluent-ffmpeg → WebP sequences + manifest
├── source-videos/
│   ├── video-1.mp4            Deconstruct
│   └── video-2.mp4            Ignite
├── public/
│   ├── favicon.svg
│   └── frames/
│       ├── manifest.json      frame counts + version (generated)
│       ├── video-1/{desktop,mobile}/frame_0001.webp …
│       └── video-2/{desktop,mobile}/frame_0001.webp …
└── src/
    ├── config.js              ← CONFIG: every timing, length and position
    ├── main.js                boot: fonts, preload, Lenis↔ScrollTrigger, intro
    ├── engine/
    │   ├── frames.js          manifest loader + progressive preloader
    │   ├── renderer.js        canvas cover math, DPR cap, redraw-on-change only
    │   └── story.js           the single 900vh timeline (frames, overlays, labels, cut)
    ├── ui/
    │   ├── intro.js           loading line → curtain split → hero reveal
    │   ├── interactions.js    magnetic, parallax, tilt, nav, rail, counters, forms, anchors
    │   └── static.js          prefers-reduced-motion: three static key frames
    └── styles/
        └── main.css           tokens, layout, responsive, reduced motion
```

---

## How it works

- **One timeline.** `story.js` builds a single GSAP timeline whose "time" is vh of scroll (0–900). The canvas frame, hero exit, layer labels, leader lines, the 05 → 01 counter, the "Light up the night." title, the product card and the framing moves all sit on it. `scrub: 0.8`.
- **Lenis and ScrollTrigger** share GSAP's ticker (`lenis.raf` runs inside `gsap.ticker`). Lenis also handles in-page anchors. `#build` and `#preorder` resolve to positions on the timeline, not DOM elements.
- **Frames.**
  - `renderer.js` draws with `object-fit: cover` math at a devicePixelRatio capped at 2.
  - It only repaints when the frame image actually changes; resize redraws.
  - On portrait screens, cover would crop the shoe to its middle quarter. There the film is drawn 1.6× the viewport width as a centred band, with feathered edges (`CONFIG.portraitFit`).
- **Preloading.**
  - `video-1` loads first (it serves chapters 1 and 2): every 4th frame, then the gaps. `video-2` loads in the background behind it.
  - The intro opens once 24 key frames are in (12 on phones). It lasts at least 1.5s and never more than 4.5s.
  - If a frame hasn't arrived yet, the nearest decoded frame is shown.
- **Mobile.** Screens narrower than 768px load the 960px set. The choice is made once on load so the frames never download twice.
- **Reduced motion.** There's no pinning, scrubbing or smooth scroll. Three static key frames (`CONFIG.staticFrames`) carry the same copy, with opacity fades.

---

## Tuning (all in `src/config.js`)

| You want to… | Change |
|---|---|
| Change the chapter lengths | `chapters[n].scroll` (vh) |
| Move the hidden cut | `cut.frame` (0-based index in `video-2`), plus `flashMs`, `flashOpacity`, `bumpScale` |
| Retime a layer label | `parts[n].at`: chapter-1 progress when that layer has visibly separated |
| Re-aim a leader line | `parts[n].track`: `[frameIndex, x, y]` points in image space (0–1). The anchor interpolates between them, and the last point sets the label's height |
| Hold the neon scene longer | `chapters[2].filmEnd`: the frames finish at this fraction, then the last frame holds under the card |
| Move the shoe in the hero / during the card | `framing.hero`, `framing.card` (x as a fraction of the viewport, scale) |
| Change the chapter 2 / 3 copy timing | `rebuild.in/out`, `ignite.in`, `card.in` (chapter progress) |
| Change the content | `brand`, `product`, `price`, `colorways`, `sizes` |

**If you swap the videos:**
1. Replace the files in `/source-videos` and run `npm run frames`. Counts and versions update automatically.
2. Make a contact sheet to find your moments, for example `ffmpeg -i source-videos/video-1.mp4 -vf "select='not(mod(n,8))',scale=320:-1,tile=6x4" -frames:v 1 sheet.png`. Tile *k* shows frame index `8k`.
3. Update `cut.frame`, `parts[].at` (frame ÷ (count − 1)) and `parts[].track`.

---

## What changed from v1 (and why)

| v1 | v2 | Why |
|---|---|---|
| Static `index.html`, `style.css`, `main.js` from CDNs | Vite + ES modules, GSAP/Lenis/fonts from npm, Express server | Hashed, cacheable bundles; no third-party render-blocking requests; a real build and deploy path. |
| Hand-run ffmpeg commands, frame counts hard-coded | `npm run frames` + `manifest.json` | Swapping footage is now one command; the front end reads the counts. |
| Neon/glow UI (cyan + magenta, glowing CTA, custom cursor) | Calm palette: bone `#ECE8E1`, stone `#8C8A86`, one sage `#9DB4B3` accent, 1px lines, 2.5% grain, Instrument Serif + Inter Tight | The footage now carries all the colour; the interface reads as editorial and expensive. The custom cursor was removed: it fought the calm direction and hurts accessibility. |
| Branded % loader that fades out | Line grows with progress → splits like a curtain → canvas settles 1.08 → 1.0, masked line reveal | A first-3-seconds moment that shows the shoe straight away. |
| Two videos joined by a crossfade | Three chapters: forward, **reverse**, forward | Matches the new footage (explode → rebuild → ignite) with seamless joins. |
| Scrubbed white flash on the stomp | Time-based 150ms flash + scale bump when the playhead crosses `cut.frame` | Hides the cut the same way at any scroll speed. |
| One pointer line to the sole | Five tracked leader lines and labels, which leave in reverse as layers rejoin; counter 05 → 01 | Tells the build story layer by layer. |
| Price/CTA overlay | Product card: colorway and size radio inputs, validation, cart count | Keyboard and screen-reader friendly, and an actual pre-order flow. |
| Details + feature grid + footer | Specs with counters, 3-card tilt grid (max 6°), reviews strip, newsletter, footer | The requested post-film sections, in the same quiet system. |
| Cover crop on every screen | Cover on landscape; a feathered band on portrait | The shoe is never cropped on phones. |

**Kept:** the NOCTIS / Phantom Air content, the CONFIG-at-the-top approach, progressive stride preloading with nearest-frame fallback, the single-timeline sync, cover math with a DPR cap of 2, magnetic buttons, mouse-parallax depth and the reduced-motion fallback.

**Measured** (Lighthouse 12, production build via `npm start`): performance 95–98 on mobile and 97–98 on desktop across runs, accessibility 100, best practices 100, SEO 100. No horizontal overflow from 360px to 2560px.
