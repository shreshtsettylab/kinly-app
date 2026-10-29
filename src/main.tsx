import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root.tsx';
import './index.css';
import './marketing/marketing.css';
import { loadAnalytics } from './analytics';
import { openAppForReturningUsers } from './startRoute';

openAppForReturningUsers();
loadAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
