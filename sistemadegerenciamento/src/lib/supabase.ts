import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const googleRedirectUrl = typeof window !== 'undefined' ? window.location.origin : '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Admin] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY nao definidos no .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    options: { redirectTo: googleRedirectUrl },
  });

export const signOut = () => supabase.auth.signOut();
