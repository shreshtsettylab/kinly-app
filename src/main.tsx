import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root.tsx';
import './index.css';
import './marketing/marketing.css';
import { openAppForReturningUsers } from './startRoute';

openAppForReturningUsers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
