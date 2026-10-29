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

`vercel.json` tells Vercel to serve the app for these paths, so links work when opened directly.

## Optional: accounts (Supabase Auth)

Sign-in works once a Supabase project is connected; without one, the sign-in page says accounts
aren't available and sends nothing. See [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md) for the
dashboard steps, Google OAuth, environment variables and redirect URLs. Signing in does not yet
move or sync Kinly data — that stays in the browser.

## Optional: Deeper answers with Claude AI

Kinly's instant answers work without any setup. The optional "Deeper answer" button sends one
question, with the notes about the person involved, to Claude through the serverless function in
`api/deeper.ts`. People must turn it on in Settings first.

To enable it:

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) and set a monthly spend limit there.
2. **On Vercel:** Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`, then redeploy.
3. **Locally:** create a file named `.env.local` containing `ANTHROPIC_API_KEY=...` and restart `npm run dev`.
   `.env.local` is ignored by Git, so the key is never committed.

The function uses Claude Haiku 5.5, accepts requests only from Kinly's own pages, checks request
size and shape, and applies best-effort daily limits (20 per visitor, 500 in total per instance).
The Anthropic spend limit is the hard ceiling on cost.
