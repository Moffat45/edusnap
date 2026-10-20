# EduSnap

AI homework help for South African high school learners (Grades 8 to 12). A real working website:
accounts, login, a free plan with a daily limit, locked paid plans with a demo card checkout,
an AI tutor, a dashboard, a contact form and the project's revenue model.

It has **no npm dependencies**. It needs only **Node.js 22.13 or newer** (it uses Node's built-in web server, SQLite and password hashing).

## Run it on your computer

1. Install Node.js 22 or newer from https://nodejs.org
2. In this folder run: `node server.js`
3. Open http://localhost:3000

Optional: copy `.env.example` to `.env` and fill in the values (see "Turn on the full AI engine").

## What is real and what is demo

| Feature | Status |
|---|---|
| Register, log in, log out | Real. Passwords are salted scrypt hashes. Sessions are HttpOnly cookies. |
| Free plan, 5 questions per day (resets at midnight SA time) | Real |
| Paid plans locked until paid, 100 questions per month, photo questions | Real. A payment unlocks the plan for 30 days, then it drops back to Free. |
| Checkout | **Demo mode.** It looks like a real card checkout, but no money moves and only test cards work. |
| AI tutor | Real. Built-in maths engine always on; full AI for every subject once you add an API key. |
| Contact form, dashboard, payment history, privacy page | Real |

### Demo checkout test cards

| Card number | Result |
|---|---|
| 4242 4242 4242 4242 | Approved (Visa) |
| 5555 5555 5555 4444 | Approved (Mastercard) |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |

Use any expiry date in the future and any 3 digit security code. Real card numbers are refused on purpose, so nobody can hand real card details to the demo.

### Taking real payments later

All payment logic is in `lib/payments.js` (the `charge()` function). To go live, use a hosted checkout from a South African gateway
(PayFast, Yoco or Peach Payments) or Stripe, so card numbers never touch your server, then mark the user's plan as paid when the gateway confirms.
Do not turn on real payments until you have the gateway's approval and your own terms of service.

## Turn on the full AI engine

Without a key the site answers maths questions (arithmetic, linear and quadratic equations, with steps) using its built-in engine.
For every subject, in English, Afrikaans and Zulu, and for reading photos:

1. Create an API key at https://console.anthropic.com
2. Put it in the `ANTHROPIC_API_KEY` environment variable (on Render: Environment tab; on your computer: the `.env` file).
3. Restart. The dashboard note about the built-in engine disappears.

Each question costs a small amount on your Anthropic account. The 5 per day and 100 per month limits keep this under control.

## Put it on GitHub

1. Create a new **private** repository on https://github.com/new
2. In this folder run:
   ```
   git init
   git add .
   git commit -m "EduSnap"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/edusnap.git
   git push -u origin main
   ```
   The `.gitignore` keeps your `.env` file and the database out of GitHub.

## Host it on Render (from GitHub)

1. Sign up at https://render.com and connect your GitHub account.
2. Click **New > Blueprint**, pick your repository, and approve. `render.yaml` sets everything up.
3. When asked, paste your `ANTHROPIC_API_KEY` (you can leave it empty and add it later) and your `CONTACT_EMAIL`.
4. When the deploy finishes you get a link like `https://edusnap.onrender.com`. HTTPS is included.

**Important:** the database is a file. `render.yaml` uses the *Starter* plan with a 1 GB disk (about US$7 per month plus about US$0.25 for the disk) so accounts and questions survive restarts.
On Render's *free* plan there is no disk: the site runs, but everything is wiped whenever it restarts or redeploys, and it sleeps after 15 minutes of no visits. That is fine for a quick demo, not for real users.
To try the free plan anyway, create a **New > Web Service** by hand instead of using the Blueprint: build command empty, start command `node server.js`, and set the environment variable `NODE_VERSION` to `22.14.0`.

### Other places that work

Anything that can run Node 22 with a persistent folder: Railway (add a volume), Fly.io (add a volume), or any VPS (run `node server.js` behind Caddy or nginx).
Platforms that only host static files (GitHub Pages, Netlify, Vercel static) **cannot** run this site, because it needs the server for accounts and the AI.

## Look after the site

Run these in the project folder (on Render, use the Shell tab):

```
npm run admin -- users                      who has registered
npm run admin -- payments                   payment records
npm run admin -- messages                   messages from the Contact page
npm run admin -- questions                  questions waiting for a hand-written answer
npm run admin -- answer 12 "Your answer"    answer question 12
npm run admin -- set-plan a@b.com snap      give someone a plan for 30 days
npm run admin -- delete-user a@b.com        delete an account (privacy requests)
```

## Before you invite real learners

- Many users are under 18. The registration form asks for a parent or guardian's agreement, but get proper legal advice on POPIA (South Africa's privacy law), terms of service and refunds before collecting real data or money.
- The site stores names, emails, grades and questions. Keep your hosting account and API key secure.
- The "Project documents" links in the footer share your assignment files. Remove the `public/downloads` folder and the footer links if you do not want them public.

## Folder guide

```
server.js            web server and API
lib/views.js         all page templates
lib/payments.js      checkout (demo mode)
lib/ai.js            AI tutor (Claude API or built-in engine)
lib/engine.js        built-in maths engine
lib/model.js         revenue figures (same as the Excel model)
public/css, js       styles and browser code
public/downloads     the project documents
scripts/admin.js     owner tools
```
