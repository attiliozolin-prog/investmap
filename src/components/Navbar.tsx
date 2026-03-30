'use client';

import { useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css';
import { TrendingUp, Download, Upload, LogOut, Sun, Moon, BarChart3, ChevronDown, User, LayoutDashboard, Briefcase, Target, Settings, X, Globe } from 'lucide-react';
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
    // Reset so the same file can be imported again if needed
    e.target.value = '';
  };

  return (
    <>
      <nav className={styles.nav}>
        <div className={`container ${styles.inner}`}>
          {/* Logo */}
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <TrendingUp size={18} />
            </div>
            <span className={styles.logoText}>InvestMap</span>
          </div>

          {/* Desktop Tabs */}
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
            {/* Desktop Actions */}
            <div className={styles.dataActions}>
              <button
                className={styles.iconBtn}
                onClick={toggleTheme}
                title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                <span className={styles.iconBtnLabel}>Tema</span>
              </button>
              <div className={styles.divider} style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />
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
              <div className={styles.divider} style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />
              <button
                className={`${styles.iconBtn} ${activeTab === 'profile' ? styles.iconBtnActive : ''}`}
                onClick={() => onTabChange?.('profile')}
                title="Meu Perfil"
              >
                <User size={15} />
                <span className={styles.iconBtnLabel}>Perfil</span>
              </button>
              <button
                className={styles.iconBtn}
                onClick={async () => {
                  if(confirm('Tem certeza que deseja sair?')) {
                    await signOut();
                  }
                }}
                title="Sair da conta"
              >
                <LogOut size={15} />
                <span className={styles.iconBtnLabel}>Sair</span>
              </button>
            </div>

            {/* Mobile Actions: Profile Menu Trigger */}
            <button 
              className={styles.mobileActionBtn}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{ display: 'none' }}
            >
              {showMobileMenu ? <X size={20} /> : <Settings size={20} />}
            </button>

            {/* Strategy Info / Switcher */}
            <div className={styles.strategySwitcher}>
              {strategies.length > 1 ? (
                <>
                  <button
                    id="strategy-switcher-btn"
                    className={styles.strategyBtn}
                    onClick={() => setShowStrategies(!showStrategies)}
                  >
                    <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Carteira Ativa</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeStrategy?.name ?? 'Selecionar carteira'}</span>
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
                <div 
                  className={styles.strategyBtn} 
                  style={{ cursor: 'default', background: 'var(--color-surface)' }}
                  title="Sua carteira de investimentos ativa"
                >
                  <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Carteira Ativa</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeStrategy?.name ?? 'Minha Carteira'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Profile Menu Overlay/Dropdown */}
        {showMobileMenu && (
          <div className={styles.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)}>
            <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dimmed)', textTransform: 'uppercase' }}>Preferências</span>
              </div>
              <button className={styles.strategyItem} onClick={() => { toggleTheme(); setShowMobileMenu(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { handleExport(); setShowMobileMenu(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Download size={18} />
                  <span>Exportar Backup (JSON)</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { importRef.current?.click(); setShowMobileMenu(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Upload size={18} />
                  <span>Importar Backup (JSON)</span>
                </div>
              </button>
              <button className={styles.strategyItem} onClick={() => { onTabChange?.('profile'); setShowMobileMenu(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <User size={18} />
                  <span>Meu Perfil</span>
                </div>
              </button>
              <div style={{ margin: '8px 0', borderTop: '1px solid var(--color-border)' }} />
              <button className={styles.strategyItem} style={{ color: '#ff4444' }} onClick={async () => {
                if(confirm('Tem certeza que deseja sair?')) {
                  await signOut();
                  setShowMobileMenu(false);
                }
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <LogOut size={18} />
                  <span>Sair da Conta</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Tab Bar (Mobile) */}
      <div className={styles.mobileTabNav}>
        <button 
          className={`${styles.mobileTabItem} ${activeTab === 'dashboard' ? styles.mobileTabItemActive : ''}`}
          onClick={() => onTabChange('dashboard')}
        >
          <LayoutDashboard className={styles.tabIcon} />
          <span>Dashboard</span>
        </button>
        <button 
          className={`${styles.mobileTabItem} ${activeTab === 'assets' ? styles.mobileTabItemActive : ''}`}
          onClick={() => onTabChange('assets')}
        >
          <Briefcase className={styles.tabIcon} />
          <span>Ativos</span>
        </button>
        <button 
          className={`${styles.mobileTabItem} ${activeTab === 'strategy' ? styles.mobileTabItemActive : ''}`}
          onClick={() => onTabChange('strategy')}
        >
          <Target className={styles.tabIcon} />
          <span>Estratégia</span>
        </button>
      </div>
    </>
  );
}
