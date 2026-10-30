# Kinly — Submission 2

**Live site:** https://www.kinly.in
**Code:** https://github.com/shreshtsettylab/kinly-app (branch `main`)

Kinly is a calm, private web app for thinking about your relationships, plans and decisions.
Notes stay in your browser by default; an optional account (Supabase) can back them up.

## What this submission adds

| Requirement | What was built | Where to check |
|---|---|---|
| Microsoft Clarity | Tracking tag with Strict masking. The app, sign-in, account and checkout screens are also masked in code, so personal notes are never recorded. | Tag in `index.html`; Clarity project `z59zod7yqk` |
| Google Search Console | Site verified with a meta tag; `sitemap.xml` submitted and accepted; `robots.txt` live. | https://www.kinly.in/sitemap.xml |
| Payment gateway | Razorpay Standard Checkout: server creates the order, browser opens Razorpay's window, server verifies the payment signature. Website approved by Razorpay; test payment completed. | "Support Kinly early" on https://www.kinly.in/#pricing |
| Policy pages | Terms, Privacy, Refund & cancellation, and Contact pages, linked from every page's footer. | [/terms](https://www.kinly.in/terms), [/privacy](https://www.kinly.in/privacy), [/refunds](https://www.kinly.in/refunds), [/contact](https://www.kinly.in/contact) |

## How the payment works

1. **Create order** — `api/create-order.ts` (Vercel serverless function) calls Razorpay's Orders
   API. The price is set on the server (₹99 placeholder), so it can't be changed from the browser.
2. **Pay** — `src/checkout.ts` loads Razorpay's checkout window only when the button is clicked.
3. **Verify** — `api/verify-payment.ts` checks Razorpay's HMAC-SHA256 signature with the secret
   key before Kinly shows "Your payment is confirmed".

Security: the secret key exists only in Vercel's server environment (never in browser code or
Git); both endpoints reject requests from other websites; forged payment details are rejected.

## Try it

1. Open https://www.kinly.in and scroll to **Pricing**.
2. Click **Support Kinly early**. The Razorpay window opens in Test Mode.
3. Pay with UPI `test@razorpay` (or a Razorpay test card) and approve. Kinly shows the confirmed
   payment reference.

## Also in the app

- Landing page, the Kinly app at `/app`, sign-in with email or Google, password reset, account page
- Private-by-default storage with optional cloud backup (Supabase with Row Level Security)
- Optional "Deeper answer" using Claude AI, off until the user turns it on

## Next steps after the course

- Switch to Razorpay live keys and set the final price
- Move from one-time support to a Kinly Plus plan once those features exist
