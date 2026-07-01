'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'signup' | 'forgot-password';

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, requestPasswordReset, resendConfirmationEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      else {
        const parts = email.split('@');
        const masked = parts[0].slice(0, 3) + '***@' + parts[1];
        setSuccess(`Link de recuperação enviado para ${masked}`);
      }
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError('Não foi possível entrar com Google. Tente novamente.');
      setGoogleLoading(false);
    }
    // Se não houve erro, o Supabase redireciona automaticamente
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
              <div className={styles.passwordWrapper}>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input ${styles.input}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor="auth-confirm" className={styles.label}>Confirmar senha</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  className={`input ${styles.input}`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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

        {/* Google OAuth — só em login e signup */}
        {mode !== 'forgot-password' && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerText}>ou</span>
            </div>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <span className={styles.googleSpinner} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
              )}
              <span>{googleLoading ? 'Redirecionando...' : 'Continuar com Google'}</span>
            </button>
          </>
        )}

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
