import { useState, type ReactNode } from 'react';
import { Link } from '../Link';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

// Terms, privacy, refund and contact pages. Razorpay reviews these when activating payments,
// so the operator details must match the KYC on the Razorpay account.
const OPERATOR = 'Shresht Setty';
const EMAIL = 'shresht.setty2027@mastersunion.org';
const LOCATION = 'Bengaluru, Karnataka, India';
const UPDATED = '31 October 2026';

export type PolicyPage = 'terms' | 'privacy' | 'refunds' | 'contact';

const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

const pages: Record<PolicyPage, { tag: string; title: string; body: ReactNode }> = {
  terms: {
    tag: 'Terms',
    title: 'Terms of use',
    body: <>
      <p>These terms apply to kinly.in and the Kinly app (“Kinly”), operated by {OPERATOR}, an individual based in {LOCATION} (“we”, “us”). By using Kinly you agree to them.</p>
      <h2>What Kinly is</h2>
      <p>Kinly is a personal tool for reflecting on your relationships, plans and decisions. Its suggestions are prompts to help you think, not professional advice. Kinly is not therapy, counselling or a crisis service. If you or someone else may be unsafe, contact local emergency services or a helpline.</p>
      <h2>Using Kinly</h2>
      <ul>
        <li>Kinly is free to use. You can use it without an account; your notes are stored in your own browser.</li>
        <li>If you create an account, keep your sign-in details safe. You’re responsible for activity on your account.</li>
        <li>Don’t misuse Kinly: no attempts to break, overload or gain unauthorised access to it, and no unlawful use.</li>
        <li>What you write in Kinly is yours. We don’t claim any rights to it.</li>
      </ul>
      <h2>Supporting Kinly early</h2>
      <p>You can make a one-time payment to support Kinly’s development. The amount is shown in the Razorpay payment window before you pay. Kinly Plus features are proposed, not yet available, and a payment doesn’t guarantee any particular feature or date. Kinly is a digital service: nothing is shipped. Refunds are covered by our <Link to="/refunds">refund policy</Link>.</p>
      <p>Payments are processed by Razorpay. We never see or store your card, UPI or bank details.</p>
      <h2>Availability and liability</h2>
      <p>We work to keep Kinly running and your data safe, but Kinly is provided “as is”, without guarantees that it will always be available or error-free. Keep your own backups (Settings → Backup). To the extent the law allows, our total liability to you is limited to the amount you paid us in the 12 months before the claim.</p>
      <h2>Changes and ending use</h2>
      <p>We may update Kinly or these terms; the date below shows the latest version. You can stop using Kinly at any time and delete your data from Settings. We may suspend access that breaks these terms.</p>
      <h2>Law</h2>
      <p>These terms are governed by the laws of India. Courts in Bengaluru, Karnataka have jurisdiction.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: <Mail />.</p>
    </>,
  },
  privacy: {
    tag: 'Privacy',
    title: 'Privacy policy',
    body: <>
      <p>Kinly can hold personal notes about the people in your life, so we collect as little as possible. This policy explains what we handle and why. Kinly is operated by {OPERATOR}, {LOCATION}.</p>
      <h2>Notes you write in Kinly</h2>
      <p>By default, your people, plans, goals, reflections and check-ins are stored only in your browser on your device. We can’t see them.</p>
      <h2>If you create an account</h2>
      <ul>
        <li>We store your email address, and your name if you sign in with Google, to run your account.</li>
        <li>If you choose “Back up my data”, a copy of your Kinly data is saved to your private account. Only you can read it: the database refuses access to anyone else.</li>
        <li>Accounts and backups are stored with Supabase in their Mumbai, India region.</li>
      </ul>
      <h2>Payments</h2>
      <p>Payments are handled by Razorpay. Razorpay collects the details needed to process your payment (such as your phone number, email and payment method) under its own privacy policy. We receive the payment reference, amount and status. We never receive your card, UPI or bank details.</p>
      <h2>Usage analytics</h2>
      <p>We use Microsoft Clarity to understand which pages and buttons people use, so we can improve Kinly. Clarity uses cookies to recognise repeat visits. Text inside the app, sign-in, account and checkout screens is masked, so Clarity never sees your notes, names or reflections.</p>
      <h2>AI features (Kinly Plus)</h2>
      <p>Kinly Plus AI features run only when you tap one. That feature’s question and related notes are sent through OpenRouter to Anthropic’s Claude to write the answer, and Kinly doesn’t store them. To count AI credits, we record which feature you used, how many credits it took, whether it worked, and when. We never record what was sent or the answer.</p>
      <h2>What we don’t do</h2>
      <p>We don’t sell your data, show ads, or share your information except with the service providers named above (Supabase, Razorpay, Microsoft Clarity, OpenRouter, Anthropic and our host, Vercel), and where the law requires it.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Export or delete the data in your browser at any time from Settings.</li>
        <li>To get a copy of, correct, or delete your account and backup, email <Mail />. We reply within 7 days.</li>
      </ul>
      <h2>Grievance contact</h2>
      <p>{OPERATOR}, <Mail />, {LOCATION}.</p>
    </>,
  },
  refunds: {
    tag: 'Refunds',
    title: 'Refund and cancellation policy',
    body: <>
      <p>Kinly is free to use. The only payment is the optional one-time “Support Kinly early” contribution.</p>
      <h2>Refunds within 7 days</h2>
      <p>If you change your mind, email <Mail /> within 7 days of paying, with your Razorpay payment reference (it starts with “pay_” and is in Razorpay’s email receipt). We’ll refund the full amount, no questions asked.</p>
      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method through Razorpay. Once we start a refund, it usually reaches your account within 5–7 business days, depending on your bank.</p>
      <h2>Duplicate or failed payments</h2>
      <p>If you were charged twice, or money left your account but the payment didn’t complete, email us at any time and we’ll refund it in full.</p>
      <h2>Cancellation</h2>
      <p>The contribution is a one-time payment, not a subscription, so there’s nothing to cancel and you won’t be charged again.</p>
      <h2>Shipping</h2>
      <p>Kinly is a digital service. Nothing is shipped.</p>
    </>,
  },
  contact: {
    tag: 'Contact',
    title: 'Contact us',
    body: <>
      <p>Questions, feedback, payment help or data requests — we’d like to hear from you.</p>
      <dl className="lp-legal-details">
        <dt>Email</dt><dd><Mail /></dd>
        <dt>Operated by</dt><dd>{OPERATOR}</dd>
        <dt>Location</dt><dd>{LOCATION}</dd>
        <dt>Response time</dt><dd>Within 2 business days</dd>
      </dl>
      <p>For payment questions, include your Razorpay payment reference (it starts with “pay_”). See also our <Link to="/refunds">refund policy</Link>, <Link to="/terms">terms</Link> and <Link to="/privacy">privacy policy</Link>.</p>
    </>,
  },
};

export default function Policy({ page }: { page: PolicyPage }) {
  const [returning] = useState(hasSavedData);
  const { tag, title, body } = pages[page];
  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-legal">
      <span className="lp-tag">{tag}</span>
      <h1>{title}</h1>
      {page !== 'contact' && <p className="lp-legal-updated">Last updated {UPDATED}</p>}
      {body}
    </main>
    <MarketingFooter />
  </div>;
}
