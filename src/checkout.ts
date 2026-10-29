// Dodo Payments hosted checkout via a static payment link: Kinly only builds a URL to Dodo's
// checkout page, so no API keys live in the browser. The price and product details are set in
// the Dodo dashboard. Test mode is the default, so nothing can charge real money by accident.
const productId = (import.meta.env.VITE_DODO_PRODUCT_ID as string | undefined)?.trim() ?? '';
const live = import.meta.env.VITE_DODO_MODE === 'live';

export const checkoutAvailable = /^pdt_[A-Za-z0-9]+$/.test(productId);
export const checkoutIsTest = !live;

export function checkoutUrl(email?: string | null): string {
  const host = live ? 'https://checkout.dodopayments.com' : 'https://test.checkout.dodopayments.com';
  const params = new URLSearchParams({ quantity: '1', redirect_url: `${window.location.origin}/checkout/complete` });
  if (email) params.set('email', email);
  return `${host}/buy/${encodeURIComponent(productId)}?${params.toString()}`;
}

// What Dodo appends to redirect_url. This is for display only: payments are confirmed by Dodo
// (dashboard / webhook), never by these browser parameters.
export function checkoutResultFromUrl(): { status: string; paymentId: string } {
  const params = new URLSearchParams(window.location.search);
  return { status: params.get('status') ?? '', paymentId: params.get('payment_id') ?? '' };
}
