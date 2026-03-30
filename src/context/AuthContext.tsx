'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateUser: (attributes: { password?: string; data?: { full_name?: string } }) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: string | null }>;
  deleteAccountData: () => Promise<{ error: string | null }>;
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carrega sessão existente ao montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuta mudanças de auth em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // Força um reload para limpar a cache do navegador e re-renderizar AuthPage
  }, []);

  const updateUser = useCallback(async (attributes: { password?: string; data?: { full_name?: string } }) => {
    const { error } = await supabase.auth.updateUser(attributes);
    return { error: error?.message ?? null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return { error: error?.message ?? null };
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error?.message ?? null };
  }, []);

  const deleteAccountData = useCallback(async () => {
    if (!user) return { error: 'Usuário não autenticado' };
    const userId = user.id;

    try {
      // Deletar dados em ordem para evitar erros de FK
      await supabase.from('portfolio_snapshots').delete().eq('user_id', userId);
      await supabase.from('transactions').delete().eq('user_id', userId);
      await supabase.from('assets').delete().eq('user_id', userId);
      await supabase.from('strategy_categories').delete().eq('user_id', userId);
      await supabase.from('strategies').delete().eq('user_id', userId);

      await signOut();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erro ao deletar dados' };
    }
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signUp, 
      signIn, 
      signOut, 
      updateUser,
      requestPasswordReset,
      resendConfirmationEmail,
      deleteAccountData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
