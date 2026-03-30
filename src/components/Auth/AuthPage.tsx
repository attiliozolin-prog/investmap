'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp } from 'lucide-react';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'signup' | 'forgot-password';

export default function AuthPage() {
  const { signIn, signUp, requestPasswordReset, resendConfirmationEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

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
      const { error } = await signUp(email, password);
      if (error) setError(translateError(error));
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    } else if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(translateError(error));
    } else if (mode === 'forgot-password') {
      const { error } = await requestPasswordReset(email);
      if (error) setError(translateError(error));
      else setSuccess('Link de recuperação enviado para o seu e-mail!');
    }

    setLoading(false);
  };

  const handleResend = async () => {
    if (!email) {
      setError('Digite seu e-mail primeiro.');
      return;
    }
    setResendLoading(true);
    const { error } = await resendConfirmationEmail(email);
    if (error) setError(translateError(error));
    else setSuccess('E-mail de confirmação enviado! Verifique sua caixa de entrada.');
    setResendLoading(false);
  };

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
    if (msg.includes('Too many requests')) return 'Muitas solicitações. Tente daqui a pouco.';
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

          {mode !== 'forgot-password' && (
            <div className={styles.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="auth-password" className={styles.label}>Senha</label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    className={styles.toggleBtn} 
                    style={{ fontSize: '0.75rem', marginBottom: '8px' }}
                    onClick={() => { setMode('forgot-password'); setError(null); setSuccess(null); }}
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
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
          )}

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

          {error && (
            <div className={styles.error}>
              {error}
              {error.includes('Confirme seu e-mail') && (
                <button 
                  type="button" 
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{ 
                    display: 'block', 
                    marginTop: '8px', 
                    background: 'none', 
                    border: 'none', 
                    color: '#8B5CF6', 
                    fontWeight: 600, 
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: 0
                  }}
                >
                  {resendLoading ? 'Enviando...' : 'Reenviar e-mail de confirmação'}
                </button>
              )}
            </div>
          )}
          {success && <div className={styles.success}>{success}</div>}

          <button
            id="auth-submit-btn"
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : 
             mode === 'login' ? 'Entrar' : 
             mode === 'signup' ? 'Criar conta' : 'Enviar link de recuperação'}
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
          ) : mode === 'signup' ? (
            <>
              <span>Já tem conta?</span>
              <button className={styles.toggleBtn} onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
                Entrar
              </button>
            </>
          ) : (
            <button className={styles.toggleBtn} onClick={() => { setMode('login'); setError(null); setSuccess(null); }}>
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
