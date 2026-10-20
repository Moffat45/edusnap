#!/usr/bin/env node
// Owner tools. Run from the project folder, for example:  npm run admin -- users
//
//   users                      list registered users
//   payments                   list payments (demo mode: no real money)
//   set-plan <email> <plan>    switch a user to free, snap or family (for example to give someone a plan by hand; sets 30 days)
//   messages                   list messages from the Contact page
//   questions                  list questions waiting for an answer
//   answer <id> <text>         write the answer to a waiting question
//   delete-user <email>        delete an account and everything attached to it

const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const { db } = require('../lib/db');

const [cmd, ...args] = process.argv.slice(2);
const show = (rows) => (rows.length ? console.table(rows) : console.log('(nothing)'));

switch (cmd) {
  case 'users':
    show(db.prepare('SELECT id, name, email, grade, plan, created_at FROM users ORDER BY id DESC').all());
    break;
  case 'payments':
    show(db.prepare(`SELECT p.id, u.email, p.plan, p.amount, p.brand, p.last4, p.reference, p.created_at
                     FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`).all());
    break;
  case 'set-plan': {
    const [email, plan] = args;
    if (!email || !['free', 'snap', 'family'].includes(plan)) { console.log('Usage: set-plan <email> <free|snap|family>'); break; }
    const until = plan === 'free' ? null : new Date(Date.now() + 30 * 86400000).toISOString();
    const info = db.prepare('UPDATE users SET plan = ?, plan_until = ? WHERE email = ?').run(plan, until, email.toLowerCase());
    console.log(info.changes ? `Done: ${email} is now on the ${plan} plan.` : 'No user with that email.');
    break;
  }
  case 'messages':
    show(db.prepare('SELECT id, name, email, grade, message, created_at FROM messages ORDER BY id DESC').all());
    break;
  case 'questions':
    show(db.prepare(`SELECT q.id, u.email, q.subject, q.grade, q.language, q.question, q.created_at
                     FROM questions q JOIN users u ON u.id = q.user_id WHERE q.status = 'queued' ORDER BY q.id`).all());
    break;
  case 'answer': {
    const id = Number(args[0]);
    const text = args.slice(1).join(' ').trim();
    if (!id || !text) { console.log('Usage: answer <id> <text>'); break; }
    const info = db.prepare(`UPDATE questions SET answer = ?, status = 'answered' WHERE id = ? AND status = 'queued'`).run(text, id);
    console.log(info.changes ? 'Answer saved. The learner will see it on their dashboard.' : 'No waiting question with that id.');
    break;
  }
  case 'delete-user': {
    const info = db.prepare('DELETE FROM users WHERE email = ?').run((args[0] || '').toLowerCase());
    console.log(info.changes ? 'Account deleted.' : 'No user with that email.');
    break;
  }
  default:
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).join('\n'));
}
