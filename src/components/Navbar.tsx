'use client';

import { useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css';
import { TrendingUp, Download, Upload, LogOut, Sun, Moon, BarChart3, ChevronDown, User, LayoutDashboard, Briefcase, Target, Settings, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navbar({ activeTab, onTabChange }: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { strategies, assets, activeStrategyId, setActiveStrategy, importData } = useApp();
  const { signOut } = useAuth();
  const [showStrategies, setShowStrategies] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [theme, setTheme] = useState('dark');
  const activeStrategy = strategies.find((s) => s.id === activeStrategyId);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('investmap_theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('investmap_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

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
    e.target.value = '';
  };

  return (
    <>
      <nav className={styles.nav}>
        <div className={`container ${styles.inner}`}>
          {/* Logo Section */}
          <div className={styles.logoGroup}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <TrendingUp size={18} />
              </div>
              <span className={styles.logoText}>InvestMap</span>
            </div>
          </div>

          {/* Center Section: Tabs (Desktop) + Strategy Switcher */}
          <div className={styles.centerGroup}>
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

            <div className={styles.strategySwitcher}>
              {strategies.length > 1 ? (
                <>
                  <button
                    id="strategy-switcher-btn"
                    className={styles.strategyBtn}
                    onClick={() => setShowStrategies(!showStrategies)}
                  >
                    <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                    <div className={styles.strategyBtnContent}>
                      <span className={styles.strategyLabel}>Carteira</span>
                      <span className={styles.strategyName}>{activeStrategy?.name ?? 'Selecionar'}</span>
                    </div>
                    <ChevronDown size={14} className={showStrategies ? styles.chevronUp : ''} style={{ marginLeft: 4 }} />
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
                </>
              ) : (
                <div className={styles.strategyBtn} style={{ cursor: 'default' }}>
                  <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                  <div className={styles.strategyBtnContent}>
                    <span className={styles.strategyLabel}>Carteira</span>
                    <span className={styles.strategyName}>{activeStrategy?.name ?? 'Minha Carteira'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Actions + Mobile Menu Toggle */}
          <div className={styles.rightGroup}>
            <div className={styles.dataActions}>
              <button className={styles.iconBtn} onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                <span className={styles.iconBtnLabel}>Tema</span>
              </button>
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
              <button className={`${styles.iconBtn} ${activeTab === 'profile' ? styles.iconBtnActive : ''}`} onClick={() => onTabChange?.('profile')}>
                <User size={15} />
                <span className={styles.iconBtnLabel}>Perfil</span>
              </button>
              <button className={styles.iconBtn} onClick={async () => { if(confirm('Sair da conta?')) await signOut(); }}>
                <LogOut size={15} />
                <span className={styles.iconBtnLabel}>Sair</span>
              </button>
            </div>

            <button className={styles.mobileActionBtn} onClick={() => setShowMobileMenu(!showMobileMenu)}>
              {showMobileMenu ? <X size={20} /> : <Settings size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className={styles.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)}>
            <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
              <div className={styles.mobileMenuHeader}>Preferências</div>
              <button className={styles.strategyItem} onClick={() => { toggleTheme(); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { handleExport(); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  <Download size={18} />
                  <span>Exportar Backup (JSON)</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { importRef.current?.click(); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  <Upload size={18} />
                  <span>Importar Backup (JSON)</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { onTabChange?.('profile'); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  <User size={18} />
                  <span>Meu Perfil</span>
                </div>
              </button>
              <div className={styles.menuDivider} />
              <button className={styles.strategyItem} style={{ color: '#ff4444' }} onClick={async () => {
                if(confirm('Tem certeza que deseja sair?')) { await signOut(); setShowMobileMenu(false); }
              }}>
                <div className={styles.menuItemInner}>
                  <LogOut size={18} />
                  <span>Sair da Conta</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className={styles.mobileTabNav}>
        <button className={`${styles.mobileTabItem} ${activeTab === 'dashboard' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('dashboard')}>
          <LayoutDashboard className={styles.tabIcon} />
          <span>Dashboard</span>
        </button>
        <button className={`${styles.mobileTabItem} ${activeTab === 'assets' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('assets')}>
          <Briefcase className={styles.tabIcon} />
          <span>Ativos</span>
        </button>
        <button className={`${styles.mobileTabItem} ${activeTab === 'strategy' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('strategy')}>
          <Target className={styles.tabIcon} />
          <span>Estratégia</span>
        </button>
      </div>
    </>
  );
}
