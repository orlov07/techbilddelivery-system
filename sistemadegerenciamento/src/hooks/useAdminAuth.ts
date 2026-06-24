import { useEffect, useState, useCallback } from 'react';
import { supabase, isAdminEmail } from '../lib/supabase';
import type { AppUser } from '../types';

export interface AdminAuthState {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  error: string;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    loading: true,
    isAdmin: false,
    error: '',
  });

  const loadUser = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setState({ user: null, loading: false, isAdmin: false, error: '' });
        return;
      }

      const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

      if (error || !data) {
        const message = (error as { message?: string; code?: string } | null)?.message?.toLowerCase() || '';
        const isServerPolicyError =
          message.includes('infinite recursion')
          || message.includes('stack depth')
          || message.includes('internal server error')
          || message.includes('500');

        setState({
          user: null,
          loading: false,
          isAdmin: false,
          error: isServerPolicyError
            ? 'O Supabase do painel admin esta com erro de permissao/RLS. Execute o SQL de correcao supabase-admin-auth-fix.sql no projeto e tente novamente.'
            : 'Seu perfil admin nao foi encontrado. Entre novamente com a conta autorizada.',
        });
        return;
      }

      const appUser = data as AppUser;
      const isAdmin = appUser.tipo_usuario === 'admin' && isAdminEmail(appUser.email);

      if (!isAdmin) {
        setState({
          user: null,
          loading: false,
          isAdmin: false,
          error: 'Esta conta nao possui permissao de administrador.',
        });
        return;
      }

      setState({ user: appUser, loading: false, isAdmin: true, error: '' });
    } catch {
      setState({
        user: null,
        loading: false,
        isAdmin: false,
        error: 'Nao foi possivel validar sua sessao. Tente entrar novamente.',
      });
    }
  }, []);

  useEffect(() => {
    loadUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  return { ...state, reload: loadUser };
}
