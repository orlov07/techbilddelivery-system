import { useState } from 'react';
import { signInWithGoogle } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import type { AdminAuthState } from '../hooks/useAdminAuth';
import logo from '../components/img/logo.png';

interface Props { auth: AdminAuthState; }

export function AdminLogin({ auth }: Props) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try { await signInWithGoogle(); } catch { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0e0e0f] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161618] p-8 text-center shadow-2xl">
        <div className="mb-6 flex justify-center">
          <img
            src={logo}
            alt="TechBild"
            className="h-20 w-20 rounded-2xl border border-[#f97316]/20 bg-white/5 object-cover p-2 shadow-[0_0_24px_rgba(249,115,22,0.18)]"
          />
        </div>
        <h1 className="font-['Syne'] text-2xl font-extrabold text-white mb-1">TechBild Admin</h1>
        <p className="text-sm text-neutral-500 mb-6">Acesso restrito a administradores</p>
        {auth.error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {auth.error}
          </div>
        )}
        <Button onClick={handleLogin} disabled={loading || auth.loading} size="lg" className="w-full justify-center">
          {loading || auth.loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Aguardando...
            </span>
          ) : (
            'Entrar com Google'
          )}
        </Button>
      </div>
    </div>
  );
}
