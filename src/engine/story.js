/* ==========================================================================
   Story — the single scrubbed timeline that runs the whole film.
   --------------------------------------------------------------------------
   Timeline "time" == vh of scroll. Chapter k starts where k-1 ends:

     0 ───── 300 ───────── 550 ─────────────── 900  (vh, with default CONFIG)
       01 Deconstruct  02 Rebuild     03 Ignite
       video-1 →       video-1 ←      video-2 →

   The canvas frame, overlays, leader lines, the layer counter and the framing
   all hang off this one timeline, so nothing can drift out of sync.
   ========================================================================== */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { coverProject } from "./renderer.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (s, r = document) => r.querySelector(s);

export function createStory({ CONFIG, store, renderer, isDesktop }) {
  const chapters = CONFIG.chapters.map((c, k, all) => ({
    ...c,
    start: all.slice(0, k).reduce((n, x) => n + x.scroll, 0),
    count: store.count(c.video),
  }));
  const TOTAL = chapters.reduce((n, c) => n + c.scroll, 0);
  /** chapter index + progress (0–1) → timeline time (vh) */
  const T = (k, p) => chapters[k].start + p * chapters[k].scroll;

  const stage = $("#stage");
  const framing = $("#framing");
  const canvas = $("#canvas");
  const flash = $("#flash");
  const state = { t: 0, lead: CONFIG.parts.map(() => 0) };

  /* ------------------------------------------------------------------ */
  /* Frame selection                                                      */
  /* ------------------------------------------------------------------ */
  function frameAt(t) {
    let k = chapters.findIndex((c) => t < c.start + c.scroll);
    if (k < 0) k = chapters.length - 1;
    const c = chapters[k];
    const p = Math.min(1, Math.max(0, (t - c.start) / c.scroll));
    const film = Math.min(1, p / c.filmEnd);
    const f = c.direction > 0 ? film : 1 - film;
    return { k, p, video: c.video, index: Math.round(f * (c.count - 1)) };
  }

  /* ------------------------------------------------------------------ */
  /* Hard-cut cover: 150ms white flash + 1.0 → 1.03 → 1.0 scale bump     */
  /* ------------------------------------------------------------------ */
  let cutSide = null; // which side of the cut the playhead is on (null = unknown yet)
  function checkCut(fr) {
    const { cut } = CONFIG;
    const side = fr.video === cut.video ? fr.index >= cut.frame : false;
    if (cutSide !== null && side !== cutSide) {
      gsap.fromTo(flash, { opacity: cut.flashOpacity }, { opacity: 0, duration: cut.flashMs / 1000, ease: "power1.out", overwrite: true });
      gsap.fromTo(canvas, { scale: 1 }, {
        keyframes: [{ scale: cut.bumpScale, duration: 0.3 }, { scale: 1, duration: 0.7 }],
        duration: cut.bumpMs / 1000, ease: "calm", overwrite: true,
      });
    }
    cutSide = side;
  }

  /* ------------------------------------------------------------------ */
  /* Chapter 1 labels + leader lines                                      */
  /* ------------------------------------------------------------------ */
  const list = $("#build");
  const svg = $("#leaders");
  const aspect = store.manifest.videos[chapters[0].video].aspect || 16 / 9;
  const parts = CONFIG.parts.map((part, i) => {
    const li = document.createElement("li");
    li.className = "part";
    li.innerHTML = `<span class="part__index">${String(i + 1).padStart(2, "0")}</span>
      <span class="part__title">${part.title}</span><span class="part__desc">${part.desc}</span>`;
    const line = document.createElementNS(SVG_NS, "line");
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("r", "2.5");
    svg.append(line, dot);
    return { ...part, li, line, dot, labelX: 0, labelY: 0 };
  });
  // List in visual order (top → bottom) so screen readers and phones read it naturally
  [...parts].sort((a, b) => a.track.at(-1)[2] - b.track.at(-1)[2]).forEach((p) => list.append(p.li));

  // Labels are placed with left/top (not transform) so GSAP can own their x/opacity
  function layoutLabels() {
    if (!isDesktop()) {
      parts.forEach((p) => { p.li.style.left = p.li.style.top = ""; });
      return;
    }
    const W = framing.offsetWidth, H = framing.offsetHeight;
    let prevY = -Infinity;
    [...parts]
      .sort((a, b) => a.track.at(-1)[2] - b.track.at(-1)[2])
      .forEach((p) => {
        const last = p.track.at(-1);
        const pt = coverProject(CONFIG.labelColumnX, last[2], W, H, aspect);
        p.labelX = pt.x + 32;
        p.labelY = Math.max(pt.y, prevY + 56); // keep labels from colliding on short screens
        prevY = p.labelY;
        p.li.style.left = `${p.labelX}px`;
        p.li.style.top = `${p.labelY - p.li.offsetHeight / 2}px`;
      });
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    updateLeaders(true);
  }

  // Interpolate a layer's anchor along its track for the current video-1 frame
  function anchorAt(track, f) {
    if (f <= track[0][0]) return track[0];
    for (let j = 1; j < track.length; j++) {
      if (f <= track[j][0]) {
        const a = track[j - 1], b = track[j], u = (f - a[0]) / (b[0] - a[0]);
        return [f, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      }
    }
    return track.at(-1);
  }

  let lastLeaderKey = "";
  function updateLeaders(force = false) {
    if (!isDesktop()) return;
    const fr = frameAt(state.t);
    const f = fr.video === chapters[0].video ? fr.index : chapters[0].count - 1;
    const key = `${f}|${state.lead.map((v) => v.toFixed(3)).join(",")}`;
    if (!force && key === lastLeaderKey) return;
    lastLeaderKey = key;
    const W = framing.offsetWidth, H = framing.offsetHeight;
    parts.forEach((p, i) => {
      const [, ix, iy] = anchorAt(p.track, f);
      const a = coverProject(ix, iy, W, H, aspect);
      const x1 = a.x + 6, y1 = a.y;
      const x2 = p.labelX - 14, y2 = p.labelY;
      const u = state.lead[i];
      p.line.setAttribute("x1", x1);
      p.line.setAttribute("y1", y1);
      p.line.setAttribute("x2", x1 + (x2 - x1) * u);
      p.line.setAttribute("y2", y1 + (y2 - y1) * u);
      p.dot.setAttribute("cx", a.x);
      p.dot.setAttribute("cy", a.y);
      p.dot.style.opacity = u > 0.02 ? Math.min(1, u * 3) : 0;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Render loop: only paints when the frame actually changes             */
  /* ------------------------------------------------------------------ */
  let raf = 0;
  const counterEl = $("#layerCount");
  let lastCount = "";
  function render() {
    raf = 0;
    const fr = frameAt(state.t);
    renderer.draw(store.get(fr.video, fr.index)); // no-op if unchanged
    checkCut(fr);
    updateLeaders();

    // Chapter 2 counter: layers still apart, 05 → 01
    if (fr.k === 1 || fr.k === 0) {
      const p2 = fr.k === 1 ? fr.p : 0;
      const apart = parts.filter((p) => 1 - p.at > p2).length;
      const txt = String(Math.max(1, apart)).padStart(2, "0");
      if (txt !== lastCount) counterEl.textContent = lastCount = txt;
    }
  }
  const requestRender = () => (raf ||= requestAnimationFrame(render));

  // A late-arriving exact frame should replace the nearest-neighbour stand-in
  store.onLoad((_, name, i) => {
    const fr = frameAt(state.t);
    if (fr.video === name && Math.abs(fr.index - i) <= CONFIG.preload.stride) {
      renderer.current = null;
      requestRender();
    }
  });

  /* ------------------------------------------------------------------ */
  /* The timeline                                                         */
  /* ------------------------------------------------------------------ */
  const chapterEls = [...document.querySelectorAll(".chapters__item")];
  const chaptersNav = $("#chapters");
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#sequence",
      start: "top top",
      end: () => "+=" + (TOTAL / 100) * stage.offsetHeight,
      pin: stage,
      scrub: CONFIG.scrub,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const t = self.progress * TOTAL;
        let active = chapters.findIndex((c) => t < c.start + c.scroll);
        if (active < 0) active = chapters.length - 1;
        chapterEls.forEach((el, k) => {
          el.classList.toggle("is-active", k === active);
          if (k === active) el.setAttribute("aria-current", "step");
          else el.removeAttribute("aria-current");
        });
      },
      onLeave: () => chaptersNav.classList.add("is-hidden"),
      onEnterBack: () => chaptersNav.classList.remove("is-hidden"),
    },
  });

  // 1) The film. Linear: timeline time == vh scrolled.
  tl.to(state, { t: TOTAL, duration: TOTAL, onUpdate: requestRender }, 0);

  // 2) Hero copy lifts away as the shoe begins to separate
  const ch1 = chapters[0].scroll;
  // (explicit from-values: the intro animates these too, so lazy start values would be wrong)
  tl.fromTo(".hero", { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -60, duration: CONFIG.hero.fadeOut * ch1, ease: "power2.in", immediateRender: false }, 0)
    .fromTo("#scrollHint", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.04 * ch1, immediateRender: false }, 0);

  // 3) Framing: shoe right of centre in the hero, nudged left to make room for labels…
  const F = CONFIG.framing;
  if (!isDesktop()) {
    gsap.set(framing, { scale: F.mobile.scale, yPercent: F.mobile.y * 100 });
    tl.to(framing, { yPercent: F.mobile.cardY * 100, duration: T(2, F.card.to) - T(2, F.card.from), ease: "sine.inOut" }, T(2, F.card.from));
  } else {
    gsap.set(framing, { xPercent: F.hero.x * 100, scale: F.hero.scale });
    tl.to(framing, { xPercent: F.deconstruct.x * 100, scale: F.deconstruct.scale, duration: F.deconstruct.by * ch1, ease: "sine.inOut" }, 0)
      .to(framing, { xPercent: F.rebuild.x * 100, yPercent: F.rebuild.y * 100, scale: F.rebuild.scale, duration: F.rebuild.by * chapters[1].scroll, ease: "sine.inOut" }, T(1, 0))
      .to(framing, { xPercent: 0, yPercent: 0, scale: 1, duration: F.ignite.by * chapters[2].scroll, ease: "sine.inOut" }, T(2, 0))
      // …and slid left + slightly enlarged so the neon scene clears the product card
      .to(framing, { xPercent: F.card.x * 100, scale: F.card.scale, duration: T(2, F.card.to) - T(2, F.card.from), ease: "sine.inOut" }, T(2, F.card.from));
  }

  // 4) Layer labels: appear as each part separates (ch1), leave as it rejoins (ch2)
  const drawLen = CONFIG.leaderDraw * ch1;
  parts.forEach((p, i) => {
    const lead = { v: 0 };
    const setLead = () => { state.lead[i] = lead.v; requestRender(); };
    tl.fromTo(p.li, { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: drawLen, ease: "calm" }, T(0, p.at))
      .fromTo(lead, { v: 0 }, { v: 1, duration: drawLen, ease: "calm", onUpdate: setLead }, T(0, p.at) - drawLen * 0.4);
    // Desktop: each label leaves as its layer rejoins. Compact layout: the list sits
    // where the chapter-2 statement goes, so all labels leave at the start of chapter 2.
    const rejoin = isDesktop() ? T(1, 1 - p.at) - 0.03 * chapters[1].scroll : T(1, 0.04);
    tl.to(p.li, { autoAlpha: 0, x: 14, duration: drawLen * 0.6, ease: "power2.in" }, rejoin)
      .to(lead, { v: 0, duration: drawLen * 0.6, ease: "power2.in", onUpdate: setLead }, rejoin);
  });

  // 5) Chapter 2: "Every layer has a purpose." + counter
  {
    const ch = chapters[1].scroll, R = CONFIG.rebuild;
    tl.fromTo(".rebuild", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 * ch }, T(1, R.in))
      .fromTo(".rebuild .line > span", { yPercent: 110 }, { yPercent: 0, duration: 0.12 * ch, ease: "calm" }, T(1, R.in))
      .fromTo(".rebuild__count", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.08 * ch, ease: "calm" }, T(1, R.in + 0.04))
      .to(".rebuild .line > span", { yPercent: -110, duration: 0.08 * ch, ease: "power2.in" }, T(1, R.out) - 0.08 * ch)
      .to(".rebuild", { autoAlpha: 0, duration: 0.06 * ch }, T(1, R.out) - 0.04 * ch);
  }

  // 6) Chapter 3: "Light up the night." then the product card
  {
    const ch = chapters[2].scroll;
    tl.set(".ignite", { autoAlpha: 1 }, T(2, CONFIG.ignite.in))
      .fromTo(".ignite .eyebrow", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 * ch }, T(2, CONFIG.ignite.in))
      .fromTo(".ignite .line > span", { yPercent: 110 }, { yPercent: 0, duration: 0.08 * ch, stagger: 0.025 * ch, ease: "calm" }, T(2, CONFIG.ignite.in))
      .set(".card", { autoAlpha: 1 }, T(2, CONFIG.card.in))
      .fromTo(".card", { xPercent: 18, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.1 * ch, ease: "calm" }, T(2, CONFIG.card.in))
      .fromTo(".card > *", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.07 * ch, stagger: 0.008 * ch, ease: "calm" }, T(2, CONFIG.card.in) + 0.02 * ch);
  }

  /* ------------------------------------------------------------------ */
  /* Resize + anchors                                                     */
  /* ------------------------------------------------------------------ */
  function resize() {
    renderer.resize();
    layoutLabels();
    requestRender();
  }
  resize();

  const st = tl.scrollTrigger;
  /** Scroll position for a story anchor, or null if the hash isn't one. */
  function anchorY(hash) {
    const at = (t) => st.start + (t / TOTAL) * (st.end - st.start);
    if (hash === "#top") return 0;
    if (hash === "#build") return at(T(0, 0.97));
    if (hash === "#preorder") return at(TOTAL) - 2;
    return null;
  }

  return { tl, resize, anchorY, requestRender };
}
