import { useEffect } from 'react';
import App from './App';
import Landing from './marketing/Landing';
import SignIn from './marketing/SignIn';
import { useRoute } from './router';

const titles = {
  landing: 'Kinly — Make space for what matters',
  app: 'Kinly — Your space',
  signin: 'Sign in — Kinly',
};

export default function Root() {
  const route = useRoute();
  useEffect(() => { document.title = titles[route]; }, [route]);
  if (route === 'app') return <App />;
  if (route === 'signin') return <SignIn />;
  return <Landing />;
}
