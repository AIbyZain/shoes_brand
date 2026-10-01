#!/usr/bin/env node
/* ==========================================================================
   scripts/extract-frames.js
   --------------------------------------------------------------------------
   Reads every  source-videos/*.mp4  and writes WebP frame sequences to

     public/frames/{video-name}/desktop/frame_0001.webp   (1920px, q80)
     public/frames/{video-name}/mobile/frame_0001.webp    (960px,  q75)

   then writes  public/frames/manifest.json  with the frame counts, so the
   front end never hard-codes how many frames a video has.

   Usage:  npm run frames
           npm run frames -- video-2        (only re-extract one video)
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "source-videos");
const OUT_DIR = path.join(ROOT, "public", "frames");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

/** Output variants. Width is the target width; height keeps the aspect ratio. */
const VARIANTS = [
  { name: "desktop", width: 1920, quality: 80 },
  { name: "mobile", width: 960, quality: 75 },
];

// Prefer the bundled binary; fall back to an ffmpeg on PATH if it's missing
// (e.g. the ffmpeg-static postinstall download was blocked by a proxy).
if (ffmpegStatic && fs.existsSync(ffmpegStatic)) ffmpeg.setFfmpegPath(ffmpegStatic);

/* ---------- tiny console helpers ---------- */
const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, ok: (s) => `\x1b[32m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
function bar(pct, width = 28) {
  const n = Math.round((pct / 100) * width);
  return "█".repeat(n) + c.dim("░".repeat(width - n));
}
const lastLogged = new Map(); // non-TTY: log in 25% steps instead of redrawing one line
function writeProgress(label, pct, extra = "") {
  const line = `  ${label.padEnd(20)} ${bar(pct)} ${String(Math.round(pct)).padStart(3)}% ${c.dim(extra)}`;
  if (process.stdout.isTTY) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(line);
    return;
  }
  const step = Math.floor(pct / 25);
  if (lastLogged.get(label) !== step) {
    lastLogged.set(label, step);
    console.log(line);
  }
}

/* ---------- one ffmpeg run: video → WebP sequence ---------- */
function extract(input, outDir, { width, quality }, label) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  return new Promise((resolve, reject) => {
    let expected = 0; // total frames, derived from duration × fps once ffmpeg reports them
    let aspect = 16 / 9;
    ffmpeg(input)
      .videoFilters(`scale=${width}:-2:flags=lanczos`)
      .outputOptions([
        "-c:v libwebp",
        `-quality ${quality}`,
        "-compression_level 6",
        "-preset photo",
        "-an",
        "-start_number 1",
      ])
      .output(path.join(outDir, "frame_%04d.webp"))
      .on("codecData", (data) => {
        const [h, m, s] = String(data.duration || "0:0:0").split(":").map(Number);
        const fps = Number((/(\d+(?:\.\d+)?) fps/.exec(data.video_details?.join(" ") || data.video || "") || [])[1] || 24);
        expected = Math.round((h * 3600 + m * 60 + s) * fps);
        const res = /(\d{2,5})x(\d{2,5})/.exec(data.video_details?.join(" ") || data.video || "");
        if (res) aspect = Number(res[1]) / Number(res[2]);
      })
      .on("progress", (p) => {
        const pct = expected ? Math.min(100, (p.frames / expected) * 100) : p.percent || 0;
        writeProgress(label, pct, `${p.frames}/${expected || "?"} frames`);
      })
      .on("end", () => {
        const count = fs.readdirSync(outDir).filter((f) => f.endsWith(".webp")).length;
        const bytes = fs.readdirSync(outDir).reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
        writeProgress(label, 100, `${count} frames · ${(bytes / 1048576).toFixed(1)} MB`);
        if (process.stdout.isTTY) process.stdout.write("\n");
        lastLogged.delete(label);
        resolve({ count, bytes, aspect });
      })
      .on("error", (err) => {
        process.stdout.write("\n");
        reject(err);
      })
      .run();
  });
}

/* ---------- main ---------- */
async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`No ${path.relative(ROOT, SRC_DIR)}/ folder. Create it and add your .mp4 files.`);
    process.exit(1);
  }
  const only = process.argv[2];
  const videos = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith(".mp4"))
    .filter((f) => !only || path.parse(f).name === only)
    .sort();

  if (!videos.length) {
    console.error(`No .mp4 files found in ${path.relative(ROOT, SRC_DIR)}/${only ? ` matching "${only}"` : ""}.`);
    process.exit(1);
  }

  // Keep entries for videos we are not re-extracting this run
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { videos: {} };
  manifest.videos ||= {};

  console.log(c.bold(`\nExtracting ${videos.length} video(s) → public/frames\n`));
  const t0 = Date.now();

  for (const file of videos) {
    const name = path.parse(file).name; // "video-1"
    const input = path.join(SRC_DIR, file);
    console.log(`${c.bold(name)} ${c.dim(file)}`);

    const entry = { count: 0, aspect: 16 / 9, variants: {} };
    for (const v of VARIANTS) {
      const dir = path.join(OUT_DIR, name, v.name);
      const { count, aspect } = await extract(input, dir, v, `${v.name} ${v.width}px`);
      entry.aspect = aspect;
      entry.variants[v.name] = { path: `/frames/${name}/${v.name}/`, width: v.width };
      // Both variants come from the same source, so their counts should match
      entry.count = entry.count ? Math.min(entry.count, count) : count;
    }
    manifest.videos[name] = entry;
    console.log();
  }

  manifest.pattern = "frame_{0000}.webp";
  manifest.version = Date.now().toString(36); // cache-buster for long-lived frame caching
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log(c.ok(`✓ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s — wrote ${path.relative(ROOT, MANIFEST)}`));
  for (const [k, v] of Object.entries(manifest.videos)) console.log(c.dim(`  ${k}: ${v.count} frames`));
}

main().catch((err) => {
  console.error("\nFrame extraction failed:", err.message);
  process.exit(1);
});
