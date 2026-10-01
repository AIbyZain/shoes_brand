/* ==========================================================================
   NOCTIS — Phantom Air · scroll-driven frame sequence
   --------------------------------------------------------------------------
   One pinned stage. One scrubbed GSAP timeline whose "time" is measured in
   vh of scroll. The canvas frame, every text overlay, the flash, the counter
   and the sole pointer line all live on that same timeline, so they can never
   drift out of sync with the footage.
   ========================================================================== */

/* ──────────────────────────────────────────────────────────────────────────
   CONFIG — everything you are likely to tweak lives here.
   Timings for overlays are in *percent of that video* (0–1), so if you
   re-cut a video you only change numbers here, never the animation code.
   ────────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  brand: "NOCTIS",
  product: "PHANTOM AIR",
  price: "220",

  videos: [
    {
      id: "origin",
      count: 192,                       // number of extracted frames
      path: "frames/v1/",               // 1920px set
      mobilePath: "frames/mobile/v1/",  // 960px set
      scroll: 300,                      // scroll length in vh
    },
    {
      id: "impact",
      count: 192,
      path: "frames/v2/",
      mobilePath: "frames/mobile/v2/",
      scroll: 400,
    },
  ],
  fileName: (i) => `frame_${String(i).padStart(4, "0")}.webp`, // i is 1-based
  crossfade: 40,          // vh of scroll for the V1 → V2 dissolve
  mobileBreakpoint: 768,  // viewport width (CSS px) at/below which the 960px set is used

  preload: {
    stride: 4,            // first pass loads every Nth frame
    readyAt: 0.25,        // fraction of ALL frames needed before the loader leaves
    concurrency: 6,       // parallel image requests
  },

  scrub: 0.8,             // ScrollTrigger scrub smoothing (seconds of catch-up)
  maxDpr: 2,              // devicePixelRatio cap for the canvas
  focal: { x: 0.5, y: 0.5 }, // object-position for the cover crop (0–1)

  // Overlays: video (1|2), in/out as % of that video. `fade` = portion of the
  // window spent fading in / out. An `in` of 0 on the first video means the
  // overlay is visible on page load; an `out` of 1 on the last video means it
  // stays on screen until the pin releases.
  fade: 0.3,
  overlays: {
    hero:   { video: 1, in: 0.00, out: 0.15 },
    sole:   { video: 1, in: 0.35, out: 0.55 },
    weight: { video: 1, in: 0.70, out: 0.90 },
    impact: { video: 2, in: 0.10, out: 0.25 },
    city:   { video: 2, in: 0.40, out: 0.65 },
    finale: { video: 2, in: 0.80, out: 1.00 },
  },

  flashAt: 0.17,          // % of V2 where the stomp's shockwave hits (frame ~33)
  weight: 240,            // counter target in grams
  // Air-bubble position in IMAGE space (0–1) at a few V1 frames (1-based).
  // The pointer line's endpoint interpolates along this track so it follows
  // the sole as the camera pushes in.
  soleTrack: [
    { f: 66,  x: 0.24, y: 0.58 },
    { f: 80,  x: 0.25, y: 0.59 },
    { f: 95,  x: 0.27, y: 0.61 },
    { f: 110, x: 0.27, y: 0.63 },
    { f: 125, x: 0.37, y: 0.61 },
  ],
  tiltDeg: 6,             // max mouse-parallax tilt for overlays

  colorways: [
    { name: "Obsidian",      swatch: "#141416", accent: "#4FD8FF", tint: "transparent" },
    { name: "Midnight Cyan", swatch: "#0d3442", accent: "#4FD8FF", tint: "rgba(79,216,255,0.55)" },
    { name: "Neon Magenta",  swatch: "#3d0d33", accent: "#FF4FD8", tint: "rgba(255,79,216,0.55)" },
  ],
};

/* ──────────────────────────────────────────────────────────────────────────
   Boot
   ────────────────────────────────────────────────────────────────────────── */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const html = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const useMobileFrames = window.innerWidth <= CONFIG.mobileBreakpoint;
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

const framePath = (v, i) =>
  (useMobileFrames ? CONFIG.videos[v].mobilePath : CONFIG.videos[v].path) + CONFIG.fileName(i);

bindContent();
renderSwatches();
setupReveals();

if (reduceMotion || !hasGsap) {
  initStatic();
} else {
  initMotion();
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared helpers
   ────────────────────────────────────────────────────────────────────────── */
function bindContent() {
  $$("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    if (CONFIG[key] != null) el.textContent = CONFIG[key];
  });
  document.title = `${CONFIG.brand} — ${titleCase(CONFIG.product)}`;
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderSwatches() {
  const wrap = $(".swatches");
  const nameEl = $("#swatchName");
  CONFIG.colorways.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", c.name);
    b.setAttribute("aria-checked", i === 0 ? "true" : "false");
    b.dataset.cursor = "";
    b.style.setProperty("--c", c.swatch);
    b.style.setProperty("--glow", c.accent);
    b.addEventListener("click", () => selectColorway(i));
    wrap.appendChild(b);
  });

  function selectColorway(i) {
    const c = CONFIG.colorways[i];
    $$(".swatch", wrap).forEach((s, j) => s.setAttribute("aria-checked", j === i ? "true" : "false"));
    nameEl.textContent = c.name;
    html.style.setProperty("--accent", c.accent);
    html.style.setProperty("--tint", c.tint);
  }
}

/* Simple IntersectionObserver fades for the sections after the sequence. */
function setupReveals() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }),
    { rootMargin: "0px 0px -12% 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));
}

function hideLoader() {
  $("#loader").classList.add("is-done");
  document.body.classList.remove("is-loading");
}

/* ──────────────────────────────────────────────────────────────────────────
   Reduced motion (or GSAP unavailable): static key frames + simple fades
   ────────────────────────────────────────────────────────────────────────── */
function initStatic() {
  html.classList.add("reduced-motion");
  $("#chapters").style.display = "none";
  $("#weightCounter").textContent = CONFIG.weight;

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting)),
    { threshold: 0.25 }
  );
  $$(".overlay").forEach((el) => {
    const [v, f] = el.dataset.staticFrame.split(":").map(Number);
    el.style.setProperty("--frame", `url("${framePath(v - 1, f)}")`);
    io.observe(el);
  });

  hideLoader();
}

/* ──────────────────────────────────────────────────────────────────────────
   Full experience
   ────────────────────────────────────────────────────────────────────────── */
function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const [V1, V2] = CONFIG.videos;
  const TOTAL = V1.scroll + CONFIG.crossfade + V2.scroll; // timeline length in vh
  // Convert "percent of video N" → timeline time (vh)
  const T = (video, pct) => (video === 1 ? pct * V1.scroll : V1.scroll + CONFIG.crossfade + pct * V2.scroll);

  const stage = $("#stage");
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const state = { p: 0, line: 0 };

  /* ---------------- Frame store + progressive preloader ---------------- */
  const frames = CONFIG.videos.map((v) => new Array(v.count).fill(null)); // decoded <img> or null
  const totalFrames = frames.reduce((n, a) => n + a.length, 0);
  const readyCount = Math.ceil(totalFrames * CONFIG.preload.readyAt);
  let loaded = 0;
  let started = false;

  // Load order: every Nth frame of each video first (fast, coarse scrubbing),
  // then fill in the gaps. Interleaving V1/V2 lets either be scrubbed early.
  const queue = [];
  const stride = CONFIG.preload.stride;
  CONFIG.videos.forEach((v, vi) => { for (let i = 0; i < v.count; i += stride) queue.push([vi, i]); });
  CONFIG.videos.forEach((v, vi) => { for (let i = 0; i < v.count; i++) if (i % stride) queue.push([vi, i]); });
  // Make sure the very last frame of each video is in the first pass too (seam + finale)
  CONFIG.videos.forEach((v, vi) => {
    const k = queue.findIndex(([a, b]) => a === vi && b === v.count - 1);
    if (k > -1) queue.unshift(...queue.splice(k, 1));
  });
  queue.unshift(...queue.splice(queue.findIndex(([a, b]) => a === 0 && b === 0), 1)); // first frame first

  const pctEl = $("#loaderPct");
  const fillEl = $("#loaderFill");

  function loadNext() {
    const job = queue.shift();
    if (!job) return;
    const [vi, i] = job;
    const img = new Image();
    img.decoding = "async";
    img.src = framePath(vi, i + 1);
    const done = () => {
      if (img.naturalWidth) frames[vi][i] = img;
      loaded++;
      onProgress();
      requestRender();
      loadNext();
    };
    (img.decode ? img.decode() : new Promise((r, j) => { img.onload = r; img.onerror = j; }))
      .then(done, done);
  }

  function onProgress() {
    const pct = Math.min(100, Math.round((loaded / readyCount) * 100));
    pctEl.textContent = pct;
    fillEl.style.transform = `scaleX(${pct / 100})`;
    if (!started && loaded >= readyCount) {
      started = true;
      start();
    }
  }

  for (let c = 0; c < CONFIG.preload.concurrency; c++) loadNext();

  // Nearest decoded frame to `i` (so scrubbing works before every frame is in).
  function nearest(vi, i) {
    const arr = frames[vi];
    if (arr[i]) return arr[i];
    for (let d = 1; d < arr.length; d++) {
      if (arr[i - d]) return arr[i - d];
      if (arr[i + d]) return arr[i + d];
    }
    return null;
  }

  /* ---------------- Canvas: size, cover math, render ---------------- */
  let cw = 0, ch = 0, dpr = 1;
  let lastKey = "";
  let rafPending = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    const w = stage.clientWidth, h = stage.clientHeight;
    cw = Math.round(w * dpr);
    ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.imageSmoothingQuality = "high";
    lastKey = "";
    layoutSoleLine();
    requestRender();
  }

  // object-fit: cover — returns the draw rect for an image of iw×ih
  function cover(iw, ih) {
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    return { x: (cw - dw) * CONFIG.focal.x, y: (ch - dh) * CONFIG.focal.y, w: dw, h: dh };
  }

  function draw(img, alpha = 1) {
    if (!img) return;
    const r = cover(img.naturalWidth, img.naturalHeight);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }

  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(render);
  }

  function render() {
    rafPending = false;
    const p = state.p;
    let a = null, b = null, mix = 0;
    if (state.line > 0) updateSoleLine();

    if (p <= V1.scroll) {
      const i = Math.round((p / V1.scroll) * (V1.count - 1));
      a = nearest(0, i);
    } else if (p < V1.scroll + CONFIG.crossfade) {
      // The seam: last frame of V1 dissolving into first frame of V2
      a = nearest(0, V1.count - 1);
      b = nearest(1, 0);
      mix = (p - V1.scroll) / CONFIG.crossfade;
      mix = mix * mix * (3 - 2 * mix); // smoothstep
    } else {
      const local = (p - V1.scroll - CONFIG.crossfade) / V2.scroll;
      const i = Math.round(Math.min(1, local) * (V2.count - 1));
      a = nearest(1, i);
    }

    const key = `${a && a.src}|${b && b.src}|${mix.toFixed(3)}|${cw}x${ch}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, cw, ch);
    draw(a);
    if (b && mix > 0) draw(b, mix);
  }

  /* ---------------- Sole pointer line ----------------
     The endpoint is the air bubble's position in the *image*, projected
     through the same cover math as the canvas, so it tracks the sole on any
     aspect ratio. If the crop pushes the bubble off-screen, the line hides. */
  const soleOverlay = $('[data-overlay="sole"]');
  const line = $("#soleLinePath");
  const dot = $("#soleLineDot");
  const ring = $("#soleLineRing");
  const soleGeo = { x1: 0, y1: 0, ox: 0, oy: 0, dw: 0, dh: 0, w: 0 };

  // Recompute the cover projection + line origin (on resize only)
  function layoutSoleLine() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const iw = 1920, ih = 1080; // source aspect ratio
    const s = Math.max(w / iw, h / ih);
    soleGeo.dw = iw * s;
    soleGeo.dh = ih * s;
    soleGeo.ox = (w - soleGeo.dw) * CONFIG.focal.x;
    soleGeo.oy = (h - soleGeo.dh) * CONFIG.focal.y;
    soleGeo.w = w;
    // Start just left of the copy block, level with its heading
    soleGeo.x1 = soleOverlay.offsetLeft - 24;
    soleGeo.y1 = soleOverlay.offsetTop + 48;
    updateSoleLine();
  }

  // Bubble position (image space) for the current V1 frame, linearly interpolated
  function solePoint() {
    const f = 1 + Math.min(1, state.p / V1.scroll) * (V1.count - 1);
    const tr = CONFIG.soleTrack;
    if (f <= tr[0].f) return tr[0];
    for (let k = 1; k < tr.length; k++) {
      if (f <= tr[k].f) {
        const a = tr[k - 1], b = tr[k], u = (f - a.f) / (b.f - a.f);
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
    }
    return tr[tr.length - 1];
  }

  function updateSoleLine() {
    const pt = solePoint();
    const x2 = soleGeo.ox + pt.x * soleGeo.dw;
    const y2 = soleGeo.oy + pt.y * soleGeo.dh;
    const visible = soleGeo.w > CONFIG.mobileBreakpoint && x2 > soleGeo.w * 0.03 && x2 < soleGeo.x1 - 40;
    const t = visible ? state.line : 0;
    line.setAttribute("x1", soleGeo.x1);
    line.setAttribute("y1", soleGeo.y1);
    line.setAttribute("x2", soleGeo.x1 + (x2 - soleGeo.x1) * t);
    line.setAttribute("y2", soleGeo.y1 + (y2 - soleGeo.y1) * t);
    dot.setAttribute("cx", x2);
    dot.setAttribute("cy", y2);
    ring.setAttribute("cx", x2);
    ring.setAttribute("cy", y2);
    const endOn = t > 0.98;
    dot.style.opacity = endOn ? 1 : 0;
    ring.style.opacity = endOn ? "" : 0;
  }

  /* ---------------- Start once the first ~25% is decoded ---------------- */
  // Paint something immediately behind the loader
  resize();
  window.addEventListener("resize", () => requestAnimationFrame(resize));

  function start() {
    const lenis = setupLenis();
    buildTimeline(lenis);
    setupChrome(lenis);
    hideLoader();
    lenis && lenis.start();
    ScrollTrigger.refresh();
  }

  /* ---------------- Lenis smooth scroll ↔ ScrollTrigger ---------------- */
  function setupLenis() {
    if (typeof window.Lenis === "undefined") return null;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.stop();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return lenis;
  }

  /* ---------------- The master timeline ---------------- */
  function buildTimeline(lenis) {
    const O = CONFIG.overlays;
    const el = (k) => $(`[data-overlay="${k}"]`);
    const win = (k) => {
      const o = O[k];
      const t0 = T(o.video, o.in), t1 = T(o.video, o.out);
      return { t0, t1, fd: (t1 - t0) * CONFIG.fade };
    };
    const chapterEls = $$(".chapters__item");
    const chaptersEl = $("#chapters");

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#sequence",
        start: "top top",
        end: () => "+=" + (TOTAL / 100) * stage.clientHeight,
        pin: stage,
        scrub: CONFIG.scrub,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Chapter indicator uses the raw (unsmoothed) scroll for snappy UI
          const p = self.progress * TOTAL;
          const c1 = Math.min(1, p / V1.scroll);
          const c2 = Math.max(0, Math.min(1, (p - V1.scroll - CONFIG.crossfade) / V2.scroll));
          chapterEls[0].style.setProperty("--p", c1);
          chapterEls[1].style.setProperty("--p", c2);
          const active = p < V1.scroll + CONFIG.crossfade / 2 ? 0 : 1;
          chapterEls.forEach((c, i) => c.classList.toggle("is-active", i === active));
        },
        onLeave: () => chaptersEl.classList.add("is-hidden"),
        onEnterBack: () => chaptersEl.classList.remove("is-hidden"),
      },
    });

    // 1) The film itself: timeline time == vh scrolled
    tl.to(state, { p: TOTAL, duration: TOTAL, onUpdate: requestRender }, 0);

    // 2) HERO — on screen at load, lifts away
    {
      const { t1, fd } = win("hero");
      tl.to(el("hero"), { autoAlpha: 0, y: -90, scale: 1.06, duration: fd * 1.6, ease: "power2.in" }, t1 - fd * 1.6);
    }

    // 3) SOLE — copy slides in, pointer line draws toward the air bubble
    {
      const { t0, t1, fd } = win("sole");
      tl.fromTo(el("sole"), { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: fd, ease: "power3.out" }, t0)
        .to("#soleLine", { opacity: 1, duration: fd * 0.4 }, t0 + fd * 0.4)
        .fromTo(state, { line: 0 }, { line: 1, duration: fd * 1.1, ease: "power2.inOut", onUpdate: updateSoleLine }, t0 + fd * 0.4)
        .to("#soleLine", { opacity: 0, duration: fd * 0.6 }, t1 - fd)
        .to(el("sole"), { autoAlpha: 0, x: -40, duration: fd, ease: "power2.in" }, t1 - fd);
    }

    // 4) WEIGHT — counter animates 0 → 240 while the copy rises in
    {
      const { t0, t1, fd } = win("weight");
      const counter = $("#weightCounter");
      const n = { v: 0 };
      tl.fromTo(el("weight"), { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: fd, ease: "power3.out" }, t0)
        .fromTo(n, { v: 0 }, {
          v: CONFIG.weight, duration: fd * 1.8, ease: "power2.out",
          onUpdate: () => (counter.textContent = Math.round(n.v)),
        }, t0)
        .to(el("weight"), { autoAlpha: 0, y: -70, duration: fd, ease: "power2.in" }, t1 - fd);
    }

    // 5) IMPACT — word scales up into the stomp, flash on the shockwave, shake
    {
      const { t0, t1, fd } = win("impact");
      const hit = T(2, CONFIG.flashAt);
      const word = $("#impactWord");
      tl.fromTo(el("impact"), { autoAlpha: 0 }, { autoAlpha: 1, duration: fd * 0.6 }, t0)
        .fromTo(word, { scale: 0.35, letterSpacing: "0.3em" }, { scale: 1, letterSpacing: "0.02em", duration: hit - t0, ease: "power3.in" }, t0)
        .to("#flash", { opacity: 0.9, duration: 3, ease: "power4.out" }, hit)
        .to("#flash", { opacity: 0, duration: 18, ease: "power2.out" }, hit + 3)
        .to(word, {
          keyframes: { x: [0, -14, 11, -9, 7, -4, 2, 0], y: [0, 8, -6, 5, -3, 2, -1, 0], rotation: [0, -1.2, 1, -0.6, 0.4, 0, 0, 0] },
          duration: 14,
        }, hit)
        .to(word, { scale: 1.18, duration: t1 - hit, ease: "power1.out" }, hit)
        .to(el("impact"), { autoAlpha: 0, duration: fd, ease: "power2.in" }, t1 - fd);
    }

    // 6) CITY — neon line glides in (glow colours cycle in CSS)
    {
      const { t0, t1, fd } = win("city");
      tl.fromTo(el("city"), { autoAlpha: 0, y: 50, filter: "blur(8px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: fd, ease: "power3.out" }, t0)
        .to(el("city"), { autoAlpha: 0, y: -50, filter: "blur(8px)", duration: fd, ease: "power2.in" }, t1 - fd);
    }

    // 7) FINALE — price, swatches and CTA stagger in, then stay
    {
      const { t0, fd } = win("finale");
      const kids = $$(".tilt > *", el("finale"));
      tl.set(el("finale"), { autoAlpha: 1 }, t0)
        .fromTo(kids, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: fd * 0.7, stagger: fd * 0.08, ease: "power3.out" }, t0)
        .to("#tint", { opacity: 1, duration: fd }, t0);
    }
    // Anchor links that point into the pinned stage resolve to timeline positions
    const st = tl.scrollTrigger;
    const anchorTarget = (hash) => {
      if (hash === "#top") return 0;
      if (hash === "#preorder") return st.start + (st.end - st.start) * (T(2, 0.93) / TOTAL);
      return hash;
    };
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const hash = a.getAttribute("href");
        if (hash.length < 2) return;
        e.preventDefault();
        const target = anchorTarget(hash);
        if (lenis) lenis.scrollTo(target, { duration: 1.6 });
        else window.scrollTo({ top: typeof target === "number" ? target : $(target).offsetTop, behavior: "smooth" });
      });
    });

    return tl;
  }

  /* ---------------- Cursor, tilt, magnetic, progress ---------------- */
  function setupChrome() {
    // Page progress bar
    const fill = $("#progressFill");
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (self) => gsap.set(fill, { scaleX: self.progress }),
    });

    // Slow parallax on the details image
    gsap.to(".details__media img", {
      yPercent: -8, ease: "none",
      scrollTrigger: { trigger: ".details", start: "top bottom", end: "bottom top", scrub: true },
    });

    if (!finePointer) return;
    html.classList.add("has-cursor");

    // Custom cursor ring (lerped)
    const cursor = $("#cursor");
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
    const interactive = "a, button, [data-cursor]";
    window.addEventListener("pointermove", (e) => {
      cursor.classList.add("is-visible");
      xTo(e.clientX);
      yTo(e.clientY);
    }, { passive: true });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest(interactive);
      cursor.classList.toggle("is-hover", !!t);
      cursor.classList.toggle("is-hover-lg", !!t && t.dataset.cursor === "lg");
    });
    document.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    document.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));

    // Mouse-parallax 3D tilt on every overlay's inner wrapper
    const tilts = $$(".overlay .tilt").map((t) => ({
      rx: gsap.quickTo(t, "rotationX", { duration: 0.9, ease: "power3" }),
      ry: gsap.quickTo(t, "rotationY", { duration: 0.9, ease: "power3" }),
    }));
    window.addEventListener("pointermove", (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      tilts.forEach((t) => { t.rx(-ny * CONFIG.tiltDeg); t.ry(nx * CONFIG.tiltDeg); });
    }, { passive: true });

    // Feature cards: tilt-on-hover + light follow
    $$("[data-tilt]").forEach((card) => {
      const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3" });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        rx((0.5 - py) * 12);
        ry((px - 0.5) * 12);
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });

    // Magnetic CTAs: pulled toward the cursor within a radius
    $$(".magnetic").forEach((btn) => {
      const label = $(".cta__label", btn);
      const bx = gsap.quickTo(btn, "x", { duration: 0.6, ease: "power3" });
      const by = gsap.quickTo(btn, "y", { duration: 0.6, ease: "power3" });
      const lx = gsap.quickTo(label, "x", { duration: 0.6, ease: "power3" });
      const ly = gsap.quickTo(label, "y", { duration: 0.6, ease: "power3" });
      const pull = 70; // px of extra attraction radius around the button
      let engaged = false;
      window.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const inside = Math.abs(dx) < r.width / 2 + pull && Math.abs(dy) < r.height / 2 + pull;
        if (inside) {
          engaged = true;
          bx(dx * 0.32); by(dy * 0.42);
          lx(dx * 0.14); ly(dy * 0.18);
          btn.style.setProperty("--mx", `${e.clientX - r.left}px`);
          btn.style.setProperty("--my", `${e.clientY - r.top}px`);
        } else if (engaged) {
          engaged = false;
          bx(0); by(0); lx(0); ly(0);
        }
      }, { passive: true });
    });
  }
}
