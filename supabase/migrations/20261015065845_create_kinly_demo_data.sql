/*
# WARNING — do not apply this to a real database as written.
# The app does not use Supabase; it stores data only in the browser.
# The policies below let ANYONE with the public (anon) key read, change and
# delete every row. Before using Supabase, add sign-in and per-user policies
# (e.g. an owner_id column checked against auth.uid()).

# Create Kinly demo data tables

1. New Tables
- `kinly_people` stores relationship entries shown in the People directory, including name, relationship context, notes, initials, and avatar color.
- `kinly_plans` stores upcoming and past commitments, including title, date, time, linked person, category, and optional context.
- `kinly_goals` stores monthly priorities with an optional description, category, and active/completed status.

2. Data Relationships
- `kinly_plans.person_id` optionally references `kinly_people.id`; deleting a person keeps their plan but clears the person link.

3. Security
- Row Level Security is enabled on all three tables.
- This first demo has no sign-in screen and intentionally uses a single shared workspace, so anon and authenticated roles receive separate CRUD policies on each table.

4. Important Notes
- No existing tables are modified.
- The frontend is responsible for keeping the active goal count at three or fewer until accounts and ownership are introduced.
*/

CREATE TABLE IF NOT EXISTS public.kinly_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text NOT NULL,
  relationship text NOT NULL DEFAULT 'Person in your life',
  detail text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#526579',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kinly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  plan_date date NOT NULL,
  plan_time time NOT NULL,
  person_id uuid REFERENCES public.kinly_people(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Personal',
  context text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kinly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Relationships',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  month_start date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kinly_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kinly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kinly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_kinly_people" ON public.kinly_people;
CREATE POLICY "anon_select_kinly_people" ON public.kinly_people FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_kinly_people" ON public.kinly_people;
CREATE POLICY "anon_insert_kinly_people" ON public.kinly_people FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_kinly_people" ON public.kinly_people;
CREATE POLICY "anon_update_kinly_people" ON public.kinly_people FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_kinly_people" ON public.kinly_people;
CREATE POLICY "anon_delete_kinly_people" ON public.kinly_people FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_kinly_plans" ON public.kinly_plans;
CREATE POLICY "anon_select_kinly_plans" ON public.kinly_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_kinly_plans" ON public.kinly_plans;
CREATE POLICY "anon_insert_kinly_plans" ON public.kinly_plans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_kinly_plans" ON public.kinly_plans;
CREATE POLICY "anon_update_kinly_plans" ON public.kinly_plans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_kinly_plans" ON public.kinly_plans;
CREATE POLICY "anon_delete_kinly_plans" ON public.kinly_plans FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_kinly_goals" ON public.kinly_goals;
CREATE POLICY "anon_select_kinly_goals" ON public.kinly_goals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_kinly_goals" ON public.kinly_goals;
CREATE POLICY "anon_insert_kinly_goals" ON public.kinly_goals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_kinly_goals" ON public.kinly_goals;
CREATE POLICY "anon_update_kinly_goals" ON public.kinly_goals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_kinly_goals" ON public.kinly_goals;
CREATE POLICY "anon_delete_kinly_goals" ON public.kinly_goals FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS kinly_plans_plan_date_idx ON public.kinly_plans(plan_date, plan_time);
CREATE INDEX IF NOT EXISTS kinly_plans_person_id_idx ON public.kinly_plans(person_id);
CREATE INDEX IF NOT EXISTS kinly_goals_month_start_idx ON public.kinly_goals(month_start, status);
