'use client';

import { useApp } from '@/context/AppContext';
import styles from './Navbar.module.css';
import { TrendingUp, ChevronDown, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export default function Navbar({ activeTab, onTabChange }: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { strategies, activeStrategyId, setActiveStrategy } = useApp();
  const [showStrategies, setShowStrategies] = useState(false);
  const activeStrategy = strategies.find((s) => s.id === activeStrategyId);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assets', label: 'Ativos' },
    { id: 'strategy', label: 'Estratégia' },
  ];

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <TrendingUp size={18} />
          </div>
          <span className={styles.logoText}>InvestMap</span>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Strategy Switcher */}
        <div className={styles.strategySwitcher}>
          <button
            id="strategy-switcher-btn"
            className={styles.strategyBtn}
            onClick={() => setShowStrategies(!showStrategies)}
          >
            <BarChart3 size={14} />
            <span>{activeStrategy?.name ?? 'Selecionar carteira'}</span>
            <ChevronDown size={14} className={showStrategies ? styles.chevronUp : ''} />
          </button>

          {showStrategies && (
            <div className={styles.strategyDropdown}>
              {strategies.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.strategyItem} ${s.id === activeStrategyId ? styles.strategyItemActive : ''}`}
                  onClick={() => {
                    setActiveStrategy(s.id);
                    setShowStrategies(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
