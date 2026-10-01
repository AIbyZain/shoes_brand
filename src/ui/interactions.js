/* ==========================================================================
   Interactions — everything the pointer, keyboard and forms touch.
   All motion uses the "calm" ease (cubic-bezier(0.16, 1, 0.3, 1)); nothing
   bounces. Pointer-only effects are skipped on touch devices.
   ========================================================================== */

import { gsap } from "gsap";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- Content bindings from CONFIG ---------- */
export function bindContent(CONFIG) {
  $$("[data-bind]").forEach((el) => {
    const v = CONFIG[el.dataset.bind];
    if (v != null) el.textContent = v;
  });
  document.title = `${CONFIG.brand} — ${CONFIG.product}`;
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- Product card: colorways, sizes, pre-order ---------- */
export function setupCard(CONFIG) {
  const swatches = $("#swatches");
  const sizes = $("#sizes");
  const colorName = $("#colorName");
  const note = $("#cardNote");
  const cartCount = $("#cartCount");
  const cartBtn = $(".nav__cart");

  // Native radio inputs → keyboard + screen-reader support for free
  CONFIG.colorways.forEach((c, i) => {
    const id = `color-${i}`;
    swatches.insertAdjacentHTML("beforeend",
      `<input class="visually-hidden" type="radio" name="color" id="${id}" value="${c.name}" ${i === 0 ? "checked" : ""}>
       <label class="swatch" for="${id}" style="--c:${c.swatch}"><span class="visually-hidden">${c.name}</span></label>`);
  });
  swatches.addEventListener("change", (e) => (colorName.textContent = e.target.value));

  CONFIG.sizes.forEach((s, i) => {
    const id = `size-${i}`;
    sizes.insertAdjacentHTML("beforeend",
      `<input class="visually-hidden" type="radio" name="size" id="${id}" value="${s.label}" ${s.soldOut ? "disabled" : ""}>
       <label class="chip" for="${id}">${s.label}${s.soldOut ? '<span class="visually-hidden"> (sold out)</span>' : ""}</label>`);
  });

  let count = 0;
  $("#preorderBtn").addEventListener("click", () => {
    const size = $('input[name="size"]:checked', sizes);
    if (!size) {
      note.textContent = "Select a size to continue.";
      note.classList.add("is-alert");
      $('input[name="size"]:not(:disabled)', sizes).focus();
      return;
    }
    count++;
    cartCount.textContent = count;
    cartBtn.setAttribute("aria-label", `Cart, ${count} item${count === 1 ? "" : "s"}`);
    cartBtn.classList.add("has-items");
    note.classList.remove("is-alert");
    note.textContent = `Reserved — US ${size.value}, ${colorName.textContent}. We'll email you before it ships.`;
  });
}

/* ---------- Magnetic buttons (pulled gently toward the cursor) ---------- */
export function setupMagnetic() {
  if (!finePointer()) return;
  $$(".magnetic").forEach((el) => {
    const inner = $(".magnetic__inner", el) || el;
    const strength = el.classList.contains("btn-link") ? 0.22 : 0.3;
    const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "calm" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "calm" });
    const ixTo = gsap.quickTo(inner, "x", { duration: 0.8, ease: "calm" });
    const iyTo = gsap.quickTo(inner, "y", { duration: 0.8, ease: "calm" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      xTo(dx * strength); yTo(dy * strength);
      ixTo(dx * strength * 0.4); iyTo(dy * strength * 0.4);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); ixTo(0); iyTo(0); });
  });
}

/* ---------- Hero depth: canvas drifts with the mouse, copy drifts against it,
              and a faint light spot follows the cursor behind the shoe ---------- */
export function setupParallax(CONFIG) {
  if (!finePointer()) return;
  const media = $("#media");
  const text = $("#heroText");
  const spot = $("#spot");
  const m = { x: gsap.quickTo(media, "x", { duration: 1.4, ease: "calm" }), y: gsap.quickTo(media, "y", { duration: 1.4, ease: "calm" }) };
  const t = { x: gsap.quickTo(text, "x", { duration: 1.4, ease: "calm" }), y: gsap.quickTo(text, "y", { duration: 1.4, ease: "calm" }) };
  // The spot lags well behind the cursor so it reads as ambient light, not a pointer
  const s = { x: gsap.quickTo(spot, "x", { duration: 3, ease: "power2.out" }), y: gsap.quickTo(spot, "y", { duration: 3, ease: "power2.out" }) };
  const { canvasParallax: C, textParallax: Tx } = CONFIG.hero;

  window.addEventListener("pointermove", (e) => {
    const nx = e.clientX / window.innerWidth - 0.5;  // -0.5 … 0.5
    const ny = e.clientY / window.innerHeight - 0.5;
    m.x(nx * 2 * C); m.y(ny * 2 * C);
    t.x(-nx * 2 * Tx); t.y(-ny * 2 * Tx);
    s.x(nx * window.innerWidth * 0.25); s.y(ny * window.innerHeight * 0.25);
  }, { passive: true });
}

/* ---------- Feature cards: subtle 3D tilt (max 6°) ---------- */
export function setupTilt(max = 6) {
  if (!finePointer()) return;
  $$("[data-tilt]").forEach((card) => {
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.9, ease: "calm" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.9, ease: "calm" });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      rx(-py * 2 * max); ry(px * 2 * max);
    });
    card.addEventListener("pointerleave", () => { rx(0); ry(0); });
  });
}

/* ---------- Nav: transparent → blurred surface after scrolling ---------- */
export function setupNav() {
  const nav = $("#nav");
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

/* ---------- Left-edge progress rail (whole page) ---------- */
export function setupRail() {
  const fill = $("#railFill");
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.transform = `scaleY(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/* ---------- Section reveals (line masks + fades) and spec counters ---------- */
export function setupReveals({ animateCounters = true } = {}) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
      if (e.target.matches(".stat")) countUp($(".stat__num", e.target), animateCounters);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  $$(".section .display, .fade-in").forEach((el) => io.observe(el));
}

function countUp(el, animate) {
  const end = Number(el.dataset.count);
  if (!animate) { el.textContent = end; return; }
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 1.8, ease: "calm", onUpdate: () => (el.textContent = Math.round(o.v)) });
}

/* ---------- Newsletter (front-end only; wire `submit` to your ESP) ---------- */
export function setupNewsletter() {
  const form = $("#newsletter");
  const input = $("#email", form);
  const msg = $("#newsMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input.checkValidity()) {
      msg.textContent = "Please enter a valid email address.";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    msg.textContent = "Thank you. You'll hear from us before the next drop.";
    form.reset();
  });
}

/* ---------- In-page anchors (story anchors resolve to timeline positions) ---------- */
export function setupAnchors({ lenis, anchorY }) {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute("href");
    if (hash.length < 2) return;
    const story = anchorY ? anchorY(hash) : null;
    const target = story ?? document.querySelector(hash);
    if (target == null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
    // Move keyboard focus to real sections so tabbing continues from there
    if (typeof target !== "number" && target.matches("section")) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  });
}
