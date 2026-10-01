/* ==========================================================================
   CONFIG — every number you are likely to tweak lives in this one object.
   --------------------------------------------------------------------------
   • Scroll lengths are in vh. The whole film is one timeline whose "time"
     is measured in vh of scroll, so `at` values below are simply
     "progress through that chapter" (0–1).
   • Frame counts are NOT here: they come from /frames/manifest.json, which
     `npm run frames` writes. Frame numbers below are 0-based indices
     (frame_0001.webp is index 0).
   ========================================================================== */

export const CONFIG = {
  /* ---------- Content ---------- */
  brand: "NOCTIS",
  product: "Phantom Air",
  currency: "$",
  price: "220",
  colorways: [
    { name: "Obsidian", swatch: "#1C1C1E" },
    { name: "Stone", swatch: "#8C8A86" },
    { name: "Sage", swatch: "#9DB4B3" },
  ],
  sizes: [
    { label: "7" }, { label: "8" }, { label: "9" }, { label: "10" },
    { label: "11" }, { label: "12", soldOut: true },
  ],

  /* ---------- Frames ---------- */
  manifestUrl: "/frames/manifest.json",
  mobileBreakpoint: 768, // viewport width (CSS px) BELOW which the 960px set is used
  maxDpr: 2,
  portraitFit: 1.6,      // portrait screens: draw the film 1.6× the viewport width (centred band)

  /* ---------- Story: three chapters on one timeline (total 900vh) ----------
     direction -1 plays the frames backwards (exploded → assembled).
     filmEnd: fraction of the chapter over which the frames play; the last
     frame then holds while the product card is on screen.               */
  chapters: [
    { id: "deconstruct", label: "Deconstruct", video: "video-1", direction: 1, scroll: 300, filmEnd: 1 },
    { id: "rebuild", label: "Rebuild", video: "video-1", direction: -1, scroll: 250, filmEnd: 1 },
    { id: "ignite", label: "Ignite", video: "video-2", direction: 1, scroll: 350, filmEnd: 0.86 },
  ],
  scrub: 0.8,

  /* ---------- Hiding the hard cut in video-2 ----------
     When the playhead crosses `frame`, a 150ms white→transparent flash
     fires and the canvas bumps 1.0 → 1.03 → 1.0.                         */
  cut: { video: "video-2", frame: 148, flashMs: 150, flashOpacity: 0.55, bumpScale: 1.03, bumpMs: 520 },

  /* ---------- Preloading ---------- */
  preload: {
    stride: 4,          // first pass loads every 4th frame, then fills gaps
    readyFrames: 24,    // first-pass frames of chapter 1 needed before the intro opens (desktop)
    readyFramesMobile: 12,
    concurrency: 6,
    minIntroMs: 1500,   // the intro always lasts at least this long…
    maxIntroMs: 4500,   // …and never longer than this (missing frames fall back to the nearest one)
  },

  /* ---------- Hero ---------- */
  hero: {
    zoomFrom: 1.08,     // canvas scale on reveal → 1.0
    zoomMs: 2000,
    canvasParallax: 12, // px the canvas drifts with the mouse
    textParallax: 6,    // px the hero copy drifts the opposite way
    fadeOut: 0.1,       // chapter-1 progress by which the hero copy has left
  },

  /* ---------- Framing: where the shoe sits in the viewport ----------
     x / y are fractions of the viewport (0.1 = 10vw to the right).
     scale < 1 shrinks the film inside the black void (the footage is pure
     black, so no edge shows); scale > 1 is used when shifting a full-bleed
     scene (the neon floor) so no edge shows.
     `mobile` replaces all of this on small / portrait screens, where the
     film is drawn as a band (see portraitFit) and lifted above the copy. */
  framing: {
    hero: { x: 0.16, scale: 0.78 },
    deconstruct: { x: -0.04, scale: 1, by: 0.2 },  // reached at 20% of chapter 1
    rebuild: { x: 0, y: -0.07, scale: 0.8, by: 0.18 }, // smaller + lifted: room for the statement
    ignite: { by: 0.2 },                               // back to full frame early in chapter 3
    card: { x: -0.05, scale: 1.1, from: 0.78, to: 0.9 },  // chapter 3, as the card slides in
    mobile: { scale: 1, y: -0.12, cardY: -0.2 },
  },

  /* ---------- Chapter 1 layer labels ----------
     at:    chapter-1 progress at which the layer has visibly separated
     track: [frameIndex, x, y] — the layer's right edge in IMAGE space
            (0–1) at a few frames of video-1; the leader line's anchor
            interpolates along it. The last point also sets the label's y.  */
  parts: [
    { id: "upper", title: "Knit Upper", desc: "Breathable engineered mesh", at: 0.2,
      track: [[40, 0.79, 0.42], [64, 0.79, 0.33], [80, 0.78, 0.28], [96, 0.78, 0.33], [112, 0.72, 0.28], [128, 0.72, 0.3], [191, 0.7, 0.32]] },
    { id: "insole", title: "Comfort Insole", desc: "Contoured open-cell foam", at: 0.44,
      track: [[80, 0.72, 0.5], [96, 0.71, 0.46], [128, 0.72, 0.46], [191, 0.7, 0.48]] },
    { id: "midsole", title: "Responsive Midsole", desc: "High-rebound, low-weight foam", at: 0.52,
      track: [[80, 0.73, 0.6], [96, 0.73, 0.57], [128, 0.73, 0.57], [191, 0.71, 0.58]] },
    { id: "air", title: "Air Core", desc: "Visible cushioning", at: 0.6,
      track: [[112, 0.69, 0.68], [128, 0.73, 0.71], [191, 0.71, 0.72]] },
    { id: "outsole", title: "Grip Outsole", desc: "Hex-cut wet-grip rubber", at: 0.37,
      track: [[64, 0.79, 0.69], [80, 0.77, 0.79], [96, 0.73, 0.82], [112, 0.72, 0.85], [191, 0.71, 0.85]] },
  ],
  labelColumnX: 0.79, // labels start at this IMAGE-space x (plus a small gap)
  leaderDraw: 0.06,   // chapter progress a leader line takes to draw

  /* ---------- Chapter 2 / 3 overlays (chapter progress) ---------- */
  rebuild: { in: 0.2, out: 0.94 }, // in after the stack has shrunk out of its way
  ignite: { in: 0.68 },
  card: { in: 0.8 },

  /* ---------- Reduced motion: three static key frames ---------- */
  staticFrames: [
    { video: "video-1", frame: 0 },   // hero, assembled
    { video: "video-1", frame: -1 },  // exploded (-1 = last frame)
    { video: "video-2", frame: -1 },  // neon reveal
  ],
};
