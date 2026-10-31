import { admin, adminReady, json, planId, razorpay, razorpayKeys, sameOrigin, signedInUser, type Interval, type SubscriptionRow } from './_plus.js';

// Kinly Plus, step 1: create a Razorpay subscription for the signed-in account. The plan and
// price come from Razorpay plans chosen here on the server, never from the browser.

export async function POST(request: Request): Promise<Response> {
  const keys = razorpayKeys();
  let interval: Interval;
  try {
    const body = JSON.parse(await request.text()) as { interval?: unknown };
    if (body.interval !== 'month' && body.interval !== 'year') throw new Error();
    interval = body.interval;
  } catch {
    return json({ error: 'That request was not in the expected shape.' }, 400);
  }
  if (!keys || !adminReady() || !planId(interval, keys.keyId)) return json({ code: 'unavailable', error: 'Plus payments aren’t available yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);

  const user = await signedInUser(request);
  if (!user) return json({ code: 'signed_out', error: 'Sign in to upgrade to Kinly Plus.' }, 401);

  const current = await admin<SubscriptionRow[]>(`subscriptions?user_id=eq.${user.id}&select=user_id,plan,status,provider,provider_subscription_id,current_period_end,cancel_at_period_end`);
  if (!current.ok || !current.data.length) return json({ error: 'Kinly couldn’t read your plan. Nothing was charged. Try again shortly.' }, 502);
  const row = current.data[0];
  if (row.plan === 'plus' && ['active', 'trial', 'pending'].includes(row.status) && row.current_period_end && Date.parse(row.current_period_end) > Date.now()) {
    return json({ code: 'already_plus', error: 'You already have Kinly Plus.' }, 409);
  }

  const created = await razorpay<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: { plan_id: planId(interval, keys.keyId), total_count: interval === 'year' ? 10 : 120, customer_notify: 1, notes: { user_id: user.id } },
  });
  if (!created.ok) return json({ error: 'Razorpay couldn’t start your subscription. Nothing was charged. Try again shortly.' }, created.status === 401 ? 503 : 502);

  // Remember which subscription belongs to this account; the plan changes only once it's paid.
  const saved = await admin(`subscriptions?user_id=eq.${user.id}`, { method: 'PATCH', body: { provider: row.plan === 'free' ? 'razorpay' : row.provider, provider_subscription_id: created.data.id }, prefer: 'return=minimal' });
  if (!saved.ok) return json({ error: 'Kinly couldn’t save your subscription. Nothing was charged. Try again shortly.' }, 502);
  await admin('subscription_events', { method: 'POST', body: { user_id: user.id, event_type: 'checkout_started', plan: row.plan, status: row.status, details: { subscription_id: created.data.id, interval } }, prefer: 'return=minimal' });

  return json({ subscription_id: created.data.id, key_id: keys.keyId });
}
