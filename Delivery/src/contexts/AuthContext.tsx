import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppUser } from '../types';
import { db, isAllowedAdminEmail } from '../supabaseClient';

interface AuthContextValue {
  currentUser: AppUser | null;
  isAdminUser: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (nome: string, telefone: string, endereco: string) => Promise<AppUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isAdminUser =
    !!currentUser &&
    isAllowedAdminEmail(currentUser.email) &&
    currentUser.tipo_usuario === 'admin';

  // Load user on mount
  useEffect(() => {
    db.getCurrentUser()
      .then((user) => { if (user) setCurrentUser(user); })
      .catch(console.error);
  }, []);

  const signIn = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      await db.signInWithGoogle();
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await db.signOut();
    setCurrentUser(null);
    window.location.reload();
  }, []);

  const updateProfile = useCallback(async (nome: string, telefone: string, endereco: string) => {
    const updated = await db.updateCurrentUserProfile(nome, telefone, endereco);
    if (updated) setCurrentUser(updated);
    return updated;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAdminUser, isLoggingIn, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
