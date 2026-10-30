import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../auth/authState';
import { Link } from '../Link';
import type { DemoAnswer, Tone } from './demoData';

export function Wordmark() {
  return <span className="lp-wordmark"><img src="/assets/kinly-icon.png" alt="" width={26} height={26} /><span>Kinly</span></span>;
}

const navLinks = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
];

export function MarketingNav({ returning, onLanding = true }: { returning: boolean; onLanding?: boolean }) {
  const [open, setOpen] = useState(false);
  const signedIn = useAuth().status === 'signedIn';
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // On the sign-in page the section links point back to the landing page.
  const href = (anchor: string) => (onLanding ? anchor : `/${anchor}`);
  // Close the mobile menu before scrolling; otherwise the panel collapsing after the jump
  // shifts the page and the section lands off-screen.
  const goToSection = (event: MouseEvent<HTMLAnchorElement>, anchor: string) => {
    setOpen(false);
    if (!onLanding) return;
    event.preventDefault();
    // React has already removed the panel when this timer runs, so the position is final.
    setTimeout(() => {
      document.getElementById(anchor.slice(1))?.scrollIntoView();
      window.history.replaceState(null, '', anchor);
    }, 0);
  };
  return <header className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
    <div className="lp-nav-inner">
      <Link to="/" className="lp-nav-brand" aria-label="Kinly home" onClick={() => setOpen(false)}><Wordmark /></Link>
      <nav className="lp-nav-links" aria-label="Main">{navLinks.map((link) => <a key={link.href} href={href(link.href)}>{link.label}</a>)}</nav>
      <div className="lp-nav-actions">
        <Link to={signedIn ? "/account" : "/signin"} className="lp-nav-signin">{signedIn ? "Account" : "Sign in"}</Link>
        <Link to="/app" className="lp-button lp-button-primary lp-button-small">{returning ? 'Open Kinly' : 'Get started'}</Link>
        <button className="lp-nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="lp-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </div>
    {open && <div className="lp-mobile-menu" id="lp-mobile-menu">
      {navLinks.map((link) => <a key={link.href} href={href(link.href)} onClick={(event) => goToSection(event, link.href)}>{link.label}</a>)}
      <Link to={signedIn ? "/account" : "/signin"} onClick={() => setOpen(false)}>{signedIn ? "Account" : "Sign in"}</Link>
      <Link to="/app" className="lp-button lp-button-primary" onClick={() => setOpen(false)}>{returning ? 'Open Kinly' : 'Get started'}</Link>
    </div>}
  </header>;
}

// Fades a section in once as it scrolls into view. Content is visible without JavaScript
// or with reduced motion; only opacity and transform change, so nothing shifts layout.
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) { setShown(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`lp-reveal ${shown ? 'lp-reveal-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function SectionIntro({ kicker, title, muted, children, id }: { kicker: string; title: string; muted?: string; children?: ReactNode; id?: string }) {
  return <div className="lp-section-intro">
    <span className="lp-tag">{kicker}</span>
    <h2 id={id}>{title}{muted && <span className="lp-muted"> {muted}</span>}</h2>
    {children && <p>{children}</p>}
  </div>;
}

export function DemoBadge() {
  return <span className="lp-demo-badge">Demo · sample people, not your data</span>;
}

export function Verdict({ tone, kicker, headline, reason }: { tone: Tone; kicker: string; headline: string; reason: string }) {
  return <div className={`lp-verdict lp-tone-${tone}`}>
    <span className="lp-verdict-mark" aria-hidden="true" />
    <div><span className="lp-verdict-kicker">{kicker}</span><h3>{headline}</h3><p>{reason}</p></div>
  </div>;
}

export function DemoResponse({ answer }: { answer: DemoAnswer }) {
  return <div className="lp-response" key={answer.id}>
    <Verdict tone={answer.tone} kicker={answer.kicker} headline={answer.headline} reason={answer.reason} />
    <dl className="lp-glance">{answer.glance.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    <div className="lp-response-sections">{answer.sections.map((section) => <div key={section.title}><span className="lp-mini-label">{section.title}</span><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div>
    <p className="lp-in-app"><b>In Kinly:</b> {answer.inApp}</p>
  </div>;
}

export function MarketingFooter() {
  const signedIn = useAuth().status === 'signedIn';
  return <footer className="lp-footer">
    <div className="lp-footer-inner">
      <div className="lp-footer-brand"><Wordmark /><p>Your people. A more intentional tomorrow.</p></div>
      <nav className="lp-footer-links" aria-label="Footer">
        <a href="/#product">Product</a>
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
        <a href="/#privacy">Privacy</a>
        <Link to={signedIn ? "/account" : "/signin"}>{signedIn ? "Account" : "Sign in"}</Link>
      </nav>
    </div>
    <p className="lp-footer-note">© {new Date().getFullYear()} Kinly · Your data stays in your browser.</p>
    <nav className="lp-footer-legal" aria-label="Policies">
      <Link to="/pricing">Pricing</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy policy</Link>
      <Link to="/refunds">Refunds</Link>
      <Link to="/contact">Contact</Link>
    </nav>
  </footer>;
}
