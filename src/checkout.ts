// Razorpay hosted checkout: Kinly links to a Razorpay Payment Page (or Payment Link) created in
// the Razorpay dashboard, so no API keys or secrets live in the browser. The amount and product
// details are set in Razorpay. Only Razorpay-hosted addresses are accepted.
const paymentUrl = (import.meta.env.VITE_RAZORPAY_PAYMENT_URL as string | undefined)?.trim() ?? '';
const live = import.meta.env.VITE_RAZORPAY_MODE === 'live';

function isRazorpayUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['rzp.io', 'pages.razorpay.com', 'razorpay.me'].includes(url.hostname);
  } catch {
    return false;
  }
}

export const checkoutAvailable = isRazorpayUrl(paymentUrl);
// Test vs live is decided by which Razorpay mode the page was created in; this only sets the label.
export const checkoutIsTest = !live;
export const checkoutProvider = 'Razorpay';

export function checkoutUrl(): string {
  return paymentUrl;
}

// What Razorpay appends when it redirects back (Payment Links add razorpay_payment_link_status;
// Payment Pages add the payment id). For display only: payments are confirmed in the Razorpay
// dashboard, never by these browser parameters.
export function checkoutResultFromUrl(): { status: string; paymentId: string } {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('razorpay_payment_id') ?? params.get('payment_id') ?? '';
  const linkStatus = params.get('razorpay_payment_link_status') ?? params.get('status') ?? '';
  const status = linkStatus === 'paid' || linkStatus === 'succeeded' || (!linkStatus && paymentId) ? 'succeeded'
    : linkStatus === 'cancelled' ? 'cancelled'
      : linkStatus ? 'failed' : '';
  return { status, paymentId };
}
