/* ==========================================================================
   Reduced motion — no pinning, no scrubbing, no smooth scroll.
   The film becomes three static key frames (CONFIG.staticFrames) with the
   existing copy moved into them, revealed with simple opacity fades.
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);

export function buildStaticStory(CONFIG, store) {
  document.documentElement.classList.add("reduced-motion");
  const sequence = $("#sequence");
  const stage = $("#stage");

  // Layer list as a plain, readable list (no leader lines)
  const list = $("#build");
  CONFIG.parts
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => a.track.at(-1)[2] - b.track.at(-1)[2])
    .forEach((p) => {
      const li = document.createElement("li");
      li.className = "part";
      li.innerHTML = `<span class="part__index">${String(p.i + 1).padStart(2, "0")}</span>
        <span class="part__title">${p.title}</span><span class="part__desc">${p.desc}</span>`;
      list.append(li);
    });

  // Panel content: [hero], [layers + statement], [ignite + card]
  const groups = [
    [$(".hero")],
    [$(".rebuild"), list],
    [$(".ignite"), $(".card")],
  ];
  const alts = [
    "Phantom Air, assembled, in side profile on black.",
    "Phantom Air exploded into five layers: upper, insole, midsole, Air Core and outsole.",
    "Phantom Air on a reflective floor with a glowing Air Core between cyan and magenta light bars.",
  ];

  CONFIG.staticFrames.forEach(({ video, frame }, k) => {
    const n = store.count(video);
    const panel = document.createElement("div");
    panel.className = `static-panel static-panel--${k + 1}`;
    const img = new Image();
    img.src = store.url(video, frame < 0 ? n + frame : frame);
    img.alt = alts[k];
    img.className = "static-panel__img";
    img.decoding = "async";
    if (k > 0) img.loading = "lazy";
    else img.fetchPriority = "high";
    const copy = document.createElement("div");
    copy.className = "static-panel__copy";
    groups[k].forEach((el) => el && copy.append(el));
    panel.append(img, copy);
    sequence.append(panel);
  });
  stage.remove();
  $("#chapters").remove();

  // Gentle opacity-only reveals
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-in")),
    { threshold: 0.2 }
  );
  document.querySelectorAll(".static-panel").forEach((p) => io.observe(p));
  return document.querySelector(".static-panel__img");
}
