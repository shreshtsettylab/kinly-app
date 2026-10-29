# Setting up sign-in (Supabase Auth + Google)

Kinly's sign-in code is in place, but it stays switched off until a Supabase project is
connected. Until then the sign-in page says accounts aren't available, and nothing is sent.

**What signing in does today:** it gives someone an account (email/password or Google) and
unlocks the `/account` page. **It does not move or sync Kinly data.** People, plans, goals and
reflections stay in the browser's local storage. Moving data into accounts needs per-user tables
and tested Row Level Security first, and is a separate, later step.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a region close to your users
   (for India, Mumbai `ap-south-1`).
2. When it's ready, open **Project Settings → API Keys** and copy:
   - the **Project URL** (`https://<project-ref>.supabase.co`)
   - the **Publishable key** (`sb_publishable_…`), or the legacy **anon** key.
3. **Never** copy the *secret* / *service_role* key into Kinly. The app refuses to start sign-in
   if one is supplied.

## 2. Configure redirect URLs

**Authentication → URL Configuration**

| Setting | Value |
|---|---|
| Site URL | `https://www.kinly.in` |
| Redirect URLs | `https://www.kinly.in/auth/callback` |
| | `https://www.kinly.in/reset-password` |
| | `http://localhost:5173/auth/callback` |
| | `http://localhost:5173/reset-password` |
| | `https://kinly-*-shresht2.vercel.app/**` *(Vercel previews; optional)* |

`kinly.in` redirects to `www.kinly.in`, so only the `www` address is needed.

## 3. Email and password

**Authentication → Sign In / Providers → Email**

- Keep **Email** enabled.
- Keep **Confirm email** on (recommended). New users get a link that returns to
  `/auth/callback` and signs them in.
- Minimum password length: Kinly asks for 8 characters; set the same here.
- Supabase's built-in email sender is meant for testing: it is heavily rate-limited. Before
  real users sign up, add your own SMTP provider under **Authentication → Emails → SMTP Settings**.

## 4. Google sign-in

**In Google Cloud Console** (<https://console.cloud.google.com>):

1. Create (or pick) a project.
2. **Google Auth Platform → Branding**: app name *Kinly*, support email, logo (optional),
   home page `https://www.kinly.in`. Add `supabase.co` and `kinly.in` as authorised domains.
3. **Audience**: *External*. While testing, add your own Google account as a test user.
4. **Clients → Create client → Web application**:
   - **Authorised JavaScript origins:** `https://www.kinly.in`, `http://localhost:5173`
   - **Authorised redirect URIs:** the **Callback URL** shown on Supabase's Google provider page,
     which looks like `https://<project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.

**In Supabase** → **Authentication → Sign In / Providers → Google**: enable it and paste the
Client ID and Client secret. The secret lives only in Supabase — never in Kinly's code or
environment variables.

## 5. Add the environment variables

**Locally:** copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

Restart `npm run dev` after changing it.

**On Vercel:** Project → Settings → Environment Variables → add the same two variables for
*Production* (and *Preview* if you use preview links), then redeploy. `VITE_` variables are
built into the browser bundle, which is why only the publishable key may be used.

## 6. Test each flow

Run `npm run dev` and open <http://localhost:5173/signin>.

| Flow | Steps | Expected |
|---|---|---|
| Sign up (email) | *Create account* → email + password (8+) → submit | "Check your email". The link opens `/auth/callback` and lands in `/app`. |
| Unconfirmed sign-in | Try *Sign in* before confirming | Message plus *Resend confirmation email*. |
| Sign in (email) | Correct details | Lands in `/app` (or the `?next=` page, e.g. `/account`). |
| Wrong password | Incorrect password | "That email and password don't match." |
| Google | *Continue with Google* → choose account | Returns via `/auth/callback` to `/app`. |
| Google cancelled | *Continue with Google* → cancel on Google's screen | "Google sign-in was cancelled. Nothing was changed." |
| Forgot password | *Forgot password?* → email → open link | `/reset-password` → set new password → "Password updated". |
| Expired / reused link | Open an old reset link again | "This reset link can't be used" + *Request a new link*. |
| Protected page | Signed out, visit `/account` | Redirects to sign-in, then back to `/account`. |
| Sign out | `/account` or app *Settings → Account* → *Sign out* | Nav switches back to *Sign in*; other tabs update too. |

Open email links **in the same browser** you started in: Kinly uses the PKCE flow, which ties
each link to the browser that requested it.

## Security notes

- Sessions are stored by the Supabase client in this browser's local storage and refreshed
  automatically — the recommended setup for a browser-only app. Anyone with access to the
  device's browser profile could use the session, so *Sign out* on shared computers.
- PKCE flow: links and OAuth redirects carry a one-time code, never tokens in the URL.
- After sign-in, Kinly only redirects to paths on its own site.
- Private per-user tables with Row Level Security are ready in `supabase/migrations`, with a
  check in `supabase/tests/rls_check.sql`. See [DATA_SYNC_PLAN.md](DATA_SYNC_PLAN.md) before
  storing any data in Supabase.
