/* ==========================================================================
   NOCTIS — Phantom Air · entry point
   --------------------------------------------------------------------------
   Boot order:
     1. fonts + styles, content bindings, card/forms (work with or without motion)
     2. manifest → FrameStore → progressive preload, intro line tracks progress
     3. when chapter 1 has enough frames (and ≥ minIntroMs passed):
        Lenis + ScrollTrigger timeline, curtain opens, hero reveals
   Every tweakable number lives in ./config.js.
   ========================================================================== */

import "@fontsource/inter-tight/latin-300.css";
import "@fontsource/inter-tight/latin-400.css";
import "@fontsource/inter-tight/latin-500.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "lenis/dist/lenis.css";
import "./styles/main.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";

import { CONFIG } from "./config.js";
import { FrameStore, loadManifest } from "./engine/frames.js";
import { CanvasRenderer } from "./engine/renderer.js";
import { createStory } from "./engine/story.js";
import { createIntro } from "./ui/intro.js";
import { buildStaticStory } from "./ui/static.js";
import {
  bindContent, setupCard, setupMagnetic, setupParallax, setupTilt,
  setupNav, setupRail, setupReveals, setupNewsletter, setupAnchors,
} from "./ui/interactions.js";

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create("calm", "0.16, 1, 0.3, 1"); // the one ease used everywhere

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.innerWidth < CONFIG.mobileBreakpoint; // decided once: switching sets would re-download everything
// "Desktop" layout = wide AND landscape. Portrait tablets get the compact layout
// (film as a band, labels as a list) because cover would crop the shoe there.
const isDesktop = () => window.innerWidth >= CONFIG.mobileBreakpoint && window.innerWidth > window.innerHeight;
const portraitFit = () => (window.innerWidth <= window.innerHeight ? CONFIG.portraitFit : null);

document.documentElement.classList.add("js");

// 1) Things that don't depend on frames
bindContent(CONFIG);
setupCard(CONFIG);
setupNav();
setupRail();
setupNewsletter();

boot().catch((err) => {
  console.error(err);
  // Fail open: never leave the visitor behind a loading screen
  document.body.classList.remove("is-loading");
  document.getElementById("intro")?.remove();
  setupReveals({ animateCounters: !reduced });
});

async function boot() {
  const intro = createIntro();
  const manifest = await loadManifest(CONFIG.manifestUrl);

  // Video order = chapter order, de-duplicated (video-1 serves chapters 1 and 2)
  const order = [...new Set(CONFIG.chapters.map((c) => c.video))];
  const store = new FrameStore(manifest, {
    variant: isMobile ? "mobile" : "desktop",
    order,
    stride: CONFIG.preload.stride,
    concurrency: CONFIG.preload.concurrency,
  });

  /* ---------- Reduced motion: static key frames, simple fades ---------- */
  if (reduced) {
    const first = buildStaticStory(CONFIG, store);
    await Promise.race([first.decode().catch(() => {}), wait(2500)]);
    await intro.open({ reduced: true });
    setupReveals({ animateCounters: false });
    setupAnchors({});
    return;
  }

  /* ---------- Full experience ---------- */
  const renderer = new CanvasRenderer(document.getElementById("canvas"), { maxDpr: CONFIG.maxDpr, fitWidth: portraitFit });
  const readyFrames = Math.min(store.total, isMobile ? CONFIG.preload.readyFramesMobile : CONFIG.preload.readyFrames);
  const started = performance.now();

  const ready = new Promise((resolve) => {
    store.onLoad((loaded) => {
      intro.progress(loaded / readyFrames);
      if (loaded === 1) { // paint the hero frame behind the curtain asap
        renderer.resize();
        renderer.draw(store.get(order[0], 0));
      }
      if (loaded >= readyFrames) resolve();
    });
    setTimeout(resolve, CONFIG.preload.maxIntroMs); // never wait forever on a slow network
  });
  store.start();
  await ready;
  await wait(Math.max(0, CONFIG.preload.minIntroMs - (performance.now() - started)));

  // Smooth scroll, driven by GSAP's ticker so Lenis and ScrollTrigger share one clock
  const lenis = new Lenis({ autoRaf: false, lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  ScrollTrigger.config({ ignoreMobileResize: true });
  const story = createStory({ CONFIG, store, renderer, isDesktop });

  setupAnchors({ lenis, anchorY: story.anchorY });
  setupMagnetic();
  setupParallax(CONFIG);
  setupTilt(6);
  setupReveals({ animateCounters: true });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(story.resize);
  });

  await intro.open({ media: "#media", zoomFrom: CONFIG.hero.zoomFrom, zoomMs: CONFIG.hero.zoomMs });
  lenis.start();
  ScrollTrigger.refresh();
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
