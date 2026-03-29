'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp } from 'lucide-react';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password);
      if (error) {
        setError(translateError(error));
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(translateError(error));
      }
      // Se login ok, o AuthContext atualiza automaticamente e o app renderiza
    }

    setLoading(false);
  };

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
    return msg;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <TrendingUp size={20} />
          </div>
          <h1 className={styles.logoText}>InvestMap</h1>
          <p className={styles.tagline}>
            {mode === 'login' ? 'Acesse sua carteira' : 'Crie sua conta gratuita'}
          </p>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="auth-email" className={styles.label}>E-mail</label>
            <input
              id="auth-email"
              type="email"
              className={`input ${styles.input}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="auth-password" className={styles.label}>Senha</label>
            <input
              id="auth-password"
              type="password"
              className={`input ${styles.input}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor="auth-confirm" className={styles.label}>Confirmar senha</label>
              <input
                id="auth-confirm"
                type="password"
                className={`input ${styles.input}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <button
            id="auth-submit-btn"
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {/* Toggle mode */}
        <div className={styles.toggle}>
          {mode === 'login' ? (
            <>
              <span>Não tem conta?</span>
              <button className={styles.toggleBtn} onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}>
                Criar conta
              </button>
            </>
          ) : (
            <>
              <span>Já tem conta?</span>
              <button className={styles.toggleBtn} onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
