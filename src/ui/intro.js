/* ==========================================================================
   Intro — thin line that grows with load progress, then splits vertically
   like a curtain to reveal frame 1. Then the hero copy reveals line by line
   while the canvas settles from 1.08 → 1.0.
   ========================================================================== */

import { gsap } from "gsap";

const $ = (s) => document.querySelector(s);

export function createIntro() {
  const root = $("#intro");
  const fill = $("#introFill");
  const pct = $("#introPct");
  let shown = 0;

  return {
    /** value: 0–1 */
    progress(value) {
      const v = Math.max(shown, Math.min(1, value)); // never goes backwards
      shown = v;
      fill.style.transform = `scaleX(${v})`;
      pct.textContent = Math.round(v * 100);
      root.setAttribute("aria-valuenow", Math.round(v * 100));
    },

    /** Curtain open + hero entrance. Resolves when the page is interactive. */
    open({ media, zoomFrom, zoomMs, reduced = false }) {
      this.progress(1);
      document.body.classList.remove("is-loading");

      if (reduced) {
        gsap.to(root, { autoAlpha: 0, duration: 0.6, onComplete: () => root.remove() });
        return Promise.resolve();
      }

      const tl = gsap.timeline({ defaults: { ease: "calm" } });
      tl.to(".intro__meta", { autoAlpha: 0, y: -8, duration: 0.5 }, 0.15)
        // the line thins out as the two halves part from it
        .to(".intro__line", { scaleY: 0, opacity: 0, duration: 0.6 }, 0.35)
        .to(".intro__panel--top", { yPercent: -100, duration: 1.4 }, 0.35)
        .to(".intro__panel--bottom", { yPercent: 100, duration: 1.4 }, 0.35)
        .fromTo(media, { scale: zoomFrom }, { scale: 1, duration: zoomMs / 1000, ease: "calm" }, 0.25)
        // hero copy: masked line reveals, staggered
        .fromTo(".hero .line > span, .hero .reveal-line > span",
          // y: 0 clears the px offset GSAP parses from the CSS pre-hide transform
          { yPercent: 110, y: 0 },
          { yPercent: 0, y: 0, duration: 1.2, stagger: 0.09 },
          0.75)
        .fromTo("#scrollHint", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.6)
        .set(root, { display: "none" });

      return new Promise((resolve) => tl.eventCallback("onComplete", resolve));
    },
  };
}
