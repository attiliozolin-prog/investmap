'use client';

import { useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Navbar from '@/components/Navbar';
import Dashboard from '@/views/Dashboard';
import Assets from '@/views/Assets';
import Strategy from '@/views/Strategy';
import LandingPage from '@/components/LandingPage/LandingPage';
import OnboardingFlow from '@/components/Onboarding/OnboardingFlow';
import styles from './page.module.css';

type Tab = 'dashboard' | 'assets' | 'strategy';

function AppContent() {
  const { hasCompletedOnboarding } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showLanding, setShowLanding] = useState<boolean>(!hasCompletedOnboarding);

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
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

