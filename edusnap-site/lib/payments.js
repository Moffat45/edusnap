// Payments. DEMO MODE ONLY: it behaves like a card checkout but no money moves.
// Only well-known test card numbers are accepted, so a real card can never be charged or stored.
// To take real payments, replace charge() with a call to a South African gateway (PayFast, Yoco, Peach Payments, Stripe).

const crypto = require('node:crypto');

const PLANS = {
  snap: { name: 'Snap & Learn', price: 49 },
  family: { name: 'Family', price: 89 },
};

const TEST_CARDS = {
  '4242424242424242': { ok: true, brand: 'Visa' },
  '5555555555554444': { ok: true, brand: 'Mastercard' },
  '4000000000000002': { ok: false, error: 'Your card was declined by the bank. Please try a different card.' },
  '4000000000009995': { ok: false, error: 'Your card has insufficient funds.' },
};

function mode() {
  return 'demo';
}

function luhn(number) {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let d = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

function expiryOk(expiry) {
  const m = /^(\d{2})\s*\/?\s*(\d{2})$/.exec(expiry.trim());
  if (!m) return false;
  const month = Number(m[1]), year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

function charge({ plan, name, number, expiry, cvc }) {
  const info = PLANS[plan];
  if (!info) return { ok: false, error: 'Please choose a plan.' };
  const digits = number.replace(/[\s-]/g, '');
  if (name.trim().length < 2) return { ok: false, error: 'Please enter the name on the card.' };
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) return { ok: false, error: 'That card number does not look right. Please check it.' };
  if (!expiryOk(expiry)) return { ok: false, error: 'That expiry date is not valid. Use MM/YY.' };
  if (!/^\d{3,4}$/.test(cvc)) return { ok: false, error: 'Please enter the 3 or 4 digit security code.' };
  const test = TEST_CARDS[digits];
  if (!test) return { ok: false, error: 'Demo mode: no real payments are taken. Please use a test card, for example 4242 4242 4242 4242.' };
  if (!test.ok) return { ok: false, error: test.error };
  return { ok: true, brand: test.brand, last4: digits.slice(-4), amount: info.price, reference: 'DEMO-' + crypto.randomBytes(5).toString('hex').toUpperCase() };
}

module.exports = { PLANS, charge, mode };
