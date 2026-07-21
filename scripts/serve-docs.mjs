import { readFileSync, existsSync } from "node:fs";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const docsDir = resolve(root, "docs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const port = parseInt(process.argv[2], 10) || 4321;

if (!existsSync(docsDir)) {
  console.error(`Error: docs/ directory not found. Run "npm run build:prod" first.`);
  process.exit(1);
}

const server = createServer((req, res) => {
  let urlPath = new URL(req.url, `http://localhost:${port}`).pathname;

  if (urlPath.endsWith("/")) {
    urlPath += "index.html";
  }

  if (!extname(urlPath)) {
    urlPath += ".html";
  }

  const filePath = resolve(docsDir, urlPath.slice(1));

  if (!filePath.startsWith(docsDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("404 Not Found");
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";
  const content = readFileSync(filePath);

  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
});

server.listen(port, () => {
  console.log(`Preview (docs/) > http://localhost:${port}`);
});
