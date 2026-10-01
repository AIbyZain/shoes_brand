/* ==========================================================================
   CanvasRenderer — draws one frame with object-fit: cover math.
   --------------------------------------------------------------------------
   • devicePixelRatio is capped (CONFIG.maxDpr) to keep fill-rate sane.
   • draw() is idempotent: if the requested image + canvas size haven't
     changed since the last paint, it returns without touching the GPU.
   ========================================================================== */

export class CanvasRenderer {
  /**
   * @param {object} opts
   *   maxDpr      cap for devicePixelRatio
   *   background  fill behind the image (the footage's own black)
   *   fitWidth    () => number|null — when it returns a number, the image is drawn
   *               that many viewport-widths wide instead of cover (used on portrait
   *               screens, where cover would crop the shoe to its middle quarter)
   */
  constructor(canvas, { maxDpr = 2, background = "#000", fitWidth = () => null } = {}) {
    this.canvas = canvas;
    this.fitWidth = fitWidth;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.maxDpr = maxDpr;
    this.background = background;
    this.current = null; // image currently painted
    this.w = 0;
    this.h = 0;
  }

  /** Match the backing store to the element size × DPR. Returns true if it changed. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const rect = this.canvas.getBoundingClientRect();
    // getBoundingClientRect includes CSS transforms; offsetWidth does not
    const w = Math.round(this.canvas.offsetWidth * dpr);
    const h = Math.round(this.canvas.offsetHeight * dpr);
    if (!rect.width || (w === this.w && h === this.h)) return false;
    this.canvas.width = this.w = w;
    this.canvas.height = this.h = h;
    this.#featherBand();
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    const img = this.current;
    this.current = null; // force a repaint at the new size
    if (img) this.draw(img);
    return true;
  }

  /** In fit-width (band) mode, soften the band's top/bottom edges with a CSS mask. */
  #featherBand() {
    const fit = this.fitWidth();
    const style = this.canvas.style;
    if (!fit) {
      style.maskImage = style.webkitMaskImage = "";
      return;
    }
    const r = frameRect(this.w, this.h, 16 / 9, fit);
    const top = (r.y / this.h) * 100;
    const bottom = ((r.y + r.h) / this.h) * 100;
    const f = (r.h / this.h) * 100 * 0.12; // feather = 12% of the band height
    style.maskImage = style.webkitMaskImage =
      `linear-gradient(to bottom, transparent ${top}%, #000 ${top + f}%, #000 ${bottom - f}%, transparent ${bottom}%)`;
  }

  /** Paint `img` cover-fitted. No-op if it's already on screen. */
  draw(img) {
    if (!img || img === this.current || !this.w) return false;
    const { ctx, w, h } = this;
    const r = frameRect(w, h, img.naturalWidth / img.naturalHeight, this.fitWidth());
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    this.current = img;
    return true;
  }
}

/**
 * Where an image of the given aspect lands inside a box.
 * Default is object-fit: cover; `fitWidth` overrides it with a fixed width
 * (a multiple of the box width), centred.
 */
export function frameRect(boxW, boxH, aspect, fitWidth = null) {
  const dw = fitWidth ? boxW * fitWidth : Math.max(boxW, boxH * aspect);
  const dh = dw / aspect;
  return { x: (boxW - dw) / 2, y: (boxH - dh) / 2, w: dw, h: dh };
}

/** Project a point from IMAGE space (0–1) to box pixels. Anchors the leader lines. */
export function coverProject(ix, iy, boxW, boxH, aspect, fitWidth = null) {
  const r = frameRect(boxW, boxH, aspect, fitWidth);
  return { x: r.x + ix * r.w, y: r.y + iy * r.h };
}
