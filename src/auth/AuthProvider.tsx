import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthState, type AuthStatus } from './authState';
import { authConfigError, supabase } from './supabaseClient';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Supabase restores the saved session (and finishes any ?code= exchange) before this
    // fires INITIAL_SESSION, then keeps us in step with sign-ins, sign-outs and refreshes,
    // including those made in other tabs.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    status,
    session,
    user: session?.user ?? null,
    configError: authConfigError,
    signOut: async () => {
      if (!supabase) return;
      // "local" signs out this browser only, which is what a Sign out button means here.
      await supabase.auth.signOut({ scope: 'local' });
    },
  }), [status, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
