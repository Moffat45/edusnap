// Page templates. Server-rendered HTML; every piece of user text goes through esc().

const M = require('./model');

const SUBJECTS = ['Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences', 'Accounting', 'Business Studies', 'Economics', 'Geography', 'History', 'Information Technology', 'Computer Applications Technology', 'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana', 'Life Orientation', 'Other subject'];
const LANGUAGES = ['English', 'Afrikaans', 'Zulu', 'Xhosa', 'Sesotho', 'Setswana', 'Sepedi', 'Xitsonga', 'Tshivenda', 'siSwati', 'isiNdebele'];
const PLAN_NAMES = { free: 'Free', snap: 'Snap & Learn', family: 'Family' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (n) => 'R' + Math.round(n).toLocaleString('en-US');
const num = (n) => Math.round(n).toLocaleString('en-US');

const NAV = [['/', 'Home'], ['/about', 'About'], ['/persona', 'Customer Persona'], ['/plans', 'Products &amp; Services'], ['/revenue', 'Revenue Model'], ['/contact', 'Contact']];
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230B3C49'/%3E%3Ctext x='16' y='23' font-size='20' font-family='Georgia' font-weight='bold' text-anchor='middle' fill='%23F2A900'%3EE%3C/text%3E%3C/svg%3E";

function layout({ title, user, path = '', body, scripts = [], description }) {
  const items = NAV.filter(([href]) => !(user && href === '/persona'));
  const nav = items.map(([href, label]) => `<a href="${href}"${path === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const auth = user
    ? `<a class="btn btn--small" href="/dashboard">Dashboard</a><button class="btn btn--ghost btn--small" id="logout" type="button">Log out</button>`
    : `<a class="nav-login" href="/login">Log in</a><a class="btn btn--gold btn--small" href="/register">Register</a>`;
  const email = process.env.CONTACT_EMAIL;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | EduSnap</title>
<meta name="description" content="${esc(description || 'EduSnap: snap a question, get an answer. AI homework help for South African high school learners, Grades 8 to 12.')}">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-row">
    <a class="brand" href="/" aria-label="EduSnap home"><span class="brand-mark">E</span>EduSnap</a>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">${nav}<div class="nav-auth">${auth}</div></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <p class="footer-brand">EduSnap</p>
      <p>Snap a question. Get an answer.</p>
      <p class="footer-small">Digital Entrepreneurship for Sustainable Community Development &nbsp;|&nbsp; JGA 2026</p>
    </div>
    <div>
      <p class="footer-head">Pages</p>
      ${items.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
      <a href="/privacy">Privacy</a>
    </div>
    <div>
      <p class="footer-head">Project documents</p>
      <a href="/downloads/EduSnap_Presentation.pptx">Presentation (PowerPoint)</a>
      <a href="/downloads/EduSnap_Report.docx">Report (Word)</a>
      <a href="/downloads/EduSnap_Revenue_Model.xlsx">Revenue model (Excel)</a>
      <a href="/downloads/EduSnap.java">Java prototype</a>
      ${email ? `<p class="footer-head footer-gap">Email</p><a href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
    </div>
  </div>
</footer>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
<script src="/js/app.js" defer></script>
</body>
</html>`;
}

// ---------- small building blocks ----------
const numCircle = (n, gold) => `<span class="num${gold ? ' num--gold' : ''}" aria-hidden="true">${n}</span>`;
const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;
const section = (inner, cls = '') => `<section class="section ${cls}"><div class="container">${inner}</div></section>`;
const head = (eyebrow, h, lead) => `<div class="section-head">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h2>${h}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;
const pageTitle = (eyebrow, h, lead) => `<section class="page-title"><div class="container">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${h}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div></section>`;

// ---------- charts (server-rendered SVG, no scripts needed) ----------
function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function barChart({ labels, series, axisFmt, valueLabels, label }) {
  const W = 640, H = series.length > 1 ? 372 : 340, m = { l: 62, r: 12, t: 20, b: series.length > 1 ? 70 : 42 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxV = Math.max(...series.flatMap((s) => s.values));
  const step = niceStep(maxV / 5);
  const top = Math.ceil(maxV / step) * step;
  const y = (v) => m.t + ih - (v / top) * ih;
  const gw = iw / labels.length, bw = (gw * 0.72) / series.length;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  for (let v = 0; v <= top + 1e-9; v += step) {
    out += `<line class="ch-grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ch-axis" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${axisFmt(v)}</text>`;
  }
  labels.forEach((lab, i) => {
    const gx = m.l + i * gw + (gw - bw * series.length) / 2;
    series.forEach((s, j) => {
      const v = s.values[i], x = gx + j * bw;
      out += `<rect class="ch-bar" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(m.t + ih - y(v)).toFixed(1)}" fill="${s.color}"><title>${esc(lab)}: ${esc(s.name)} ${esc(s.fmt(v))}</title></rect>`;
      if (valueLabels) out += `<text class="ch-val" x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" text-anchor="middle">${num(v)}</text>`;
    });
    out += `<text class="ch-axis" x="${(m.l + i * gw + gw / 2).toFixed(1)}" y="${m.t + ih + 20}" text-anchor="middle">${esc(lab)}</text>`;
  });
  if (series.length > 1) {
    let lx = m.l + 40;
    series.forEach((s) => {
      out += `<rect x="${lx}" y="${H - 22}" width="12" height="12" fill="${s.color}"/><text class="ch-axis" x="${lx + 18}" y="${H - 12}">${esc(s.name)}</text>`;
      lx += 190;
    });
  }
  return out + '</svg>';
}

// ---------- pages ----------
function home(user) {
  const problems = [
    ['1', 'No help after school', 'Learners get home to homework and nobody to ask. Parents work late and many cannot help with the CAPS curriculum.'],
    ['2', 'Tutors cost too much', 'Private tutors charge R150 to R300 per hour, out of reach for many families in communities like Soshanguve.'],
    ['3', 'Data is expensive', 'Video lessons drain prepaid data, so learners cannot rely on YouTube to catch up.'],
  ];
  const pitch = [
    ['Problem', 'Learners in Grades 8 to 12 struggle with homework after school. Tutors are expensive and parents are at work.'],
    ['Solution', 'EduSnap: type or snap a photo of a homework question and an AI chatbot explains it step by step.'],
    ['Who it is for', 'Grade 8 to 12 learners in township and urban schools, on phones with limited data.'],
    ['How AI helps', 'Reads handwritten maths, explains in simple English, Afrikaans or Zulu, and answers 24/7 for far less than a tutor.'],
  ];
  const steps = [
    ['Snap', 'Take a photo of the question or type it in. Works with handwritten maths.'],
    ['Understand', 'AI reads the question and matches it to the CAPS-aligned curriculum for the learner\'s grade.'],
    ['Learn', 'Get a step-by-step explanation in simple English, Afrikaans or Zulu, available 24/7.'],
  ];
  const cases = [
    ['Socratic by Google', 'Photo-based homework solver', 'Free to use', 'Not CAPS-aligned', 'https://socratic.org', 'socratic.org'],
    ['Photomath', 'Step-by-step maths solutions', 'Clear steps from a photo', 'Maths only; paid tier', 'https://photomath.com', 'photomath.com'],
    ['Quizlet', 'Flashcards and study sets', 'Large community content', 'No photo snap of a question', 'https://quizlet.com', 'quizlet.com'],
    ['Chegg', 'US homework help', 'Expert answers', 'Not the South African curriculum', 'https://www.chegg.com', 'chegg.com'],
  ];
  const body = `
<section class="hero">
  <div class="container hero-grid">
    <div>
      <h1>EduSnap</h1>
      <p class="tagline">Snap a question. Get an answer.</p>
      <p class="hero-text">AI homework help for South African high school learners, Grades 8 to 12</p>
      <div class="hero-actions">
        ${user ? '<a class="btn btn--gold" href="/dashboard">Go to your dashboard</a>' : '<a class="btn btn--gold" href="/register">Create a free account</a>'}
        <a class="btn btn--light" href="/plans">View plans</a>
      </div>
    </div>
    <div class="phone" role="img" aria-label="Illustration: a homework question and a step-by-step answer">
      <div class="bubble bubble--q">Photo of homework: solve 2x + 6 = 14</div>
      <div class="bubble bubble--a">Step 1: subtract 6 from both sides.<br>Step 2: divide by 2.<br>x = 4</div>
      <span class="phone-cap">Illustration</span>
    </div>
  </div>
</section>

${section(`${head('', 'The problem')}
<div class="grid grid-3">${problems.map((p) => card(`${numCircle(p[0])}<h3>${p[1]}</h3><p>${p[2]}</p>`)).join('')}</div>
<p class="takeaway">The result: learners fall behind, and poor matric results follow.</p>`)}

${section(`${head('', 'Our 2-minute pitch')}
<div class="grid grid-4">${pitch.map((p, i) => card(`${numCircle(i + 1, i === 3)}<h3>${p[0]}</h3><p>${p[1]}</p>`, i === 3 ? 'card--dark' : '')).join('')}</div>
<p class="takeaway">Business model: free for 5 questions a day, then R49 per month.</p>`, 'section--tint')}

${section(`${head('', 'How EduSnap works')}
<div class="steps">${steps.map((s, i) => `<div class="step">${numCircle(i + 1, i === 1).replace('class="num', 'class="num num--big')}<h3>${s[0]}</h3><p>${s[1]}</p></div>${i < 2 ? '<span class="step-arrow" aria-hidden="true">&rarr;</span>' : ''}`).join('')}</div>
<div class="banner">Low-data mode keeps it usable on prepaid data of about R30 a week.</div>`)}

${section(`${head('', 'Competitor case studies')}
<div class="table-wrap"><table class="table">
<thead><tr><th>Product</th><th>What it does</th><th>Strength</th><th>Gap EduSnap fills</th><th>Source</th></tr></thead>
<tbody>${cases.map((c) => `<tr><th scope="row">${c[0]}</th><td>${c[1]}</td><td>${c[2]}</td><td>${c[3]}</td><td><a href="${c[4]}" target="_blank" rel="noopener noreferrer">${c[5]}</a></td></tr>`).join('')}</tbody>
</table></div>
<p class="takeaway">EduSnap combines photo snap, CAPS alignment, local languages and low-data use at R49 a month.</p>`, 'section--tint')}

<section class="cta">
  <div class="container">
    <h2>Snap a question, get an answer.</h2>
    ${user ? '<a class="btn btn--gold" href="/dashboard">Ask a question</a>' : '<a class="btn btn--gold" href="/register">Create a free account</a>'}
  </div>
</section>`;
  return layout({ title: 'Snap a question, get an answer', user, path: '/', body });
}

function about(user) {
  const recs = [
    ['AI chatbot', 'Answer learner and parent questions instantly, around the clock.'],
    ['No-code workflow', 'Automate sign-up confirmations and SMS progress reports to parents.'],
    ['Payment gateway', 'Let South African users pay R49 or R89 by card or EFT.'],
  ];
  const body = `${pageTitle('About', 'About EduSnap')}
${section(`<div class="two-col">
  <div>
    <h2>What problem we solve</h2>
    <p>In Soshanguve and many South African communities, learners have no access to after-school tutoring. Private tutors cost R150 to R300 per hour. Many parents cannot help with the CAPS curriculum. This leads to poor matric pass rates.</p>
    <p>EduSnap solves this by providing affordable, instant, CAPS-aligned help on their phone.</p>
  </div>
  <div>
    <h2>Who we solve it for</h2>
    <p>High school learners (Grade 8 to 12) with smartphones and limited data.</p>
  </div>
</div>`)}
${section(`${head('', 'Where EduSnap goes next')}
<div class="grid grid-3">${recs.map((r, i) => card(`${numCircle(i + 1)}<h3>${r[0]}</h3><p>${r[1]}</p>`)).join('')}</div>
<div class="banner banner--dark"><h3>Innovation and job creation</h3><p>Partner with schools for marketing, and offer free hosting credits and mentorship so more students can launch low-cost education start-ups.</p></div>`, 'section--tint')}`;
  return layout({ title: 'About', user, path: '/about', body });
}

function persona(user) {
  const items = [
    ['Goals', 'Pass Maths and Physical Science, get into university, help his younger sister.'],
    ['Frustrations', 'No internet at home, parents work until 6pm, tutors are too expensive, YouTube uses too much data.'],
    ['Behaviours', 'Uses WhatsApp, photographs his homework, studies 7 to 9pm on R30 a week of prepaid data.'],
    ['Why EduSnap', 'Step-by-step explanations, low-data mode and a cheap monthly plan.'],
  ];
  const body = `${pageTitle('Customer persona', 'Meet Thabo, our customer')}
${section(`<div class="persona">
  <div class="card card--dark persona-profile">
    <span class="avatar" aria-hidden="true">T</span>
    <h3>Thabo, 16</h3>
    <p>Grade 10<br>Soshanguve High School</p>
    <blockquote>&ldquo;I want to understand, not just copy the answer.&rdquo;</blockquote>
  </div>
  <div class="grid grid-2">${items.map((it, i) => card(`<h3>${it[0]}</h3><p>${it[1]}</p>`, i === 3 ? 'card--teal' : '')).join('')}</div>
</div>`)}`;
  return layout({ title: 'Customer Persona', user, path: '/persona', body });
}

const PLAN_LIST = [
  { key: 'free', name: 'Free', price: 'R0', features: ['5 questions per day', 'Text questions only', 'Basic explanations'] },
  { key: 'snap', name: 'Snap & Learn', price: 'R49 / month', featured: true, features: ['100 questions per month', 'Photo snap (handwritten maths)', 'Step-by-step + video explanation', 'CAPS-aligned, Grade 8 to 12', 'Low-data mode'] },
  { key: 'family', name: 'Family', price: 'R89 / month', features: ['Everything in Snap & Learn', '3 learner profiles', 'Parent progress report via SMS', 'Past exam papers'] },
];

function plans(user) {
  const cta = (p) => {
    if (p.key === 'free') return user ? '<a class="btn btn--ghost-dark" href="/dashboard">Open dashboard</a>' : '<a class="btn btn--ghost-dark" href="/register">Start free</a>';
    if (user && user.plan === p.key) return '<span class="badge badge--on">Your current plan</span>';
    const cls = p.featured ? 'btn btn--gold' : 'btn';
    return `<span class="lock">Locked: requires payment</span><a class="${cls}" href="${user ? '/checkout?plan=' + p.key : '/register?plan=' + p.key}">Unlock for ${p.price.replace(' / month', '')} a month</a>`;
  };
  const body = `${pageTitle('Products &amp; Services', 'Three plans, one free')}
${section(`<div class="plans">${PLAN_LIST.map((p) => `<div class="plan${p.featured ? ' plan--featured' : ''}">
  ${p.featured ? '<span class="badge">Most popular</span>' : ''}
  <h3>${esc(p.name)}</h3><p class="price">${p.price}</p>
  <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
  ${cta(p)}
</div>`).join('')}</div>
<p class="plan-note">The Free plan needs no payment. Paid plans are locked until you pay, and each payment covers 30 days.</p>`)}`;
  return layout({ title: 'Products & Services', user, path: '/plans', body });
}

function revenue(user) {
  const money = (v) => rand(v);
  const axisMoney = (v) => (v >= 1000 ? 'R' + v / 1000 + 'k' : 'R' + v);
  const labels = M.rows.map((r) => r.month);
  const subsChart = barChart({ labels, series: [{ name: 'Subscribers', values: M.rows.map((r) => r.subs), color: '#1B7F79', fmt: num }], axisFmt: num, valueLabels: true, label: 'Paying subscribers by month' });
  const moneyChart = barChart({ labels, series: [
    { name: 'Revenue (R)', values: M.rows.map((r) => r.revenue), color: '#F2A900', fmt: money },
    { name: 'Net profit (R)', values: M.rows.map((r) => r.net), color: '#0B3C49', fmt: money }], axisFmt: axisMoney, label: 'Revenue and net profit by month' });
  const stats = [
    ['R49', 'subscription fee per month (parameter)'],
    ['R5', 'server cost per user per month (parameter)'],
    ['R98,000', 'monthly revenue at 2,000 subscribers'],
  ];
  const body = `${pageTitle('Revenue model', 'How we make money', 'Subscription-based (freemium): free for 5 questions a day, then R49 per month.')}
${section(`<div class="grid grid-3">${stats.map((s, i) => card(`<p class="stat-value">${s[0]}</p><p>${s[1]}</p>`, i === 2 ? 'card--dark' : '')).join('')}</div>
<dl class="kv">
  <dt>Variable</dt><dd>numberOfSubscribers (changes every month)</dd>
  <dt>Parameters</dt><dd>subscriptionFee R49, serverCostPerUser R5, hosting R150 per month</dd>
  <dt>Example</dt><dd>Month 3: 500 users x R49 = R24,500 revenue, less R2,500 server cost = R22,000 profit</dd>
  <dt>Cost-benefit</dt><dd>Development R0 (student project), hosting R150 per month, marketing through schools</dd>
</dl>`)}
${section(`${head('', 'Year 1 projection')}
<div class="grid grid-2 charts"><div class="card"><h3>Paying subscribers</h3>${subsChart}</div><div class="card"><h3>Revenue and net profit (R)</h3>${moneyChart}</div></div>
<p class="caption">Year 1 total: ${rand(M.totals.revenue)} revenue and ${rand(M.totals.net)} net profit after server and hosting costs. Apr to Nov subscriber numbers are estimated growth from Mar (500) to Dec (2,000).</p>
<div class="table-wrap"><table class="table table--num">
<thead><tr><th>Month</th><th>Subscribers</th><th>Revenue</th><th>Server costs</th><th>Net profit</th></tr></thead>
<tbody>${M.rows.map((r) => `<tr><th scope="row">${r.month}</th><td>${num(r.subs)}</td><td>${money(r.revenue)}</td><td>${money(r.server)}</td><td>${money(r.net)}</td></tr>`).join('')}</tbody>
<tfoot><tr><th scope="row">Year 1</th><td></td><td>${money(M.totals.revenue)}</td><td>${money(M.totals.server)}</td><td>${money(M.totals.net)}</td></tr></tfoot>
</table></div>
<ul class="stat-list">
  <li>Mean monthly revenue: <strong>${money(M.stats.mean)}</strong></li>
  <li>Median monthly revenue: <strong>${money(M.stats.median)}</strong></li>
  <li>Lowest month: <strong>${money(M.stats.min)}</strong> (Jan)</li>
  <li>Highest month: <strong>${money(M.stats.max)}</strong> (Dec)</li>
  <li>Range: <strong>${money(M.stats.range)}</strong></li>
</ul>`, 'section--tint')}
${section(`${head('', 'Project a month', 'The same calculation as option 3 in our Java prototype.')}
<form class="calc" id="calc" data-fee="${M.FEE}" data-server="${M.SERVER_COST}" data-hosting="${M.HOSTING}">
  <div class="field"><label for="calc-users">Paying subscribers</label><input id="calc-users" type="number" min="1" max="100000" step="1" value="500" inputmode="numeric"></div>
  <dl class="kv kv--calc" aria-live="polite">
    <dt>Monthly revenue</dt><dd id="calc-revenue"></dd>
    <dt>Server costs</dt><dd id="calc-server"></dd>
    <dt>Profit before hosting</dt><dd id="calc-before"></dd>
    <dt>Net profit (after R150 hosting)</dt><dd id="calc-net"></dd>
  </dl>
</form>`)}`;
  return layout({ title: 'Revenue Model', user, path: '/revenue', body });
}

function contact(user) {
  const email = process.env.CONTACT_EMAIL;
  const body = `${pageTitle('Contact', 'Get in touch')}
${section(`<div class="two-col">
  <form class="form card" data-api="/api/contact" data-success="reset">
    <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" required maxlength="80" autocomplete="name" value="${esc(user ? user.name : '')}"></div>
    <div class="field"><label for="c-email">Email (so we can reply)</label><input id="c-email" name="email" type="email" maxlength="254" autocomplete="email" value="${esc(user ? user.email : '')}"></div>
    <div class="field"><label for="c-grade">Grade</label>
      <select id="c-grade" name="grade"><option value="">Choose a grade</option>${[8, 9, 10, 11, 12].map((g) => `<option${user && user.grade === g ? ' selected' : ''}>${g}</option>`).join('')}<option>Parent</option><option>Teacher</option></select></div>
    <div class="field"><label for="c-message">Question</label><textarea id="c-message" name="message" required maxlength="2000" rows="5"></textarea></div>
    <p class="form-msg" role="status" aria-live="polite"></p>
    <button class="btn" type="submit">Send</button>
  </form>
  <div>
    <h2>Where we are</h2>
    <p>Soshanguve, Gauteng, South Africa</p>
    ${email ? `<p><a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ''}
    <p>Your password is stored as a salted hash, never as plain text.</p>
  </div>
</div>`)}`;
  return layout({ title: 'Contact', user, path: '/contact', body });
}

function register(user, plan) {
  const wanted = ['snap', 'family'].includes(plan) ? plan : 'free';
  const options = PLAN_LIST.map((p) => `<label class="pick${p.key !== 'free' ? ' pick--locked' : ''}">
    <input type="radio" name="plan" value="${p.key}"${p.key === wanted ? ' checked' : ''}>
    <span class="pick-body"><strong>${esc(p.name)}</strong> <span class="pick-price">${p.price}</span>
    <span class="pick-note">${p.key === 'free' ? 'No payment needed' : '<span class="lock">Locked: requires payment</span> You will pay on the next step.'}</span></span>
  </label>`).join('');
  const body = `${pageTitle('', 'Create your account', 'Start free with 5 questions a day. Paid plans are unlocked by paying.')}
${section(`<form class="form card form--narrow" data-api="/api/register">
  <div class="field"><label for="r-name">Name</label><input id="r-name" name="name" required minlength="2" maxlength="80" autocomplete="name"></div>
  <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" required maxlength="254" autocomplete="email"></div>
  <div class="field"><label for="r-grade">Grade</label>
    <select id="r-grade" name="grade" required><option value="">Choose your grade</option>${[8, 9, 10, 11, 12].map((g) => `<option>${g}</option>`).join('')}</select></div>
  <div class="field"><label for="r-password">Password (at least 8 characters)</label><input id="r-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></div>
  <fieldset class="picks"><legend>Choose your plan</legend>${options}</fieldset>
  <label class="check"><input type="checkbox" name="consent" required> <span>I am 18 or older, or a parent or guardian has agreed to my registering. I have read the <a href="/privacy" target="_blank">privacy notice</a>.</span></label>
  <p class="form-msg" role="alert" aria-live="polite"></p>
  <button class="btn" type="submit">Create account</button>
  <p class="form-alt">Already registered? <a href="/login">Log in</a></p>
</form>`)}`;
  return layout({ title: 'Register', user, path: '/register', body });
}

function login(user) {
  const body = `${pageTitle('', 'Log in')}
${section(`<form class="form card form--narrow" data-api="/api/login">
  <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" required autocomplete="email"></div>
  <div class="field"><label for="l-password">Password</label><input id="l-password" name="password" type="password" required autocomplete="current-password"></div>
  <p class="form-msg" role="alert" aria-live="polite"></p>
  <button class="btn" type="submit">Log in</button>
  <p class="form-alt">New here? <a href="/register">Create a free account</a></p>
</form>`)}`;
  return layout({ title: 'Log in', user, path: '/login', body });
}

function formatDate(sqlUtc) {
  try { return new Date(sqlUtc.replace(' ', 'T') + 'Z').toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }); } catch { return sqlUtc; }
}

function dashboard(user, usage, history, paid, aiMode, flash) {
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const isPaid = user.plan !== 'free';
  const first = user.name.split(' ')[0];
  const statusLabel = { answered: 'Answered', queued: 'Waiting for an answer', failed: 'Not answered' };
  const until = user.plan_until ? new Date(user.plan_until).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'long' }) : '';
  const planRows = PLAN_LIST.map((p) => {
    const current = user.plan === p.key;
    const state = current
      ? `<span class="badge badge--on">Your plan</span>${p.key !== 'free' && until ? `<span class="pick-note">Active until ${esc(until)}</span>` : ''}`
      : p.key === 'free' ? '<span class="pick-note">Included</span>'
      : `<span class="lock">Locked: requires payment</span><a class="btn btn--small" href="/checkout?plan=${p.key}">Unlock for ${p.price.replace(' / month', '')}</a>`;
    return `<div class="plan-row${current ? ' is-current' : ''}"><div><strong>${esc(p.name)}</strong> <span class="pick-price">${p.price}</span></div><div class="plan-row-state">${state}</div></div>`;
  }).join('');
  const engineNote = aiMode === 'claude' ? '' : '<p class="alert">AI engine: built-in maths engine. It solves arithmetic and linear or quadratic equations with steps. Other questions wait here until the full AI engine is switched on.</p>';
  const body = `${pageTitle('Dashboard', `Hi ${esc(first)}`)}
${section(`
${flash ? `<div class="alert alert--ok" role="status">Payment received (demo mode). Your ${esc(PLAN_NAMES[flash])} plan is unlocked for 30 days.</div>` : ''}
${user.planExpired ? '<div class="alert" role="status">Your paid plan has ended, so you are back on the Free plan. Unlock it again below.</div>' : ''}
<div class="dash-top">
  <div>
    <div class="card">
      <p class="eyebrow">Your plan</p>
      <p class="dash-plan">${esc(PLAN_NAMES[user.plan])}</p>
      <p>${usage.used} of ${usage.limit} questions used ${usage.period}</p>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${usage.limit}" aria-valuenow="${usage.used}"><span style="width:${pct}%"></span></div>
    </div>
    <div class="card card--spaced">
      <p class="eyebrow">Plans</p>
      ${planRows}
    </div>
  </div>
  <div class="card">
    <p class="eyebrow">Ask a question</p>
    ${engineNote}
    <form class="form" id="ask-form">
      <div class="row">
        <div class="field"><label for="a-subject">Subject</label><select id="a-subject" name="subject">${SUBJECTS.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label for="a-grade">Grade</label><select id="a-grade" name="grade">${[8, 9, 10, 11, 12].map((g) => `<option${g === user.grade ? ' selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label for="a-language">Answer in</label><select id="a-language" name="language">${LANGUAGES.map((l) => `<option>${esc(l)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="a-question">Your question</label><textarea id="a-question" name="question" required maxlength="2000" rows="4" placeholder="Type your homework question, for example: solve 2x + 6 = 14"></textarea></div>
      <div class="field"><label for="a-photo">Photo of the question ${isPaid ? '' : '<span class="muted">(locked: requires Snap &amp; Learn or Family)</span>'}</label>
        <input id="a-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" ${isPaid ? '' : 'disabled'}></div>
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">Get my answer</button>
    </form>
  </div>
</div>`)}
${section(`${head('', 'Your questions')}
${history.length === 0 ? '<p>No questions yet. Ask your first one above.</p>' : history.map((q) => `<article class="q">
  <p class="q-meta">${esc(q.subject)} &middot; Grade ${q.grade} &middot; ${esc(formatDate(q.created_at))} &middot; <span class="status status--${esc(q.status)}">${statusLabel[q.status] || esc(q.status)}</span>${q.has_photo ? ' &middot; Photo attached' : ''}</p>
  <p class="q-text">${esc(q.question)}</p>
  ${q.answer ? `<div class="q-answer"><p class="eyebrow">EduSnap answer</p><p>${esc(q.answer)}</p></div>` : ''}
</article>`).join('')}`, 'section--tint')}
${paid.length ? section(`${head('', 'Payment history', 'Demo mode: these payments are test payments and no money was taken.')}
<div class="table-wrap"><table class="table table--num"><thead><tr><th>Date</th><th>Plan</th><th>Card</th><th>Reference</th><th>Amount</th></tr></thead>
<tbody>${paid.map((p) => `<tr><td>${esc(formatDate(p.created_at))}</td><td>${esc(PLAN_NAMES[p.plan] || p.plan)}</td><td>${esc(p.brand)} ending ${esc(p.last4)}</td><td>${esc(p.reference)}</td><td>R${p.amount}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
  return layout({ title: 'Dashboard', user, path: '/dashboard', body });
}

function checkout(user, plan) {
  const p = PLAN_LIST.find((x) => x.key === plan);
  const price = p.price.replace(' / month', '');
  const body = `${pageTitle('Checkout', 'Unlock ' + esc(p.name))}
${section(`<div class="checkout">
  <form class="form card" id="pay-form" data-plan="${p.key}" novalidate>
    <div class="demo-banner"><strong>Demo mode.</strong> This checkout works like a real one, but no money is taken and real cards are refused. Use the test card 4242 4242 4242 4242 with any future expiry and any 3 digit code.
      <button type="button" class="btn btn--small btn--ghost" id="fill-test">Fill test card</button></div>
    <div class="field"><label for="p-name">Name on card</label><input id="p-name" name="name" required maxlength="80" autocomplete="cc-name" value="${esc(user.name)}"></div>
    <div class="field"><label for="p-number">Card number</label><input id="p-number" name="number" required inputmode="numeric" autocomplete="cc-number" maxlength="23" placeholder="1234 5678 9012 3456"></div>
    <div class="row row--2">
      <div class="field"><label for="p-expiry">Expiry (MM/YY)</label><input id="p-expiry" name="expiry" required inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/YY"></div>
      <div class="field"><label for="p-cvc">Security code</label><input id="p-cvc" name="cvc" required inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="123"></div>
    </div>
    <p class="form-msg" role="alert" aria-live="polite"></p>
    <button class="btn btn--gold btn--wide" type="submit">Pay ${price}</button>
    <p class="form-alt">Card details are checked and discarded. Only the card type and last 4 digits are kept for your receipt.</p>
  </form>
  <aside class="card card--dark">
    <h3>Order summary</h3>
    <p class="summary-plan">${esc(p.name)}</p>
    <ul class="summary-list">${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
    <p class="summary-total"><span>Total today</span><strong>${price}</strong></p>
    <p class="summary-note">Covers 30 days. Paying again renews your plan.</p>
    <a class="summary-back" href="/dashboard">Stay on the Free plan</a>
  </aside>
</div>`)}`;
  return layout({ title: 'Checkout', user, path: '/checkout', body });
}

function privacy(user) {
  const email = process.env.CONTACT_EMAIL;
  const body = `${pageTitle('Privacy', 'Privacy notice')}
${section(`<div class="prose">
<h2>What we store</h2>
<p>When you register we store your name, email address, grade and a salted hash of your password. We never store your password itself. We also store the questions you ask and the answers you receive, and any message you send us on the Contact page.</p>
<h2>Payments</h2>
<p>EduSnap is in demo payment mode: no real money is taken and real cards are refused. We keep only the card type, the last 4 digits and a reference for your receipt. Full card numbers and security codes are never stored.</p>
<h2>Photos</h2>
<p>A photo you attach is sent with your question to be read and is not kept by EduSnap. We only record that a photo was attached.</p>
<h2>How questions are answered</h2>
<p>When the AI tutor is switched on, your question (and photo, if any) is sent to an AI service to produce the answer. Do not include private information such as ID numbers or addresses in your questions.</p>
<h2>Who sees it</h2>
<p>We do not sell your information. It is used only to run EduSnap and to reply to you.</p>
<h2>Learners under 18</h2>
<p>Learners under 18 may only register with the agreement of a parent or guardian.</p>
<h2>Your choices</h2>
<p>You can ask us to delete your account and questions at any time through the <a href="/contact">Contact page</a>${email ? ` or at <a href="mailto:${esc(email)}">${esc(email)}</a>` : ''}.</p>
</div>`)}`;
  return layout({ title: 'Privacy', user, path: '/privacy', body });
}

function notFound(user, message) {
  const body = `${pageTitle('', esc(message ? 'Something went wrong' : 'Page not found'), esc(message || 'That page does not exist.'))}
${section('<a class="btn" href="/">Back to home</a>')}`;
  return layout({ title: 'Not found', user, body });
}

module.exports = { home, about, persona, plans, revenue, contact, register, login, dashboard, checkout, privacy, notFound, SUBJECTS, LANGUAGES };
