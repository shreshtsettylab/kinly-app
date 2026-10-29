import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

// Plain-language messages for the errors people actually hit. Anything unexpected falls back
// to a generic line rather than showing raw server text.
const messages: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match. Check them, or reset your password.',
  email_not_confirmed: 'Please confirm your email first. We can send the confirmation link again.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'Choose a stronger password — at least 8 characters, mixing letters and numbers.',
  same_password: 'Your new password must be different from the old one.',
  email_address_invalid: 'That email address doesn’t look right.',
  over_email_send_rate_limit: 'Too many emails sent recently. Wait a minute, then try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  signup_disabled: 'New sign-ups are switched off right now.',
  email_provider_disabled: 'Email sign-in is switched off right now. Try Google instead.',
  provider_disabled: 'That sign-in method is switched off right now.',
  otp_expired: 'That link has expired. Request a new one.',
  flow_state_expired: 'That link has expired. Request a new one.',
  flow_state_not_found: 'That link was opened in a different browser, or has already been used. Request a new one here.',
  bad_code_verifier: 'That link was opened in a different browser. Open it in the browser where you started, or request a new one.',
  session_expired: 'Your session has expired. Please sign in again.',
};

export function friendlyAuthError(error: unknown): string {
  if (isAuthError(error) && error.code && messages[error.code]) return messages[error.code];
  // Network failures arrive wrapped as a retryable fetch error (or a bare TypeError).
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return 'Couldn’t reach the sign-in service. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export const errorCode = (error: unknown) => (isAuthError(error) ? error.code : undefined);

// Errors that providers and Supabase put on the callback URL (?error=… or #error=…).
export function errorFromUrl(): { code: string; description: string } | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = query.get('error_code') || hash.get('error_code') || query.get('error') || hash.get('error');
  if (!code) return null;
  return { code, description: query.get('error_description') || hash.get('error_description') || '' };
}

export function friendlyUrlError({ code, description }: { code: string; description: string }): string {
  if (code === 'access_denied' && /cancel|denied|declin/i.test(description || code)) return 'Google sign-in was cancelled. Nothing was changed — you can try again whenever you like.';
  if (code === 'access_denied') return 'Sign-in was cancelled or not allowed. You can try again.';
  if (code === 'otp_expired') return 'That link has expired or was already used. Request a new one.';
  return messages[code] ?? 'Sign-in didn’t complete. Please try again.';
}
