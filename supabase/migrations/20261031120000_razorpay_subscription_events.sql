/*
  Kinly — Razorpay subscription bookkeeping.

  razorpay_events remembers every webhook Razorpay has delivered, so a retried delivery is
  applied once. Only the server (using the Supabase secret key) reads or writes it; signed-in
  people and visitors have no access at all.

  Each Razorpay subscription belongs to exactly one Kinly account.
*/

create table public.razorpay_events (
  event_id text primary key check (char_length(event_id) <= 100),
  event_type text not null check (char_length(event_type) <= 60),
  subscription_id text check (char_length(subscription_id) <= 100),
  received_at timestamptz not null default now()
);

alter table public.razorpay_events enable row level security;
revoke all on public.razorpay_events from anon, public, authenticated;

create unique index subscriptions_provider_subscription_idx on public.subscriptions (provider_subscription_id) where provider_subscription_id is not null;
