'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[InvestMap Error Boundary]', error, info.componentStack);
  }

  handleReset = () => {
    // Limpa o localStorage e recarrega — resolve dados corrompidos
    try {
      localStorage.removeItem('investmap_strategies');
      localStorage.removeItem('investmap_assets');
      localStorage.removeItem('investmap_active');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0B14',
          color: '#F0F0FF',
          fontFamily: 'Inter, sans-serif',
          padding: '24px',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#F0F0FF' }}>
            Algo deu errado
          </h2>
          <p style={{ margin: 0, color: '#9CA3AF', maxWidth: 400, lineHeight: 1.6 }}>
            O app encontrou um erro inesperado. Se o problema persistir, clique em
            &quot;Reiniciar&quot; para limpar os dados e começar novamente.
          </p>
          {this.state.error && (
            <code style={{
              background: '#1A1A2E',
              color: '#EF4444',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              maxWidth: 480,
              wordBreak: 'break-all',
            }}>
              {this.state.error.message}
            </code>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: 'transparent',
                border: '1px solid #3D3D5C',
                color: '#9CA3AF',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
              }}
            >
              Tentar novamente
            </button>
            <button
              onClick={this.handleReset}
              style={{
                background: '#7C3AED',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: 600,
              }}
            >
              🔄 Reiniciar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
