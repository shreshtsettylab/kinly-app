// Razorpay Standard Checkout, step 1: create an order. The amount is set here on the server, so
// the browser can't pick its own price. The key secret lives only in this function's environment.

const DEFAULT_AMOUNT_PAISE = 9900; // ₹99 placeholder until pricing is decided

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return json({ error: 'Checkout is not set up on this site yet.' }, 503);

  // Only accept calls from Kinly's own pages.
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) return json({ error: 'Not allowed.' }, 403);

  const amount = Number(process.env.RAZORPAY_AMOUNT_PAISE || DEFAULT_AMOUNT_PAISE);
  if (!Number.isInteger(amount) || amount < 100) return json({ error: 'Checkout is not set up correctly on this site.' }, 500);

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'INR', receipt: `kinly_${Date.now()}`, notes: { product: 'Support Kinly early' } }),
    });
    if (response.status === 401) return json({ error: 'Checkout is not set up correctly on this site.' }, 401);
    if (!response.ok) return json({ error: 'Razorpay could not start the payment. Try again shortly.' }, 500);
    const order = await response.json() as { id: string; amount: number; currency: string };
    return json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch {
    return json({ error: 'Razorpay could not be reached. Try again shortly.' }, 500);
  }
}
