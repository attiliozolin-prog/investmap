'use client';

import { useRef, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css';
import {
  Compass, Download, Upload, LogOut, Sun, Moon,
  ChevronDown, User, LayoutDashboard,
  Briefcase, Target, Wallet, Settings, X,
} from 'lucide-react';

// ── Tab definitions (ícones reaproveitados do mobile) ─────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'assets',    label: 'Ativos',    Icon: Briefcase },
  { id: 'finances',  label: 'Finanças',  Icon: Wallet },
];

export default function Navbar({ activeTab, onTabChange }: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { strategies, assets, importData } = useApp();
  const { signOut } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu]   = useState(false);
  const [theme, setTheme]                     = useState('dark');

  const importRef       = useRef<HTMLInputElement>(null);
  const profileMenuRef  = useRef<HTMLDivElement>(null);
  const navRef          = useRef<HTMLElement>(null);

  // Mede a altura real da navbar e atualiza a variável CSS para os sticky abaixo
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--navbar-height', `${el.offsetHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Inicializa tema ────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('investmap_theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  // ── Fecha dropdowns ao clicar fora ────────────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const handleExport = () => {
    const data = { strategies, assets, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
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

  const handleSignOut = async () => {
    setShowProfileMenu(false);
    if (confirm('Tem certeza que deseja sair?')) await signOut();
  };

  return (
    <>
      <nav ref={navRef} className={styles.nav}>
        <div className={`container ${styles.inner}`}>

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <div className={styles.logoGroup}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <Compass size={18} />
              </div>
              <span className={styles.logoText}>InvestMap</span>
            </div>
          </div>

          {/* ── Abas de navegação (desktop) ───────────────────────────────── */}
          <div className={styles.centerGroup}>
            <div className={styles.tabs}>
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`nav-${id}`}
                  className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
                  onClick={() => onTabChange(id)}
                >
                  <Icon size={14} className={styles.tabIcon} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Direita: Perfil ───────────────────────────────────────────── */}
          <div className={styles.rightGroup}>

            {/* Dropdown de Perfil */}
            <div className={styles.profileWrapper} ref={profileMenuRef}>
              <button
                id="nav-profile-btn"
                className={`${styles.profileBtn} ${(activeTab === 'profile' || showProfileMenu) ? styles.profileBtnActive : ''}`}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="Perfil e configurações"
              >
                <Settings size={15} />
                <span className={styles.profileBtnLabel}>Configurações</span>
                <ChevronDown size={12} className={`${styles.profileChevron} ${showProfileMenu ? styles.chevronUp : ''}`} />
              </button>

              {showProfileMenu && (
                <div className={styles.profileDropdown}>
                  <button
                    className={styles.profileItem}
                    onClick={() => { onTabChange('profile'); setShowProfileMenu(false); }}
                  >
                    <User size={15} />
                    <span>Meu Perfil</span>
                  </button>

                  <div className={styles.profileDivider} />

                  <button className={styles.profileItem} onClick={() => { toggleTheme(); setShowProfileMenu(false); }}>
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                  </button>

                  <div className={styles.profileDivider} />

                  <button className={`${styles.profileItem} ${styles.profileItemDanger}`} onClick={handleSignOut}>
                    <LogOut size={15} />
                    <span>Sair da Conta</span>
                  </button>

                  <div className={styles.profileLegalFooter}>
                    <a href="/privacidade">Privacidade</a>
                    <span aria-hidden>·</span>
                    <a href="/termos">Termos de Uso</a>
                  </div>
                </div>
              )}
            </div>

            {/* Input oculto de importação */}
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

            {/* Botão de menu mobile */}
            <button
              className={styles.mobileActionBtn}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label={showMobileMenu ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={showMobileMenu}
            >
              {showMobileMenu ? <X size={20} /> : <Settings size={20} />}
            </button>
          </div>
        </div>

        {/* ── Mobile Menu Dropdown ─────────────────────────────────────────── */}
        {showMobileMenu && (
          <div className={styles.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)}>
            <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
              <div className={styles.mobileMenuHeader}>Preferências</div>
              <button className={styles.strategyItem} onClick={() => { onTabChange('strategy'); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  <Target size={18} />
                  <span>Estratégia da Carteira</span>
                </div>
              </button>
              <div className={styles.menuDivider} />
              <button className={styles.strategyItem} onClick={() => { toggleTheme(); setShowMobileMenu(false); }}>
                <div className={styles.menuItemInner}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
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
                if (confirm('Tem certeza que deseja sair?')) { await signOut(); setShowMobileMenu(false); }
              }}>
                <div className={styles.menuItemInner}>
                  <LogOut size={18} />
                  <span>Sair da Conta</span>
                </div>
              </button>

              <div className={styles.mobileLegalFooter}>
                <a href="/privacidade">Privacidade</a>
                <span aria-hidden>·</span>
                <a href="/termos">Termos de Uso</a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Bottom Nav Mobile ───────────────────────────────────────────────── */}
      <div className={styles.mobileTabNav}>
        <button className={`${styles.mobileTabItem} ${activeTab === 'dashboard' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('dashboard')}>
          <LayoutDashboard className={styles.mobileTabIcon} />
          <span>Dashboard</span>
        </button>
        <button className={`${styles.mobileTabItem} ${activeTab === 'assets' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('assets')}>
          <Briefcase className={styles.mobileTabIcon} />
          <span>Ativos</span>
        </button>
        <button className={`${styles.mobileTabItem} ${activeTab === 'finances' ? styles.mobileTabItemActive : ''}`} onClick={() => onTabChange('finances')}>
          <Wallet className={styles.mobileTabIcon} />
          <span>Finanças</span>
        </button>
      </div>
    </>
  );
}
