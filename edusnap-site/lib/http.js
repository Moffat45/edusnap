// Small helpers on top of node:http: cookies, JSON bodies, static files, rate limiting.

const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.java': 'text/plain; charset=utf-8',
};

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 64 * 1024) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid request'), { status: 400 }); }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
const sendHtml = (res, status, html) => send(res, status, html, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });

function serveStatic(root, urlPath, res) {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) return false;
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': stat.size, 'cache-control': 'public, max-age=3600' };
  if (['.pptx', '.docx', '.xlsx', '.java'].includes(ext)) headers['content-disposition'] = `attachment; filename="${path.basename(file)}"`;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
  return true;
}

// Simple in-memory rate limiter, per key (usually IP + route).
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600000)) hits.delete(k); }, 600000).unref();

module.exports = { parseCookies, readJson, send, sendJson, sendHtml, serveStatic, rateLimited };
