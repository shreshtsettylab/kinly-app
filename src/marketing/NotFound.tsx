import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from '../Link';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

export default function NotFound() {
  const [returning] = useState(hasSavedData);
  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-auth lp-auth-single">
      <div className="lp-auth-card">
        <span className="lp-tag">404</span>
        <h1 className="lp-auth-title">This page isn’t here.</h1>
        <p className="lp-auth-lead">The link may be old or mistyped. Your saved people, plans and reflections are safe — they live in your browser, not at this address.</p>
        <div className="lp-auth-done-actions">
          <Link to="/app" className="lp-button lp-button-primary">{returning ? 'Open Kinly' : 'Try Kinly'} <ArrowRight size={15} /></Link>
          <Link to="/" className="lp-button lp-button-quiet">Go to the home page</Link>
        </div>
      </div>
    </main>
    <MarketingFooter />
  </div>;
}
