import { createHmac, timingSafeEqual } from 'node:crypto';

// Razorpay Standard Checkout, step 3: confirm the payment really came from Razorpay by checking
// its signature, HMAC-SHA256(order_id + "|" + payment_id) with the key secret.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

export async function POST(request: Request): Promise<Response> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return json({ error: 'Checkout is not set up on this site yet.' }, 503);

  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) return json({ error: 'Not allowed.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text()) ?? {};
  } catch {
    return json({ error: 'That request was not in the expected shape.' }, 400);
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!isId(orderId) || !isId(paymentId) || !isId(signature)) return json({ verified: false, error: 'Payment details are missing.' }, 400);

  const expected = Buffer.from(createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex'));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return json({ verified: false, error: 'This payment could not be confirmed. If money left your account, keep the payment reference from Razorpay’s email.' }, 400);
  }
  return json({ verified: true, payment_id: paymentId });
}
