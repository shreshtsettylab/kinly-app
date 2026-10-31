import { admin, adminReady, json, razorpay, razorpayKeys, sameOrigin, signedInUser, type SubscriptionRow } from './_plus.js';

// Cancels Kinly Plus at the end of the current billing period. Plus keeps working until then;
// Razorpay's webhook moves the account back to Free when the period ends.

export async function POST(request: Request): Promise<Response> {
  if (!razorpayKeys() || !adminReady()) return json({ error: 'Subscription changes aren’t available yet. Contact us and we’ll help.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const user = await signedInUser(request);
  if (!user) return json({ code: 'signed_out', error: 'Sign in again to manage your subscription.' }, 401);

  const current = await admin<SubscriptionRow[]>(`subscriptions?user_id=eq.${user.id}&select=user_id,plan,status,provider,provider_subscription_id,current_period_end,cancel_at_period_end`);
  const row = current.ok ? current.data[0] : undefined;
  if (!row || row.plan !== 'plus' || row.provider !== 'razorpay' || !row.provider_subscription_id) return json({ error: 'There’s no Razorpay subscription on this account to cancel. Contact us if that seems wrong.' }, 404);
  if (row.cancel_at_period_end) return json({ ok: true, ends_at: row.current_period_end });

  const cancelled = await razorpay(`/subscriptions/${encodeURIComponent(row.provider_subscription_id)}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: 1 } });
  if (!cancelled.ok) return json({ error: 'Razorpay couldn’t cancel the subscription right now. Nothing changed. Try again shortly.' }, 502);
  await admin(`subscriptions?user_id=eq.${user.id}`, { method: 'PATCH', body: { cancel_at_period_end: true }, prefer: 'return=minimal' });
  await admin('subscription_events', { method: 'POST', body: { user_id: user.id, event_type: 'cancel_requested', plan: 'plus', status: row.status, details: { subscription_id: row.provider_subscription_id } }, prefer: 'return=minimal' });
  return json({ ok: true, ends_at: row.current_period_end });
}
