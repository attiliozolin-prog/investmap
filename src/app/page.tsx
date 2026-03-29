'use client';

import { useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Navbar from '@/components/Navbar';
import Dashboard from '@/views/Dashboard';
import Assets from '@/views/Assets';
import Strategy from '@/views/Strategy';
import LandingPage from '@/components/LandingPage/LandingPage';
import OnboardingFlow from '@/components/Onboarding/OnboardingFlow';
import AuthPage from '@/components/Auth/AuthPage';
import styles from './page.module.css';

type Tab = 'dashboard' | 'assets' | 'strategy';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLanding, setShowLanding] = useState<boolean>(!hasCompletedOnboarding);

  // Aguarda verificação de sessão
  if (authLoading) {
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

  if (!hasCompletedOnboarding && showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  if (!hasCompletedOnboarding && !showLanding) {
    return <OnboardingFlow />;
  }

  return (
    <div className={styles.app}>
      <Navbar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)} />
      <main className={styles.main}>
        <div className={`container ${styles.content}`}>
          {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab as Tab)} />}
          {activeTab === 'assets'    && <Assets />}
          {activeTab === 'strategy'  && <Strategy />}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

