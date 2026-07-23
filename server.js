/**
 * Optional proxy server.
 *
 * The dashboard works by calling ESPN's public site API directly from
 * the browser. That endpoint generally sends permissive CORS headers,
 * but that's ESPN's choice, not a guarantee — if you see "failed to
 * fetch" errors in production, run this instead and point js/config.js
 * at it (set API_BASE = "/api/espn" or wherever you deploy this).
 *
 * Usage:
 *   npm install
 *   node server.js
 *   # serves the static site AND proxies /api/espn/* -> ESPN
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const PUBLIC_DIR = __dirname;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(PUBLIC_DIR, decodeURIComponent(filePath.split("?")[0]));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function proxyEspn(req, res) {
  const upstreamPath = req.url.replace(/^\/api\/espn/, "");
  const upstreamUrl = `${ESPN_BASE}${upstreamPath}`;

  https
    .get(upstreamUrl, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15",
      });
      upstreamRes.pipe(res);
    })
    .on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    });
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/espn/")) {
      proxyEspn(req, res);
    } else {
      serveStatic(req, res);
    }
  })
  .listen(PORT, () => {
    console.log(`Oddsify Intel running at http://localhost:${PORT}`);
    console.log(`ESPN proxy live at http://localhost:${PORT}/api/espn/...`);
  });
