# Kinly

A calm, private space to think about your people, your plans and the choices between them.
Live at [kinly.in](https://www.kinly.in).

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Everything you add is stored only in your browser.

| Path | What it shows |
|---|---|
| `/` | Public landing page (sample data only) |
| `/app` | The Kinly app |
| `/signin` | Sign in, create an account, or reset a password (Supabase Auth) |
| `/auth/callback` | Where Google and email links return after signing in |
| `/reset-password` | Choose a new password from a reset link |
| `/account` | Account details and sign out — requires being signed in |
| `/checkout/complete` | Shown after a Razorpay payment is verified |
| `/terms`, `/privacy`, `/refunds`, `/contact` | Policy and contact pages |

`vercel.json` tells Vercel to serve the app for these paths, so links work when opened directly.

## Optional: accounts (Supabase Auth)

Sign-in works once a Supabase project is connected; without one, the sign-in page says accounts
aren't available and sends nothing. See [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md) for the
dashboard steps, Google OAuth, environment variables and redirect URLs. Signing in does not yet
move or sync Kinly data — that stays in the browser.

## Plans: Kinly Free and Kinly Plus

| | Free (₹0) | Plus (₹99/month or ₹999/year) |
|---|---|---|
| Active people | 5 (archived people don't count) | Unlimited |
| Questions (instant answers) | 15 per calendar month, counted in the browser | Unlimited |
| Reflections and notes | Unlimited | Unlimited |
| Active plans | 5 upcoming (past plans don't count) | Unlimited |
| Active goals | 3 (completed goals don't count) | Unlimited |
| AI features | — | 20 credits per billing month |

- **Where the plan comes from:** `supabase/migrations/20261030120000_subscriptions_and_ai_credits.sql`
  gives every account a `subscriptions` row (Free by default, created by a trigger on sign-up).
  Accounts can read their own plan and usage but can't change them. Plans are changed only on the
  server.
- **Limits:** a limit never deletes, hides or locks saved data; it only stops adding more.
  The page is `/pricing`. Plus can't be bought yet, so its buttons say "Coming soon".
- **AI credits:** `api/ai.ts` handles all five Plus AI features. It calls `ai_begin` in the
  database as the signed-in person, which checks the plan and credits (rows are locked, so
  simultaneous requests can't overspend). It then calls Claude, and only after a successful answer
  marks the request as used (`ai_finish`). Failures cost nothing. Costs:
  - reflection: 1 credit
  - conversation prep: 1 credit
  - decision analysis: 2 credits
  - relationship analysis: 2 credits
  - weekly review: 2 credits
- **Checks:** `supabase/tests/subscription_check.sql` runs all of this as two throwaway accounts
  and rolls everything back.
- **Setup:** add `OPENROUTER_API_KEY` in Vercel. Answers come from Claude Haiku 5.5
  (`anthropic/claude-haiku-5.5`) through [OpenRouter](https://openrouter.ai). Give the key a
  credit limit on OpenRouter, which is the hard ceiling on cost. The function also reads the public
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Payments (Razorpay Standard Checkout)

The "Support Kinly early" button on the landing page takes a one-time payment:

1. `api/create-order.ts` creates a Razorpay order on the server. The amount is set there
   (`RAZORPAY_AMOUNT_PAISE`, default 9900 = ₹99), so the browser can't change the price.
2. The browser opens Razorpay's checkout window with that order (`src/checkout.ts`).
3. `api/verify-payment.ts` checks Razorpay's signature (HMAC-SHA256 with the key secret) before
   Kinly shows the payment as confirmed.

Environment variables (see `.env.example`): `VITE_RAZORPAY_KEY_ID` (public), `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET` (server only, never in browser code) and optionally `RAZORPAY_AMOUNT_PAISE`.
Test keys (`rzp_test_…`) show a "Test mode" label and never move real money; switching to live
keys in Vercel and redeploying turns that off.

## Analytics and search

- **Microsoft Clarity** (`index.html`) records page and button usage with Strict masking. The app,
  sign-in, account and checkout screens are also marked `data-clarity-mask`, so personal notes are
  never captured.
- **Google Search Console** verifies the site with a meta tag in `index.html`; `public/sitemap.xml`
  and `public/robots.txt` are submitted for indexing.
