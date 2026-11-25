/**
 * Pod racer host. A small, dependency-free web server that serves the game and the
 * Pod Workshop to any browser on the local network.
 *
 *   npm start                 listens on port 8080
 *   PORT=9000 npm start       another port (Windows PowerShell: $env:PORT=9000; npm start)
 *
 * It only serves files, read-only, from four folders, and only answers GET and HEAD.
 * LAN multiplayer (the race running here, players connecting over WebSockets) is the next step.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';        // 0.0.0.0 = reachable from other machines on the network

/** URL prefix to folder on disk. Anything outside these folders is never served. */
const ROUTES = [
  ['/vendor/three/', path.join(ROOT, 'node_modules', 'three')],
  ['/shared/', path.join(ROOT, 'src', 'shared')],
  ['/client/', path.join(ROOT, 'src', 'client')],
  ['/', path.join(ROOT, 'public')],
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};

/** Maps a request path to a file inside one of the served folders, or null if it is not allowed. */
function resolveFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  for (const [prefix, folder] of ROUTES) {
    if (!decoded.startsWith(prefix)) continue;
    let relative = decoded.slice(prefix.length);
    if (relative === '' || relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(folder, relative);
    // Refuse anything that escapes the folder, e.g. /../../secret.
    if (file !== folder && !file.startsWith(folder + path.sep)) return null;
    return file;
  }
  return null;
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = resolveFile(pathname);
  if (!file) return send(res, 403, 'Forbidden');
  try {
    const info = await stat(file);
    if (!info.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',             // always pick up code changes on refresh
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
});

/** This machine's IPv4 addresses on the local network, for other players to type in. */
function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Try: PORT=8081 npm start`);
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('Pod racer host running.');
  console.log(`  This machine:   http://localhost:${PORT}/`);
  for (const ip of lanAddresses()) console.log(`  Other machines: http://${ip}:${PORT}/`);
  console.log(`  Pod Workshop:   /workshop.html`);
  console.log('Press Ctrl+C to stop.');
});
