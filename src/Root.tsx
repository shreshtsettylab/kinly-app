import { useEffect } from 'react';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { Account, AuthCallback, ResetPassword } from './marketing/AuthPages';
import Landing from './marketing/Landing';
import NotFound from './marketing/NotFound';
import CheckoutComplete from './marketing/CheckoutComplete';
import SignIn from './marketing/SignIn';
import { useRoute, type Route } from './router';

const titles: Record<Route, string> = {
  landing: 'Kinly — Your people. A more intentional tomorrow.',
  app: 'Kinly — Your space',
  signin: 'Sign in — Kinly',
  callback: 'Signing you in — Kinly',
  reset: 'Reset your password — Kinly',
  account: 'Your account — Kinly',
  checkout: 'Checkout — Kinly',
  notfound: 'Page not found — Kinly',
};

function Screen({ route }: { route: Route }) {
  if (route === 'app') return <App />;
  if (route === 'signin') return <SignIn />;
  if (route === 'callback') return <AuthCallback />;
  if (route === 'reset') return <ResetPassword />;
  if (route === 'account') return <Account />;
  if (route === 'checkout') return <CheckoutComplete />;
  if (route === 'notfound') return <NotFound />;
  return <Landing />;
}

export default function Root() {
  const route = useRoute();
  useEffect(() => { document.title = titles[route]; }, [route]);
  return <AuthProvider><Screen route={route} /></AuthProvider>;
}
