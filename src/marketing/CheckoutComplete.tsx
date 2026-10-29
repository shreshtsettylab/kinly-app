import { useState } from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';
import { checkoutResultFromUrl } from '../checkout';
import { Link } from '../Link';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

// Shown after the server has verified a Razorpay payment. The message is for the visitor only;
// the Razorpay dashboard is the record of what was paid.
export default function CheckoutComplete() {
  const [returning] = useState(hasSavedData);
  const [{ status, paymentId }] = useState(checkoutResultFromUrl);
  const succeeded = status === 'succeeded';
  const title = succeeded ? 'Thank you for supporting Kinly.' : 'Back from checkout.';
  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-auth lp-auth-single">
      <div className="lp-auth-card" data-clarity-mask="True">
        <span className="lp-tag">Checkout</span>
        <h1 className="lp-auth-title">{title}</h1>
        {succeeded && <p className="lp-auth-lead lp-auth-ok-line"><Check size={16} /> Your payment is confirmed. Razorpay will email your receipt.</p>}
        {!succeeded && <p className="lp-auth-lead">If you completed a payment, Razorpay will email your receipt. If you didn’t, nothing was charged.</p>}
        {paymentId && <div className="lp-auth-notice" role="note"><Info size={16} /><div>Payment reference: <b>{paymentId}</b>. Keep it if you need help with this payment.</div></div>}
        <div className="lp-auth-done-actions">
          <Link to="/app" className="lp-button lp-button-primary">{returning ? 'Open Kinly' : 'Try Kinly'} <ArrowRight size={15} /></Link>
          {!succeeded && <Link to="/#pricing" className="lp-button lp-button-quiet">Back to pricing</Link>}
        </div>
      </div>
    </main>
    <MarketingFooter />
  </div>;
}
