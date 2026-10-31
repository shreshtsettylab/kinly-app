import { admin, adminReady, applyRazorpayState, json, signatureMatches, type RazorpaySubscription, type SubscriptionRow } from './_plus';

// Razorpay tells Kinly about renewals, failed payments and cancellations here. Every delivery
// is checked against RAZORPAY_WEBHOOK_SECRET (HMAC-SHA256 of the raw body) and applied once,
// even when Razorpay retries it. Webhook URL: https://www.kinly.in/api/razorpay-webhook

type WebhookBody = { event?: string; payload?: { subscription?: { entity?: RazorpaySubscription } } };

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !adminReady()) return json({ error: 'Not set up.' }, 503);

  const raw = await request.text();
  if (raw.length > 100_000 || !signatureMatches(raw, request.headers.get('x-razorpay-signature'), secret)) return json({ error: 'Invalid signature.' }, 400);

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid body.' }, 400);
  }
  const event = body.event ?? '';
  const sub = body.payload?.subscription?.entity;
  if (!event.startsWith('subscription.') || !sub?.id) return json({ ok: true, ignored: true });

  // Record the delivery first; a duplicate means it was already applied.
  const eventId = (request.headers.get('x-razorpay-event-id') ?? `${event}:${sub.id}:${sub.current_end ?? ''}:${sub.status}`).slice(0, 100);
  const recorded = await admin<unknown[]>('razorpay_events?on_conflict=event_id', { method: 'POST', body: { event_id: eventId, event_type: event.slice(0, 60), subscription_id: sub.id }, prefer: 'resolution=ignore-duplicates,return=representation' });
  if (!recorded.ok) return json({ error: 'Could not record the event.' }, 500);
  if (!recorded.data.length) return json({ ok: true, duplicate: true });

  // The subscription must be the one this account started; old, abandoned checkouts are ignored.
  const found = await admin<SubscriptionRow[]>(`subscriptions?provider_subscription_id=eq.${encodeURIComponent(sub.id)}&select=user_id,plan,status,provider,provider_subscription_id,current_period_end,cancel_at_period_end`);
  const row = found.ok ? found.data[0] : undefined;
  if (!row || (sub.notes?.user_id && sub.notes.user_id !== row.user_id)) return json({ ok: true, ignored: true });

  if (!await applyRazorpayState(row.user_id, sub, `razorpay_${event.replace('subscription.', '')}`)) {
    // Let Razorpay retry later instead of losing the update.
    await admin(`razorpay_events?event_id=eq.${encodeURIComponent(eventId)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return json({ error: 'Could not apply the event.' }, 500);
  }
  return json({ ok: true });
}
