// Built-in maths engine: solves arithmetic, linear equations and quadratic equations with worked steps.
// It runs on the server with no outside service, so the site can answer maths questions without an AI key.

function tokenize(src) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?|x|[-+*/^()=])/gy;
  let m, last = 0;
  while ((m = re.exec(src)) !== null) { tokens.push(m[1]); last = re.lastIndex; }
  if (src.slice(last).trim() !== '') return null;
  return tokens;
}

// Recursive descent parser. Returns a function of x.
function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const isStart = (t) => t !== undefined && (t === 'x' || t === '(');
  function expr() {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[i++], right = term(), l = left;
      left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t === '*' || t === '/') {
        i++;
        const right = unary(), l = left;
        left = t === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
      } else if (isStart(t)) {
        const right = unary(), l = left;
        left = (x) => l(x) * right(x);
      } else return left;
    }
  }
  function unary() {
    if (peek() === '-') { i++; const f = unary(); return (x) => -f(x); }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === '^') { i++; const e = unary(); return (x) => Math.pow(base(x), e(x)); }
    return base;
  }
  function atom() {
    const t = tokens[i++];
    if (t === undefined) throw new Error('end');
    if (t === 'x') return (x) => x;
    if (t === '(') { const f = expr(); if (tokens[i++] !== ')') throw new Error('paren'); return f; }
    if (/^\d/.test(t)) return () => Number(t);
    throw new Error('bad token ' + t);
  }
  const f = expr();
  if (i !== tokens.length) throw new Error('extra');
  return f;
}

const fmt = (n) => {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? '0' : String(r);
};
const sign = (n) => (n < 0 ? '- ' + fmt(-n) : '+ ' + fmt(n));
const close = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

function findMaths(question) {
  const q = question.toLowerCase()
    .replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3');
  const found = q.match(/[0-9x(][0-9x+\-*/^().=\s]*/g) || [];
  const candidates = found
    .map((c) => c.trim().replace(/[\s.=+\-*/^]+$/, ''))
    .filter((c) => /\d|x/.test(c) && /[+\-*/^=]/.test(c))
    .map((c) => c.replace(/\s+/g, ' '));
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.includes('=') - a.includes('=')) || (b.length - a.length));
  return candidates[0];
}

function solve(question) {
  let text = findMaths(question);
  if (!text) return null;
  // The trailing "=" was trimmed above; restore it when the question ends with "= ?" style input.
  const eq = text.split('=');
  if (eq.length > 2) return null;
  let L, R = null;
  try {
    const l = tokenize(eq[0]);
    if (!l) return null;
    L = parse(l);
    if (eq.length === 2) {
      const r = tokenize(eq[1]);
      if (!r || !r.length) return null;
      R = parse(r);
    }
  } catch (e) { return null; }

  const shown = text.replace(/\s*([+\-*/^=])\s*/g, ' $1 ');
  const intro = `I read your question as: ${shown}\n\n`;

  if (!R) {
    if (/x/.test(text)) return null;
    const v = L(0);
    if (!Number.isFinite(v)) return intro + 'This one is undefined, because it divides by zero.';
    return intro + `Work it out in the right order (brackets, powers, multiplication and division, then addition and subtraction).\n\nAnswer: ${fmt(v)}`;
  }

  const g = (x) => L(x) - R(x);
  const [g0, g1, gm, g2, g3] = [g(0), g(1), g(-1), g(2), g(3)];
  if (![g0, g1, gm, g2, g3].every(Number.isFinite)) return null;
  const a2 = (g1 + gm - 2 * g0) / 2, a1 = (g1 - gm) / 2, a0 = g0;
  if (!close(g2, 4 * a2 + 2 * a1 + a0) || !close(g3, 9 * a2 + 3 * a1 + a0)) return null;
  const tiny = (n) => Math.abs(n) < 1e-9;

  if (tiny(a2)) {
    if (tiny(a1)) return intro + (tiny(a0) ? 'Both sides are always equal, so every value of x works.' : 'The x terms cancel and the two sides are never equal, so there is no solution.');
    const x = -a0 / a1;
    return intro +
      `Step 1: Collect the x terms and the numbers on one side. The equation becomes ${close(a1, 1) ? '' : fmt(a1)}x ${sign(a0)} = 0, so ${close(a1, 1) ? '' : fmt(a1)}x = ${fmt(-a0)}.\n` +
      (close(a1, 1) ? `Step 2: The x already stands alone, so x = ${fmt(x)}.\n` : `Step 2: Divide both sides by ${fmt(a1)}: x = ${fmt(-a0)} / ${fmt(a1)} = ${fmt(x)}.\n`) +
      `Step 3: Check by putting x = ${fmt(x)} back in. The left side is ${fmt(L(x))} and the right side is ${fmt(R(x))}, so it works.\n\nAnswer: x = ${fmt(x)}`;
  }

  const disc = a1 * a1 - 4 * a2 * a0;
  let out = intro +
    `Step 1: Move everything to one side to get the standard form ax^2 + bx + c = 0: ${close(a2, 1) ? '' : fmt(a2)}x^2 ${sign(a1)}x ${sign(a0)} = 0. So a = ${fmt(a2)}, b = ${fmt(a1)} and c = ${fmt(a0)}.\n` +
    `Step 2: Work out the discriminant: b^2 - 4ac = ${fmt(disc)}.\n`;
  if (disc < -1e-9) return out + 'Step 3: The discriminant is negative, so there are no real solutions.\n\nAnswer: no real solutions';
  const root = Math.sqrt(Math.max(disc, 0));
  const x1 = (-a1 + root) / (2 * a2), x2 = (-a1 - root) / (2 * a2);
  out += `Step 3: Use the quadratic formula x = (-b ± √discriminant) / 2a = (${fmt(-a1)} ± ${fmt(root)}) / ${fmt(2 * a2)}.\n`;
  if (tiny(disc)) return out + `Step 4: The discriminant is zero, so there is one repeated solution.\n\nAnswer: x = ${fmt(x1)}`;
  const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1];
  return out + `Step 4: The two solutions are x = ${fmt(lo)} and x = ${fmt(hi)}.\n\nAnswer: x = ${fmt(lo)} or x = ${fmt(hi)}`;
}

module.exports = { solve };
