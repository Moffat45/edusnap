// AI tutor.
//  - With ANTHROPIC_API_KEY set: every subject is answered by the Claude API (and photos can be read).
//  - Without a key: the built-in maths engine answers arithmetic, linear and quadratic equations.
//    Anything else is saved and shown as waiting (the owner can answer it with: npm run admin -- answer <id> <text>).

const engine = require('./engine');

const SYSTEM = [
  'You are EduSnap, a friendly homework tutor for South African high school learners in Grades 8 to 12.',
  'Follow the South African CAPS curriculum for the learner\'s grade and subject.',
  'Explain step by step in simple, clear language so the learner understands the method, not only the final answer.',
  'Keep the answer short enough to read on a phone. Use plain text only: no markdown symbols, no tables.',
  'Write maths in plain text, for example x = 4 or 2x + 6 = 14.',
  'Reply in the language the learner chooses, and write it correctly and naturally. If the subject is not one you know well, still help using the CAPS curriculum.',
  'If a photo is attached, read the question from it first and say what you read.',
  'If the message is not a school question, politely say you can only help with school work.',
].join(' ');

const userText = ({ question, subject, grade, language }) =>
  `Subject: ${subject}\nGrade: ${grade}\nAnswer language: ${language}\n\nQuestion: ${question}`;

async function post(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('AI service returned status ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Provider 1: Anthropic Claude (paid).
async function askClaude(input) {
  const { image } = input;
  const url = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.type, data: image.data } });
  content.push({ type: 'text', text: userText(input) });
  const data = await post(url, { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    { model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 1024, system: SYSTEM, messages: [{ role: 'user', content }] });
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// Provider 2: Google Gemini (has a free tier, reads photos, handles many languages).
async function askGemini(input) {
  const { image } = input;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const parts = [];
  if (image) parts.push({ inline_data: { mime_type: image.type, data: image.data } });
  parts.push({ text: userText(input) });
  const data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    { system_instruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: 1500 } });
  const cand = (data.candidates || [])[0];
  return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('\n').trim();
}

// Provider 3: any OpenAI-compatible service (Groq, OpenRouter, ... both have free tiers).
// Set OPENAI_COMPAT_URL, OPENAI_COMPAT_KEY and OPENAI_COMPAT_MODEL. Photos only work if that model accepts images.
async function askCompat(input) {
  const { image } = input;
  const content = [];
  if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.type};base64,${image.data}` } });
  content.push({ type: 'text', text: userText(input) });
  const data = await post(process.env.OPENAI_COMPAT_URL, { authorization: 'Bearer ' + process.env.OPENAI_COMPAT_KEY },
    { model: process.env.OPENAI_COMPAT_MODEL, max_tokens: 1200, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }] });
  return (((data.choices || [])[0] || {}).message || {}).content?.trim() || '';
}

// Providers are tried in this order; if one fails (rate limit, outage) the next one is tried.
function providers() {
  const list = [];
  if (process.env.GEMINI_API_KEY) list.push({ name: 'Gemini', ask: askGemini });
  if (process.env.OPENAI_COMPAT_URL && process.env.OPENAI_COMPAT_KEY && process.env.OPENAI_COMPAT_MODEL) list.push({ name: 'OpenAI-compatible', ask: askCompat });
  if (process.env.ANTHROPIC_API_KEY) list.push({ name: 'Claude', ask: askClaude });
  return list;
}

// 'claude' is kept as the name for "a full AI engine is on" so the rest of the site does not change.
const mode = () => (providers().length ? 'claude' : 'local');
const providerNames = () => providers().map((p) => p.name).join(', ');

async function askAI(input) {
  let lastErr;
  for (const p of providers()) {
    try {
      const text = await p.ask(input);
      if (text) return text;
      lastErr = new Error(p.name + ' returned no text');
    } catch (err) {
      console.error(`AI provider ${p.name} failed:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('No AI provider configured');
}

// Returns the answer text, or null when the built-in engine cannot solve the question.
async function answer(input) {
  if (mode() === 'claude') return askAI(input);
  if (input.image) return null;
  const solved = engine.solve(input.question);
  if (!solved) return null;
  return input.language === 'English' ? solved : `(The built-in maths engine answers in English. Full ${input.language} answers need the AI key.)\n\n${solved}`;
}

module.exports = { answer, mode, providerNames };
