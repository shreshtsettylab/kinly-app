import { createHmac, timingSafeEqual } from 'node:crypto';

// Shared by the Kinly Plus subscription endpoints. Vercel doesn't publish files that start with
// "_", so this is never reachable on its own.
//
// Server-only settings (Vercel environment variables, never in browser code):
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — the same keys checkout already uses
//   RAZORPAY_WEBHOOK_SECRET               — chosen when adding the webhook in Razorpay
//   SUPABASE_SECRET_KEY                   — lets the server record plan changes (bypasses RLS)
//   RAZORPAY_PLAN_MONTH / RAZORPAY_PLAN_YEAR — optional; override the plan ids below

export type Interval = 'month' | 'year';

// Razorpay plan ids are public identifiers, not secrets. Live and test plans differ.
const PLAN_IDS: Record<'live' | 'test', Record<Interval, string>> = {
  live: { month: '', year: '' },
  test: { month: '', year: '' },
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return !!origin && !!host && new URL(origin).host === host;
}

export function razorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? { keyId, keySecret } : null;
}

export function planId(interval: Interval, keyId: string): string {
  const fromEnv = interval === 'month' ? process.env.RAZORPAY_PLAN_MONTH : process.env.RAZORPAY_PLAN_YEAR;
  return fromEnv || PLAN_IDS[keyId.startsWith('rzp_live_') ? 'live' : 'test'][interval];
}

export function intervalOfPlan(plan: string, keyId: string): Interval | null {
  if (plan === planId('month', keyId)) return 'month';
  if (plan === planId('year', keyId)) return 'year';
  return null;
}

export async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error?: string }> {
  const keys = razorpayKeys();
  if (!keys) return { ok: false, status: 503 };
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: init.method ?? 'GET',
      headers: { authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString('base64')}`, 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: (data as { error?: { description?: string } }).error?.description };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 502 };
  }
}

// HMAC-SHA256 signatures, compared in constant time.
export function signatureMatches(payload: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || signature.length > 200) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const supabaseUrl = () => process.env.VITE_SUPABASE_URL ?? '';
const publishableKey = () => process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

// Who is calling, according to Supabase. Never trusts an id sent by the browser.
export async function signedInUser(request: Request): Promise<{ id: string; email: string | null } | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!token || !supabaseUrl()) return null;
  try {
    const response = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: publishableKey(), authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string; email?: string };
    return user.id ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}

export const adminReady = () => !!supabaseUrl() && !!process.env.SUPABASE_SECRET_KEY;

// Database access as the server. The secret key bypasses Row Level Security, so this file
// only ever touches the subscription tables, and only for the account it has verified.
export async function admin<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  try {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
      method: init.method ?? 'GET',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: init.prefer ?? 'return=representation' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const text = await response.text();
    return { ok: true, data: (text ? JSON.parse(text) : null) as T };
  } catch {
    return { ok: false, status: 502 };
  }
}

export type SubscriptionRow = { user_id: string; plan: 'free' | 'plus'; status: string; provider: string | null; provider_subscription_id: string | null; current_period_end: string | null; cancel_at_period_end: boolean };
export type RazorpaySubscription = { id: string; plan_id: string; status: string; current_start: number | null; current_end: number | null; charge_at: number | null; notes?: Record<string, string> };

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

// Turns what Razorpay says about a subscription into the account's plan, and records why.
export async function applyRazorpayState(userId: string, sub: RazorpaySubscription, event: string): Promise<boolean> {
  const keys = razorpayKeys();
  if (!keys) return false;
  const interval = intervalOfPlan(sub.plan_id, keys.keyId);
  if (!interval) return false;
  // Razorpay statuses: created, authenticated, active, pending (payment retrying), halted,
  // cancelled, completed, expired, paused.
  const status = sub.status === 'active' || sub.status === 'authenticated' ? 'active'
    : sub.status === 'pending' ? 'pending'
      : sub.status === 'cancelled' ? 'cancelled'
        : sub.status === 'created' ? null
          : 'expired';
  if (!status) return true; // Nothing paid yet: stay on Free.
  const start = sub.current_start ?? Math.floor(Date.now() / 1000);
  const end = sub.current_end ?? (interval === 'year' ? start + 365 * 86400 : start + 31 * 86400);
  // A cancellation keeps Plus for the time already paid for; it ends with the period.
  const paidUp = status === 'cancelled' && end * 1000 > Date.now();
  const patch = {
    plan: 'plus', status: paidUp ? 'active' : status, billing_interval: interval, current_period_start: iso(start), current_period_end: iso(end),
    provider: 'razorpay', provider_subscription_id: sub.id, cancel_at_period_end: paidUp,
  };
  const updated = await admin<SubscriptionRow[]>(`subscriptions?user_id=eq.${userId}`, { method: 'PATCH', body: patch });
  if (!updated.ok || !updated.data?.length) return false;
  await admin('subscription_events', { method: 'POST', body: { user_id: userId, event_type: event, plan: 'plus', status, details: { subscription_id: sub.id, razorpay_status: sub.status, interval } }, prefer: 'return=minimal' });
  return true;
}
