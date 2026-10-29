import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigateTo } from './router';

// A real <a href> (so it works with middle-click and screen readers) that navigates in place.
export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigateTo(to);
  };
  return <a href={to} onClick={handle} {...props} />;
}
