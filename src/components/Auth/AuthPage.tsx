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

  const handleGoogle = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(translateError(error));
      setLoading(false);
    }
    // Em caso de sucesso, o navegador redireciona para o Google (sem retorno aqui)
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

        {mode !== 'forgot-password' && (
          <>
            <div className={styles.divider}><span>ou</span></div>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              Continuar com Google
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

        <p className={styles.disclaimer}>
          O InvestMap é uma ferramenta de organização financeira e educação.{' '}
          <strong>Não constitui recomendação de investimento</strong> nem consultoria financeira ou tributária.
        </p>
        <div className={styles.legalLinks}>
          <a href="/privacidade">Privacidade</a>
          <span aria-hidden>·</span>
          <a href="/termos">Termos de uso</a>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}
