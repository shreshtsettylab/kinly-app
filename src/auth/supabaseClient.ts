import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser-safe configuration only: the project URL and the publishable (or legacy anon) key.
// Secret / service-role keys must never reach the browser, so they are refused outright.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

function looksLikeSecretKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true;
  // Legacy keys are JWTs; the payload names the role.
  const payload = value.split('.')[1];
  if (!payload) return false;
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role';
  } catch {
    return false;
  }
}

function configure(): { client: SupabaseClient | null; error: string | null } {
  if (!url || !key) return { client: null, error: null };
  if (looksLikeSecretKey(key)) {
    console.error('Kinly: a Supabase secret/service-role key was supplied. Use the publishable (anon) key instead. Sign-in is disabled.');
    return { client: null, error: 'A secret key was supplied instead of the publishable key.' };
  }
  try {
    new URL(url);
  } catch {
    return { client: null, error: 'VITE_SUPABASE_URL is not a valid URL.' };
  }
  return {
    client: createClient(url, key, {
      auth: {
        // PKCE: links and OAuth redirects carry a one-time code, never tokens in the URL.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
    error: null,
  };
}

const { client, error } = configure();

export const supabase = client;
export const authConfigured = client !== null;
export const authConfigError = error;
