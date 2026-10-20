// EduSnap front-end: menu, forms, ask-a-question, plan requests, revenue calculator.
(function () {
  'use strict';

  async function post(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' });
    let body = {};
    try { body = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) {
      const err = new Error(body.error || 'Something went wrong. Please try again.');
      err.redirect = body.redirect;
      throw err;
    }
    return body;
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('is-ok', 'is-error');
    if (kind) el.classList.add(kind === 'ok' ? 'is-ok' : 'is-error');
  }

  // mobile menu
  const header = document.querySelector('.site-header');
  const toggle = document.getElementById('nav-toggle');
  if (toggle && header) {
    toggle.addEventListener('click', function () {
      const open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // log out
  const logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', async function () {
      try { await post('/api/logout', {}); } finally { window.location.href = '/'; }
    });
  }

  // register, login and contact forms
  document.querySelectorAll('form[data-api]').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      const button = form.querySelector('button[type="submit"]');
      const data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      form.querySelectorAll('input[type="checkbox"]').forEach(function (c) { data[c.name] = c.checked; });
      if (data.grade !== undefined && /^\d+$/.test(data.grade)) data.grade = Number(data.grade);
      button.disabled = true;
      setMsg(msg, 'Please wait...', '');
      try {
        const result = await post(form.dataset.api, data);
        if (result.redirect) { window.location.href = result.redirect; return; }
        setMsg(msg, result.message || 'Done.', 'ok');
        if (form.dataset.success === 'reset') form.reset();
      } catch (err) {
        setMsg(msg, err.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  // checkout (demo card payment)
  const pay = document.getElementById('pay-form');
  if (pay) {
    const number = document.getElementById('p-number'), expiry = document.getElementById('p-expiry'), cvc = document.getElementById('p-cvc');
    number.addEventListener('input', function () { number.value = number.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
    expiry.addEventListener('input', function () {
      const d = expiry.value.replace(/\D/g, '').slice(0, 4);
      expiry.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
    });
    cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
    document.getElementById('fill-test').addEventListener('click', function () {
      const next = new Date(); next.setFullYear(next.getFullYear() + 2);
      number.value = '4242 4242 4242 4242';
      expiry.value = '12/' + String(next.getFullYear()).slice(2);
      cvc.value = '123';
    });
    pay.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = pay.querySelector('.form-msg');
      const button = pay.querySelector('button[type="submit"]');
      button.disabled = true;
      setMsg(msg, 'Processing payment...', '');
      try {
        const result = await post('/api/pay', { plan: pay.dataset.plan, name: pay.name.value, number: number.value, expiry: expiry.value, cvc: cvc.value });
        window.location.href = result.redirect;
      } catch (err) {
        if (err.redirect) { window.location.href = err.redirect; return; }
        setMsg(msg, err.message, 'error');
        button.disabled = false;
      }
    });
  }

  // ask a question
  const ask = document.getElementById('ask-form');
  if (ask) {
    ask.addEventListener('submit', async function (e) {
      e.preventDefault();
      const msg = ask.querySelector('.form-msg');
      const button = ask.querySelector('button[type="submit"]');
      const photo = ask.querySelector('#a-photo');
      const payload = {
        subject: ask.subject.value,
        grade: Number(ask.grade.value),
        language: ask.language.value,
        question: ask.question.value,
      };
      button.disabled = true;
      setMsg(msg, 'Getting your answer. This can take a few seconds...', '');
      try {
        const file = photo && photo.files && photo.files[0];
        if (file) {
          if (file.size > 4 * 1024 * 1024) throw new Error('That photo is too large. Please use one under 4 MB.');
          payload.image = await new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve({ type: file.type, data: String(reader.result).split(',')[1] }); };
            reader.onerror = function () { reject(new Error('We could not read that photo.')); };
            reader.readAsDataURL(file);
          });
        }
        const result = await post('/api/ask', payload);
        setMsg(msg, result.status === 'queued' ? result.message : 'Answer ready.', 'ok');
        window.location.assign('/dashboard');
      } catch (err) {
        if (err.redirect) { window.location.href = err.redirect; return; }
        setMsg(msg, err.message, 'error');
        button.disabled = false;
      }
    });
  }

  // revenue calculator (same maths as option 3 in the Java prototype)
  const calc = document.getElementById('calc');
  if (calc) {
    const fee = Number(calc.dataset.fee), server = Number(calc.dataset.server), hosting = Number(calc.dataset.hosting);
    const input = document.getElementById('calc-users');
    const rand = function (n) { return (n < 0 ? '-R' : 'R') + Math.abs(Math.round(n)).toLocaleString('en-US'); };
    const run = function () {
      const users = Math.max(0, Math.min(100000, Math.floor(Number(input.value) || 0)));
      const revenue = users * fee, costs = users * server;
      document.getElementById('calc-revenue').textContent = rand(revenue);
      document.getElementById('calc-server').textContent = rand(costs);
      document.getElementById('calc-before').textContent = rand(revenue - costs);
      document.getElementById('calc-net').textContent = rand(revenue - costs - hosting);
    };
    input.addEventListener('input', run);
    calc.addEventListener('submit', function (e) { e.preventDefault(); });
    run();
  }
})();
