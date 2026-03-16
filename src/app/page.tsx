'use client';

import { useState } from 'react';
import { AppProvider } from '@/context/AppContext';
import Navbar from '@/components/Navbar';
import Dashboard from '@/views/Dashboard';
import Assets from '@/views/Assets';
import Strategy from '@/views/Strategy';
import styles from './page.module.css';

type Tab = 'dashboard' | 'assets' | 'strategy';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
