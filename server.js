// EduSnap web server. No outside dependencies: Node's built-in http, sqlite and crypto only.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { db, sastDay } = require('./lib/db');
const { FREE_PER_DAY, PAID_PER_MONTH } = require('./lib/model');
const ai = require('./lib/ai');
const payments = require('./lib/payments');
const { parseCookies, readJson, send, sendJson, sendHtml, serveStatic, rateLimited } = require('./lib/http');
const views = require('./lib/views');

const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT) || 3000;
const COOKIE = 'edusnap_sid';
const SESSION_DAYS = 30;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PLANS = ['free', 'snap', 'family'];
const SUBJECTS = views.SUBJECTS;
const LANGUAGES = views.LANGUAGES;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ---------- passwords and sessions ----------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function checkPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}
const DUMMY_HASH = '00000000000000000000000000000000:' + '00'.repeat(64);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isSecure = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);

function cookieHeader(req, value, maxAgeSeconds) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}` + (isSecure(req) ? '; Secure' : '');
}

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return cookieHeader(req, token, SESSION_DAYS * 86400);
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const user = db.prepare(`SELECT u.id, u.name, u.email, u.grade, u.plan, u.plan_until FROM sessions s JOIN users u ON u.id = s.user_id
                           WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now());
  if (!user) return null;
  // A paid plan that has run out behaves like the Free plan until it is renewed.
  user.planExpired = user.plan !== 'free' && (!user.plan_until || user.plan_until < new Date().toISOString());
  if (user.planExpired) user.plan = 'free';
  return user;
}

function clientIp(req) {
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : req.socket.remoteAddress;
}

// ---------- usage and limits ----------
function usageFor(user) {
  const day = sastDay();
  const count = (like, value) => db.prepare(`SELECT COUNT(*) AS c FROM questions WHERE user_id = ? AND ${like} AND status = 'answered'`).get(user.id, value).c;
  const today = count('day = ?', day);
  const month = count('substr(day, 1, 7) = ?', day.slice(0, 7));
  return user.plan === 'free'
    ? { used: today, limit: FREE_PER_DAY, period: 'today' }
    : { used: month, limit: PAID_PER_MONTH, period: 'this month' };
}

// ---------- validation ----------
const bad = (message, status = 400) => Object.assign(new Error(message), { status, expose: true });
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- API handlers ----------
const api = {
  async register(req, res) {
    if (rateLimited('register:' + clientIp(req), 10, 600000)) throw bad('Too many attempts. Please try again later.', 429);
    const b = await readJson(req);
    const name = clean(b.name, 80);
    const email = clean(b.email, 254).toLowerCase();
    const grade = Number(b.grade);
    const password = String(b.password ?? '');
    if (name.length < 2) throw bad('Please enter your name.');
    if (!validEmail(email)) throw bad('Please enter a valid email address.');
    if (!Number.isInteger(grade) || grade < 8 || grade > 12) throw bad('Please choose your grade (8 to 12).');
    if (password.length < 8 || password.length > 128) throw bad('Your password must be at least 8 characters.');
    if (b.consent !== true) throw bad('Please confirm the consent box to register.');
    const planWanted = ['snap', 'family'].includes(b.plan) ? b.plan : 'free';
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw bad('An account with this email already exists. Try logging in.', 409);
    const info = db.prepare('INSERT INTO users (name, email, grade, password_hash) VALUES (?, ?, ?, ?)').run(name, email, grade, await hashPassword(password));
    const cookie = startSession(req, res, Number(info.lastInsertRowid));
    const to = planWanted === 'free' ? '/dashboard' : '/checkout?plan=' + planWanted;
    send(res, 200, JSON.stringify({ ok: true, redirect: to }), { 'content-type': 'application/json', 'set-cookie': cookie, 'cache-control': 'no-store' });
  },

  async login(req, res) {
    if (rateLimited('login:' + clientIp(req), 10, 600000)) throw bad('Too many attempts. Please try again later.', 429);
    const b = await readJson(req);
    const email = clean(b.email, 254).toLowerCase();
    const password = String(b.password ?? '').slice(0, 128);
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    const ok = await checkPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw bad('Email or password is incorrect.', 401);
    const cookie = startSession(req, res, user.id);
    send(res, 200, JSON.stringify({ ok: true, redirect: '/dashboard' }), { 'content-type': 'application/json', 'set-cookie': cookie, 'cache-control': 'no-store' });
  },

  async logout(req, res) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    send(res, 200, JSON.stringify({ ok: true, redirect: '/' }), { 'content-type': 'application/json', 'set-cookie': cookieHeader(req, '', 0) });
  },

  async ask(req, res, user) {
    if (rateLimited('ask:' + user.id, 20, 60000)) throw bad('Please slow down a little and try again in a minute.', 429);
    const b = await readJson(req, 8 * 1024 * 1024);
    const question = clean(b.question, 2000);
    const subject = String(b.subject ?? '');
    const language = String(b.language ?? 'English');
    const grade = Number(b.grade);
    if (question.length < 3) throw bad('Please type your question.');
    if (!SUBJECTS.includes(subject)) throw bad('Please choose a subject.');
    if (!LANGUAGES.includes(language)) throw bad('Please choose a language.');
    if (!Number.isInteger(grade) || grade < 8 || grade > 12) throw bad('Please choose your grade (8 to 12).');

    let image = null;
    if (b.image) {
      if (user.plan === 'free') throw bad('Photo questions are on the Snap & Learn and Family plans.', 403);
      if (!IMAGE_TYPES.includes(b.image.type) || typeof b.image.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.image.data)) throw bad('Please upload a JPG, PNG, WebP or GIF photo.');
      if (b.image.data.length > 5.4 * 1024 * 1024) throw bad('That photo is too large. Please use one under 4 MB.', 413);
      image = { type: b.image.type, data: b.image.data };
    }

    const usage = usageFor(user);
    if (usage.used >= usage.limit) {
      throw bad(user.plan === 'free'
        ? `You have used your ${FREE_PER_DAY} free questions today. They reset at midnight, or you can unlock a paid plan.`
        : `You have used your ${PAID_PER_MONTH} questions this month.`, 429);
    }

    const pendingCount = db.prepare(`SELECT COUNT(*) AS c FROM questions WHERE user_id = ? AND status = 'queued'`).get(user.id).c;
    if (pendingCount >= 10) throw bad('You already have 10 questions waiting for an answer. Please wait for those first.', 429);

    // Reserve the question first so two quick requests cannot both slip under the limit.
    // (Only answered questions count towards the limit, so a question that waits does not use one up.)
    const info = db.prepare(`INSERT INTO questions (user_id, subject, grade, language, question, has_photo, status, day) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`)
      .run(user.id, subject, grade, language, question, image ? 1 : 0, sastDay());
    const id = Number(info.lastInsertRowid);

    const waiting = (message) => sendJson(res, 200, { ok: true, status: 'queued', id, message });
    if (ai.mode() === 'local' && image) {
      return waiting('Your photo question is saved. Reading photos needs the full AI engine, which is not switched on yet, so it will wait on your dashboard.');
    }
    try {
      const answer = await ai.answer({ question, subject, grade, language, image });
      if (answer === null) {
        return waiting('Your question is saved. The built-in engine solves maths equations; for this one the full AI engine is needed, so it will wait on your dashboard.');
      }
      db.prepare(`UPDATE questions SET answer = ?, status = 'answered' WHERE id = ?`).run(answer, id);
      sendJson(res, 200, { ok: true, status: 'answered', id, answer });
    } catch (err) {
      console.error('AI error:', err.message);
      db.prepare(`UPDATE questions SET status = 'failed' WHERE id = ?`).run(id);
      throw bad('We could not get an answer just now. Your question was not counted. Please try again.', 502);
    }
  },

  async pay(req, res, user) {
    if (rateLimited('pay:' + user.id, 8, 600000)) throw bad('Too many payment attempts. Please try again in a few minutes.', 429);
    const b = await readJson(req);
    const plan = payments.PLANS[b.plan];
    if (!plan) throw bad('Please choose a plan.');
    const result = payments.charge({ plan: b.plan, name: clean(b.name, 80), number: String(b.number ?? '').slice(0, 30), expiry: String(b.expiry ?? '').slice(0, 10), cvc: String(b.cvc ?? '').slice(0, 5) });
    if (!result.ok) throw bad(result.error, 402);
    const now = Date.now();
    const renewing = user.plan === b.plan && user.plan_until ? Date.parse(user.plan_until) : 0;
    const until = new Date(Math.max(now, renewing) + 30 * 86400000).toISOString();
    db.prepare('UPDATE users SET plan = ?, plan_until = ? WHERE id = ?').run(b.plan, until, user.id);
    db.prepare(`INSERT INTO payments (user_id, plan, amount, brand, last4, reference, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')`)
      .run(user.id, b.plan, result.amount, result.brand, result.last4, result.reference);
    sendJson(res, 200, { ok: true, redirect: '/dashboard?paid=' + b.plan });
  },

  async contact(req, res, user) {
    if (rateLimited('contact:' + clientIp(req), 5, 600000)) throw bad('Too many messages. Please try again later.', 429);
    const b = await readJson(req);
    const name = clean(b.name, 80);
    const email = clean(b.email, 254).toLowerCase();
    const grade = clean(b.grade, 20);
    const message = clean(b.message, 2000);
    if (name.length < 2) throw bad('Please enter your name.');
    if (email && !validEmail(email)) throw bad('That email address does not look right.');
    if (message.length < 3) throw bad('Please type your question.');
    db.prepare('INSERT INTO messages (name, email, grade, message) VALUES (?, ?, ?, ?)').run(name, email || (user ? user.email : ''), grade, message);
    sendJson(res, 200, { ok: true, message: 'Thank you. Your message has been received.' });
  },
};

const apiRoutes = {
  'POST /api/register': { fn: api.register },
  'POST /api/login': { fn: api.login },
  'POST /api/logout': { fn: api.logout },
  'POST /api/ask': { fn: api.ask, auth: true },
  'POST /api/pay': { fn: api.pay, auth: true },
  'POST /api/contact': { fn: api.contact },
};

// ---------- pages ----------
const redirect = (res, to) => send(res, 302, '', { location: to });
const pages = {
  '/': (u) => views.home(u),
  '/about': (u) => views.about(u),
  '/plans': (u) => views.plans(u),
  '/revenue': (u) => views.revenue(u),
  '/contact': (u) => views.contact(u),
  '/privacy': (u) => views.privacy(u),
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (isSecure(req)) res.setHeader('strict-transport-security', 'max-age=15552000');
  const url = new URL(req.url, 'http://localhost');
  const route = `${req.method} ${url.pathname}`;
  try {
    if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });

    if (url.pathname.startsWith('/api/')) {
      const entry = apiRoutes[route];
      if (!entry) return sendJson(res, 404, { error: 'Not found' });
      const user = currentUser(req);
      if (entry.auth && !user) return sendJson(res, 401, { error: 'Please log in first.', redirect: '/login' });
      return await entry.fn(req, res, user);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(PUBLIC_DIR, url.pathname, res)) return;
      const user = currentUser(req);
      if (pages[url.pathname]) return sendHtml(res, 200, pages[url.pathname](user));
      if (url.pathname === '/persona') {
        // The customer persona is a marketing page for visitors; logged-in users go to their dashboard.
        return user ? redirect(res, '/dashboard') : sendHtml(res, 200, views.persona(null));
      }
      if (url.pathname === '/checkout') {
        if (!user) return redirect(res, '/login');
        const plan = url.searchParams.get('plan');
        if (!payments.PLANS[plan]) return redirect(res, '/dashboard');
        return sendHtml(res, 200, views.checkout(user, plan));
      }
      if (url.pathname === '/register' || url.pathname === '/login') {
        if (user) return redirect(res, '/dashboard');
        return sendHtml(res, 200, url.pathname === '/register' ? views.register(null, url.searchParams.get('plan')) : views.login(null));
      }
      if (url.pathname === '/dashboard') {
        if (!user) return redirect(res, '/login');
        const history = db.prepare('SELECT id, subject, grade, language, question, has_photo, answer, status, created_at FROM questions WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(user.id);
        const paid = db.prepare('SELECT plan, amount, brand, last4, reference, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(user.id);
        const flash = payments.PLANS[url.searchParams.get('paid')] ? url.searchParams.get('paid') : '';
        return sendHtml(res, 200, views.dashboard(user, usageFor(user), history, paid, ai.mode(), flash));
      }
    }
    sendHtml(res, 404, views.notFound(currentUser(req)));
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    const message = err.expose || status < 500 ? err.message : 'Something went wrong on our side. Please try again.';
    if (url.pathname.startsWith('/api/')) return sendJson(res, status, { error: message });
    sendHtml(res, status, views.notFound(null, message));
  }
});

// Remove expired sessions every hour.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600000).unref();

server.listen(PORT, () => {
  console.log(`EduSnap running on port ${PORT}. AI: ${ai.mode() === 'claude' ? ai.providerNames() : 'built-in maths engine (no AI key set)'}. Payments: ${payments.mode()} mode`);
});
