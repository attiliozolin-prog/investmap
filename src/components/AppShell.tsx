'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import Navbar from '@/components/Navbar';
import SyncErrorBanner from '@/components/SyncErrorBanner';
import LandingPage from '@/components/LandingPage/LandingPage';
import OnboardingFlow from '@/components/Onboarding/OnboardingFlow';
import AuthPage from '@/components/Auth/AuthPage';
import { routeForTab, tabForPathname } from '@/lib/routes';
import styles from '@/app/page.module.css';

/**
 * Shell da aplicação: providers, gates de autenticação/onboarding e Navbar.
 * Vive no layout raiz para que o estado dos contexts sobreviva à navegação
 * entre rotas — só o conteúdo da página troca.
 */

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding, dbSynced } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const [showLanding, setShowLanding] = useState<boolean>(!hasCompletedOnboarding);
  const [isTestOnboarding, setIsTestOnboarding] = useState(false);

  useEffect(() => {
    setIsTestOnboarding(localStorage.getItem('investmap_test_onboarding') === '1');
  }, []);

  // Aguarda verificação de sessão e DB
  if (authLoading || (user && !dbSynced)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B0B14' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #252538', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  // Usuário não autenticado — exibe tela de login/cadastro
  if (!user) {
    return <AuthPage />;
  }

  if (!hasCompletedOnboarding && showLanding && !isTestOnboarding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  if ((!hasCompletedOnboarding && !showLanding) || isTestOnboarding) {
    return (
      <OnboardingFlow
        onFinish={(action) => {
          if (isTestOnboarding) {
            window.location.href = '/';
            return;
          }
          if (action === 'add-asset') {
            router.push(routeForTab('assets'));
            // Aguarda o render da tela de ativos para clicar no botão
            setTimeout(() => {
              document.getElementById('add-asset-btn')?.click();
            }, 100);
          }
        }}
      />
    );
  }

  return (
    <div className={styles.app}>
      <Navbar
        activeTab={tabForPathname(pathname)}
        onTabChange={(tab) => router.push(routeForTab(tab))}
      />
      <main className={styles.main}>
        <div className={`container ${styles.content}`}>
          {children}
        </div>
      </main>
      <SyncErrorBanner />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <FinanceProvider>
            <ToastProvider>
              <Gate>{children}</Gate>
            </ToastProvider>
          </FinanceProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
