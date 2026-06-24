import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const ADMIN_APP_URL = 'https://sysstemdelivery.web.app/';

function getGoogleRedirectUrl() {
  if (typeof window === 'undefined') return ADMIN_APP_URL;

  const origin = window.location.origin;
  const configuredUrl = (import.meta.env.VITE_GOOGLE_REDIRECT_URL as string | undefined)?.trim();

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }

  if (origin.includes('sysstemdelivery.web.app')) {
    return ADMIN_APP_URL;
  }

  if (configuredUrl?.includes('sysstemdelivery.web.app')) {
    return configuredUrl;
  }

  return ADMIN_APP_URL;
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Admin] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY nao definidos no .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Admin email comes from VITE_ADMIN_EMAIL — never hardcoded in source.
const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const parseAdminEmails = (...sources: unknown[]) =>
  Array.from(
    new Set(
      sources
        .flatMap((source) => String(source || '').split(','))
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );

export const ADMIN_EMAILS = parseAdminEmails(
  import.meta.env.VITE_ADMIN_EMAILS as string | undefined,
  import.meta.env.VITE_ADMIN_EMAIL as string | undefined,
  'igor.vianaaidev@gmail.com,techbildellivery@gmail.com,igoraguiarviana@gmail.com'
);
export const ADMIN_EMAIL = ADMIN_EMAILS[0] || '';
export const isAdminEmail = (email?: string | null) => ADMIN_EMAILS.includes(normalizeEmail(email));

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getGoogleRedirectUrl() },
  });

export const signOut = () => supabase.auth.signOut();
