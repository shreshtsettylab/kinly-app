# Moving Kinly data into accounts — plan

Today all Kinly data lives in the browser. This plan covers moving it into the signed-in user's
Supabase account safely. **Steps 1–3 are done; nothing syncs yet.**

## 1. Private tables (done)

`supabase/migrations/20261029120000_private_user_data.sql` creates `profiles`, `people`,
`plans`, `goals`, `reflections` and `checkins`. Each row has a `user_id` that is filled in from
the session, and Row Level Security lets people read and change only their own rows. Visitors
who are not signed in get no access. Ids are text, so browser ids carry over unchanged.

## 2. Privacy rules tested (done locally, repeat on the real project)

`supabase/tests/rls_check.sql` acts as two users and a signed-out visitor and checks that nobody
can see, change, delete, forge or reassign someone else's rows. It passed 8 of 8 checks against
real Postgres with Supabase's auth setup recreated, and it correctly failed when a policy was
deliberately broken. **Run it in the Supabase SQL editor after applying the migration.**

## 3. Applied to Supabase (done, 29 Oct 2026)

Applied to the Kinly project (kmzozybplihymholfwes, Mumbai). The RLS check passed all 8 checks on
the real database and left nothing behind. With only the publishable key, every table refuses
reads and writes (42501). Supabase’s security advisor flagged only the optional “leaked password
protection” switch in Auth settings.

## 4. First sync — explicit, one-way, reversible (to build next)

- Signed-in users see **"Back up my Kinly data to my account"** in Settings. Nothing uploads
  without that click.
- Before uploading, Kinly exports a local backup file automatically.
- Upload copies browser data into the tables. Browser data is **kept**, not deleted.
- Show a summary: "Copied 5 people, 4 plans, 2 goals, 3 reflections."

## 5. Ongoing sync (later)

- Read from the account on sign-in; write changes to both the browser and the account.
- Conflicts: newest `updated_at` wins per row; deletions recorded so they don't come back.
- Signing out keeps the browser copy; a separate "Remove data from this device" option.

## 6. Before turning it on for everyone

- Re-run the RLS check on production.
- Add "Delete my account and data" (Supabase deletes rows automatically via `on delete cascade`).
- Update the landing page privacy section — it currently, and correctly, says data is not synced.
