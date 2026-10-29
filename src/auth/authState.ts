import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedIn' | 'signedOut';
export type AuthState = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  configError: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({ status: 'unconfigured', session: null, user: null, configError: null, signOut: async () => {} });

export const useAuth = () => useContext(AuthContext);

export function displayName(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email || 'Your account';
}

// Where to go after signing in. Only same-site paths are allowed, so a crafted link can't
// send someone to another website after they sign in.
const NEXT_KEY = 'kinly-auth-next';

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/app';
  if (value.startsWith('/signin') || value.startsWith('/auth/')) return '/app';
  return value;
}

export function rememberNext(path: string) {
  try { window.sessionStorage.setItem(NEXT_KEY, safeNext(path)); } catch { /* storage unavailable */ }
}

export function takeNext(): string {
  try {
    const value = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
    return safeNext(value);
  } catch {
    return '/app';
  }
}

export const authUrl = (path: string) => `${window.location.origin}${path}`;
