/* ==========================================================================
   server.js — production server for the built site (npm run build && npm start)
   - gzip/brotli-style compression for text assets
   - /frames/*        → 1 year, immutable  (URLs are versioned via manifest.version)
   - /assets/*        → 1 year, immutable  (Vite adds content hashes to file names)
   - manifest + HTML  → no-cache (always revalidated, so new deploys show up instantly)
   ========================================================================== */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 3000;
const YEAR = 60 * 60 * 24 * 365;

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error('No build found in /dist. Run "npm run build" first.');
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(compression()); // WebP is already compressed; compression() skips non-compressible types

// Small security baseline
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// The manifest decides which frame version to load, so it must never be stale
app.get("/frames/manifest.json", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(DIST, "frames", "manifest.json"));
});

const immutable = (res) => res.setHeader("Cache-Control", `public, max-age=${YEAR}, immutable`);
app.use("/frames", express.static(path.join(DIST, "frames"), { setHeaders: immutable, fallthrough: false }));
app.use("/assets", express.static(path.join(DIST, "assets"), { setHeaders: immutable, fallthrough: false }));

// Everything else (index.html, favicon…) — short cache, HTML always revalidated
app.use(
  express.static(DIST, {
    setHeaders(res, file) {
      res.setHeader("Cache-Control", file.endsWith(".html") ? "no-cache" : "public, max-age=3600");
    },
  })
);

// Unknown routes → the single page
app.use((req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.status(404).sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => console.log(`NOCTIS running → http://localhost:${PORT}`));
