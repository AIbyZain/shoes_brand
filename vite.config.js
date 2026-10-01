import { defineConfig } from "vite";

// Vanilla JS + ES modules. /public (including /public/frames) is copied to /dist as-is.
export default defineConfig({
  server: { port: 5173, open: false },
  preview: { port: 4173 },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsInlineLimit: 0, // keep fonts as separate cacheable files
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
