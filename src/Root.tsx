import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { Account, AuthCallback, ResetPassword } from './marketing/AuthPages';
import Landing from './marketing/Landing';
import NotFound from './marketing/NotFound';
import Policy from './marketing/Policies';
import CheckoutComplete from './marketing/CheckoutComplete';
import Pricing from './marketing/Pricing';
import SignIn from './marketing/SignIn';
import { useRoute, type Route } from './router';

// The app itself loads only when someone opens /app, so the landing and policy pages stay light.
const App = lazy(() => import('./App'));

const titles: Record<Route, string> = {
  landing: 'Kinly — Your people. A more intentional tomorrow.',
  app: 'Kinly — Your space',
  signin: 'Sign in — Kinly',
  callback: 'Signing you in — Kinly',
  reset: 'Reset your password — Kinly',
  account: 'Your account — Kinly',
  checkout: 'Checkout — Kinly',
  pricing: 'Pricing — Kinly Free and Plus',
  terms: 'Terms of use — Kinly',
  privacy: 'Privacy policy — Kinly',
  refunds: 'Refund policy — Kinly',
  contact: 'Contact — Kinly',
  notfound: 'Page not found — Kinly',
};

function Screen({ route }: { route: Route }) {
  if (route === 'app') return <Suspense fallback={null}><App /></Suspense>;
  if (route === 'signin') return <SignIn />;
  if (route === 'callback') return <AuthCallback />;
  if (route === 'reset') return <ResetPassword />;
  if (route === 'account') return <Account />;
  if (route === 'checkout') return <CheckoutComplete />;
  if (route === 'pricing') return <Pricing />;
  if (route === 'terms' || route === 'privacy' || route === 'refunds' || route === 'contact') return <Policy page={route} />;
  if (route === 'notfound') return <NotFound />;
  return <Landing />;
}

export default function Root() {
  const route = useRoute();
  useEffect(() => { document.title = titles[route]; }, [route]);
  return <AuthProvider><Screen route={route} /></AuthProvider>;
}
