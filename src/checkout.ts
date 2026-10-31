// Razorpay Standard Checkout. The server creates the order (api/create-order.ts) and checks the
// signature afterwards (api/verify-payment.ts); the browser only ever sees the public key id.
const keyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim() ?? '';

export const checkoutAvailable = /^rzp_(test|live)_\w+$/.test(keyId);
// Test keys never move real money.
export const checkoutIsTest = !keyId.startsWith('rzp_live_');

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void };

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

// Razorpay's script loads only when someone starts a payment, not on every page.
let scriptLoading: Promise<void> | null = null;
export function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      script.remove();
      reject(new Error('Razorpay checkout couldn’t load. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Kinly couldn’t reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
  return data as T;
}

export type CheckoutOutcome = { status: 'succeeded'; paymentId: string } | { status: 'closed'; failure?: string };

// Opens the Razorpay window. Resolves once the payment is verified on the server, or when the
// window is closed (with the last failure reason, if a payment attempt failed). Throws on errors.
export async function startCheckout(): Promise<CheckoutOutcome> {
  const [order] = await Promise.all([post<{ order_id: string; amount: number; currency: string }>('/api/create-order'), loadCheckoutScript()]);
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout couldn’t load. Try again.');
  return new Promise((resolve, reject) => {
    let failure: string | undefined;
    const checkout = new Razorpay({
      key: keyId,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Kinly',
      description: 'Support Kinly early',
      theme: { color: '#202833' },
      handler: (payment: RazorpaySuccess) => {
        post('/api/verify-payment', payment).then(() => resolve({ status: 'succeeded', paymentId: payment.razorpay_payment_id }), reject);
      },
      modal: { ondismiss: () => resolve({ status: 'closed', failure }) },
    });
    // Razorpay keeps its window open after a failed attempt so the person can retry.
    checkout.on('payment.failed', (response) => { failure = response.error?.description || 'The payment didn’t go through.'; });
    checkout.open();
  });
}

// Read on /checkout/complete after a verified payment. For display only: the Razorpay
// dashboard is the record of what was paid.
export function checkoutResultFromUrl(): { status: string; paymentId: string } {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment_id') ?? '';
  return { status: params.get('status') === 'succeeded' && paymentId ? 'succeeded' : '', paymentId };
}
