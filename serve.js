#!/usr/bin/env node
/* Zero-dependency static server for the prototype.
 *
 *   node serve.js [port]        # defaults to 8412
 *
 * Only needed because browsers refuse to load woff2 fonts over file://. Everything else in the
 * prototype works from a double-clicked index.html — you just get the system sans fallback. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.argv[2]) || 8412;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(root, rel);

  // Never serve outside the project directory.
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found: ' + rel);
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
}).listen(port, () => {
  console.log(`Restock — Multi Bin prototype: http://localhost:${port}`);
});
