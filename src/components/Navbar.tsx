'use client';

import { useRef } from 'react';
import { useApp } from '@/context/AppContext';
import styles from './Navbar.module.css';
import { TrendingUp, ChevronDown, BarChart3, Download, Upload } from 'lucide-react';
import { useState } from 'react';

export default function Navbar({ activeTab, onTabChange }: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { strategies, assets, activeStrategyId, setActiveStrategy, importData } = useApp();
  const [showStrategies, setShowStrategies] = useState(false);
  const activeStrategy = strategies.find((s) => s.id === activeStrategyId);
  const importRef = useRef<HTMLInputElement>(null);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assets', label: 'Ativos' },
    { id: 'strategy', label: 'Estratégia' },
  ];

  const handleExport = () => {
    const data = { strategies, assets, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investmap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.strategies || !data.assets) {
          alert('Arquivo inválido. Certifique-se de usar um backup exportado pelo InvestMap.');
          return;
        }
        if (confirm(`Importar ${data.strategies.length} carteira(s) e ${data.assets.length} ativo(s)? Os dados existentes serão mantidos.`)) {
          importData(data.strategies, data.assets);
          alert('Dados importados com sucesso!');
        }
      } catch {
        alert('Erro ao ler o arquivo. Verifique se é um JSON válido.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be imported again if needed
    e.target.value = '';
  };

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

        <div className={styles.right}>
          {/* Export / Import */}
          <div className={styles.dataActions}>
            <button
              id="export-data-btn"
              className={styles.iconBtn}
              onClick={handleExport}
              title="Exportar dados (backup JSON)"
            >
              <Download size={15} />
              <span className={styles.iconBtnLabel}>Exportar</span>
            </button>
            <button
              id="import-data-btn"
              className={styles.iconBtn}
              onClick={() => importRef.current?.click()}
              title="Importar dados (backup JSON)"
            >
              <Upload size={15} />
              <span className={styles.iconBtnLabel}>Importar</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
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
      </div>
    </nav>
  );
}
