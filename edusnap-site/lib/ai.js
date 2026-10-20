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
  'Reply in the language the learner asks for (English, Afrikaans or Zulu).',
  'If a photo is attached, read the question from it first and say what you read.',
  'If the message is not a school question, politely say you can only help with school work.',
].join(' ');

const mode = () => (process.env.ANTHROPIC_API_KEY ? 'claude' : 'local');

async function askClaude({ question, subject, grade, language, image }) {
  const url = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.type, data: image.data } });
  content.push({ type: 'text', text: `Subject: ${subject}\nGrade: ${grade}\nAnswer language: ${language}\n\nQuestion: ${question}` });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 1024, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) throw new Error('AI service returned status ' + res.status);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error('AI service returned no text');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// Returns the answer text, or null when the built-in engine cannot solve the question.
async function answer(input) {
  if (mode() === 'claude') return askClaude(input);
  if (input.image) return null;
  const solved = engine.solve(input.question);
  if (!solved) return null;
  return input.language === 'English' ? solved : `(The built-in maths engine answers in English. Full ${input.language} answers need the AI key.)\n\n${solved}`;
}

module.exports = { answer, mode };
