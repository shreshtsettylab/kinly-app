import { admin, adminReady, applyRazorpayState, json, razorpay, razorpayKeys, sameOrigin, signatureMatches, signedInUser, type RazorpaySubscription, type SubscriptionRow } from './_plus';

// Kinly Plus, step 2: after checkout, confirm the payment really came from Razorpay
// (HMAC-SHA256 of payment_id|subscription_id with the key secret), that the subscription
// belongs to this account, and then switch the account to Plus from Razorpay's own record.

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

export async function POST(request: Request): Promise<Response> {
  const keys = razorpayKeys();
  if (!keys || !adminReady()) return json({ error: 'Plus payments aren’t available yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Not allowed.' }, 403);
  const user = await signedInUser(request);
  if (!user) return json({ code: 'signed_out', error: 'Sign in again to finish upgrading.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text()) ?? {};
  } catch {
    return json({ error: 'That request was not in the expected shape.' }, 400);
  }
  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = body;
  if (!isId(paymentId) || !isId(subscriptionId) || !isId(signature)) return json({ error: 'Payment details are missing.' }, 400);
  if (!signatureMatches(`${paymentId}|${subscriptionId}`, signature, keys.keySecret)) {
    return json({ error: 'This payment could not be confirmed. If money left your account, keep the payment reference from Razorpay’s email and contact us.' }, 400);
  }

  const current = await admin<SubscriptionRow[]>(`subscriptions?user_id=eq.${user.id}&select=user_id,plan,status,provider,provider_subscription_id,current_period_end,cancel_at_period_end`);
  if (!current.ok || current.data[0]?.provider_subscription_id !== subscriptionId) return json({ error: 'This subscription doesn’t belong to your account.' }, 403);

  const sub = await razorpay<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!sub.ok || sub.data.notes?.user_id !== user.id) return json({ error: 'Kinly couldn’t confirm your subscription with Razorpay yet. It will update automatically within a few minutes.' }, 502);
  if (!await applyRazorpayState(user.id, sub.data, 'payment_verified')) return json({ error: 'Your payment went through, but Kinly couldn’t update your plan yet. It will update automatically within a few minutes.' }, 502);

  return json({ ok: true, payment_id: paymentId });
}
