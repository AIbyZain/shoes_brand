/* ==========================================================================
   FrameStore — reads the manifest and progressively preloads frame images.
   --------------------------------------------------------------------------
   Load order (per video, in chapter order):
     1. every Nth frame ("stride")  → coarse but complete scrubbing, fast
     2. the gaps in between         → full smoothness
   Video-1 (chapters 1 + 2) is queued first, video-2 (chapter 3) behind it,
   so the next chapter always loads in the background while you watch.
   ========================================================================== */

export class FrameStore {
  /**
   * @param {object} manifest   parsed /frames/manifest.json
   * @param {object} opts       { variant: "desktop"|"mobile", order: string[], stride, concurrency }
   */
  constructor(manifest, { variant, order, stride, concurrency }) {
    this.manifest = manifest;
    this.variant = variant;
    this.version = manifest.version || "";
    this.concurrency = concurrency;
    this.images = {};      // name → Array<HTMLImageElement|null>
    this.loaded = 0;
    this.listeners = new Set();

    for (const name of order) this.images[name] = new Array(this.count(name)).fill(null);

    // Build the queue: stride pass then gaps, video by video
    this.queue = [];
    for (const name of order) {
      const n = this.count(name);
      const first = [];
      for (let i = 0; i < n; i += stride) first.push(i);
      if (first[first.length - 1] !== n - 1) first.push(n - 1); // the last frame matters (chapter seams)
      const rest = [];
      for (let i = 0; i < n; i++) if (i % stride && i !== n - 1) rest.push(i);
      this.queue.push(...first.map((i) => [name, i]), ...rest.map((i) => [name, i]));
    }
    this.total = this.queue.length;
  }

  count(name) {
    const v = this.manifest.videos[name];
    if (!v) throw new Error(`Video "${name}" is not in the frames manifest. Run "npm run frames".`);
    return v.count;
  }

  /** URL for frame index i (0-based) of a video. */
  url(name, i) {
    const base = this.manifest.videos[name].variants[this.variant].path;
    const file = `frame_${String(i + 1).padStart(4, "0")}.webp`;
    return `${base}${file}${this.version ? `?v=${this.version}` : ""}`;
  }

  /** Subscribe to load progress: fn(loadedCount, name, index) */
  onLoad(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    for (let k = 0; k < this.concurrency; k++) this.#next();
  }

  #next() {
    const job = this.queue.shift();
    if (!job) return;
    const [name, i] = job;
    const img = new Image();
    img.decoding = "async";
    if (this.loaded < 4) img.fetchPriority = "high";
    img.src = this.url(name, i);
    const done = () => {
      if (img.naturalWidth) this.images[name][i] = img;
      this.loaded++;
      this.listeners.forEach((fn) => fn(this.loaded, name, i));
      this.#next();
    };
    img.decode().then(done, done);
  }

  /** The exact frame if decoded, otherwise the nearest decoded neighbour. */
  get(name, i) {
    const arr = this.images[name];
    if (!arr) return null;
    if (arr[i]) return arr[i];
    for (let d = 1; d < arr.length; d++) {
      if (arr[i - d]) return arr[i - d];
      if (arr[i + d]) return arr[i + d];
    }
    return null;
  }
}

/** Fetch and validate the manifest written by scripts/extract-frames.js. */
export async function loadManifest(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}). Did you run "npm run frames"?`);
  return res.json();
}
