import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, extname, relative, isAbsolute, sep } from "path";
import fs from "fs";

const ROOT = __dirname;

// In production, the GitHub Action copies data/ and clips/ into dist/.
// In dev, this middleware serves them straight from the repo so every page
// can fetch "data/manifest.json?t=..." etc. with the same relative URLs.
// It also returns a REAL 404 for missing files — without it, Vite's SPA
// fallback answers 200 with index.html and the pages misdiagnose the error.
function serveRepoData() {
  const types = {
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
  };
  return {
    name: "serve-repo-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url.split("?")[0];
        const m = pathname.match(/^\/(data|clips)\/(.+)$/);
        if (!m) return next();
        const base = resolve(ROOT, m[1]);
        const file = resolve(base, decodeURIComponent(m[2]));
        // Strict containment: the resolved path must live under base/
        // (a bare startsWith would let ../data-backup.json escape).
        const rel = relative(base, file);
        if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-store");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Relative base so the site works at https://<user>.github.io/<any-repo-name>/
  base: "./",
  plugins: [react(), serveRepoData()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(ROOT, "index.html"),
        editor: resolve(ROOT, "editor.html"),
        recorder: resolve(ROOT, "recorder.html"),
        rehearsal: resolve(ROOT, "rehearsal.html"),
        dashboard: resolve(ROOT, "dashboard.html"),
      },
    },
  },
});
