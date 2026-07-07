'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import styles from './Profile.module.css';
import B3ImportSection from '@/components/profile/B3ImportSection';
import { useToast } from '@/components/Toast';

export default function Profile() {
  const { user, updateUser, deleteAccountData } = useAuth();
  const { strategies, assets, importData, dbSynced } = useApp();
  const { toast } = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [newPassword, setNewPassword] = useState('');
  
  const [nameLoading, setNameLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [pendingImportData, setPendingImportData] = useState<{strategies: unknown[]; assets: unknown[]} | null>(null);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETAR') return;
    setDeleteLoading(true);
    const { error } = await deleteAccountData();
    if (error) {
      alert(error);
      setDeleteLoading(false);
    }
    // Se sucesso, o context faz o signOut e o app limpa automaticamente
  };

  const handleExport = () => {
    const data = { strategies, assets, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investmap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exportado com sucesso');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.strategies || !data.assets) {
          toast('Arquivo inválido. Certifique-se de usar um backup exportado pelo InvestMap.', 'error');
          return;
        }
        setPendingImportData({ strategies: data.strategies, assets: data.assets });
      } catch {
        toast('Erro ao ler o arquivo. Verifique se é um JSON válido.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMessage(null);
    try {
      const { error } = await updateUser({ data: { full_name: name } });
      if (error) throw new Error(error);
      setNameMessage({ type: 'success', text: 'Nome atualizado com sucesso!' });
    } catch (err: unknown) {
      setNameMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar nome' });
    } finally {
      setNameLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdMessage(null);
    try {
      if (newPassword.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres');
      const { error } = await updateUser({ password: newPassword });
      if (error) throw new Error(error);
      setPwdMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setNewPassword('');
    } catch (err: unknown) {
      setPwdMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar senha' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className={styles.profileContainer}>
      <header className={styles.header}>
        <h2 className={styles.title}>Meu Perfil</h2>
        <p className={styles.subtitle}>Gerencie suas informações pessoais e configurações da conta</p>
      </header>

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Informações da Conta</h3>
          <div className={styles.fieldGroup}>
            <label>E-mail (Login)</label>
            <input 
              type="text" 
              className={styles.input} 
              value={user?.email || ''} 
              disabled 
              readOnly 
            />
            <span className={styles.helpText}>Para alterar seu e-mail, entre em contato com o suporte.</span>
          </div>

          <form onSubmit={handleUpdateName}>
            <div className={styles.fieldGroup}>
              <label>Nome Completo</label>
              <input 
                type="text" 
                className={styles.input} 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Como deseja ser chamado?"
                required
              />
            </div>
            
            {nameMessage && (
              <div className={`${styles.message} ${styles[nameMessage.type]}`}>{nameMessage.text}</div>
            )}
            
            <button 
              type="submit" 
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={nameLoading}
            >
              {nameLoading ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Portabilidade de Dados</h3>
          <p className={styles.helpText} style={{ marginBottom: '1.5rem', display: 'block' }}>
            Baixe seus dados para backup ou importe de um arquivo anterior.
            {dbSynced && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: '#10B981', fontSize: '0.75rem', fontWeight: 500 }}>● Dados sincronizados</span>}
          </p>
          <div className={styles.buttonGroup}>
            <button className={styles.secondaryBtn} onClick={handleExport}>
              <Download size={18} />
              <span>Exportar Backup (JSON)</span>
            </button>
            <button className={styles.secondaryBtn} onClick={() => importRef.current?.click()}>
              <Upload size={18} />
              <span>Importar JSON</span>
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          </div>

          <B3ImportSection />
        </div>
      </div>

      {/* Ferramenta de desenvolvimento — nunca aparece em produção */}
      {process.env.NODE_ENV === 'development' && (
        <div className={styles.card}>
          <div className={styles.formSection}>
            <h3>Modo Desenvolvedor</h3>
            <p className={styles.helpText} style={{ marginBottom: '1.5rem', display: 'block' }}>
              Simule interfaces do aplicativo. Seus dados e configurações ativas não serão alterados ao usar esta opção.
            </p>
            <div className={styles.buttonGroup}>
              <button 
                className={styles.secondaryBtn} 
                onClick={() => {
                  localStorage.setItem('investmap_test_onboarding', '1');
                  window.location.href = '/';
                }}
              >
                <AlertTriangle size={18} />
                <span>Testar Tela de Onboarding</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.formSection}>
          <h3>Segurança</h3>
          <form onSubmit={handleUpdatePassword}>
            <div className={styles.fieldGroup}>
              <label>Nova Senha</label>
              <input 
                type="password" 
                className={styles.input} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                required
                minLength={6}
              />
            </div>

            {pwdMessage && (
              <div className={`${styles.message} ${styles[pwdMessage.type]}`}>{pwdMessage.text}</div>
            )}

            <button 
              type="submit" 
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={pwdLoading}
            >
              {pwdLoading ? 'Atualizando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerCard}>
          <h3>Zona de Perigo</h3>
          <p className={styles.helpText}>
            A exclusão removerá permanentemente seus ativos, estratégias, finanças, impostos e o seu login (e-mail e senha). Esta ação não pode ser desfeita. Se quiser guardar uma cópia, exporte o backup em JSON antes.
          </p>
          <button
            className={styles.deleteBtn}
            onClick={() => setShowDeleteModal(true)}
          >
            Excluir Minha Conta
          </button>
        </div>
      </div>

      <footer className={styles.legalFooter}>
        <a href="/privacidade">Política de Privacidade</a>
        <span aria-hidden>·</span>
        <a href="/termos">Termos de Uso</a>
      </footer>

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <AlertTriangle color="#EF4444" size={32} />
              <h2 style={{ margin: 0 }}>Você tem certeza?</h2>
            </div>
            <p>
              Ao confirmar, <strong>todos os seus dados do InvestMap serão apagados</strong>. 
              Você perderá acesso às suas carteiras e histórico de ativos imediatamente.
            </p>
            
            <div className={styles.fieldGroup} style={{ marginTop: '1.5rem' }}>
              <label>Digite <strong>DELETAR</strong> para confirmar:</label>
              <input 
                type="text" 
                className={styles.input}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETAR"
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancelar
              </button>
              <button 
                className={styles.deleteBtn}
                disabled={deleteConfirmText !== 'DELETAR' || deleteLoading}
                onClick={handleDeleteAccount}
                style={{ marginTop: 0, flex: 1 }}
              >
                {deleteLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingImportData && (
        <div className={styles.modalOverlay} onClick={() => setPendingImportData(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', padding: '1.25rem 1.5rem 0' }}>Confirmar Importação</h3>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Você está prestes a importar:
              </p>
              <ul style={{ margin: '0 0 1rem 1.2rem', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 2 }}>
                <li><strong>{pendingImportData.strategies.length}</strong> carteira(s)</li>
                <li><strong>{pendingImportData.assets.length}</strong> ativo(s)</li>
              </ul>
              <p style={{ margin: 0, color: 'var(--color-text-3)', fontSize: '0.8rem' }}>
                Os dados existentes serão mantidos — não há sobreposição.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setPendingImportData(null)}>
                Cancelar
              </button>
              <button
                className={styles.secondaryBtn}
                style={{ flex: 1 }}
                onClick={() => {
                  importData(pendingImportData.strategies as Parameters<typeof importData>[0], pendingImportData.assets as Parameters<typeof importData>[1]);
                  toast(`${pendingImportData.strategies.length} carteira(s) e ${pendingImportData.assets.length} ativo(s) importados com sucesso`);
                  setPendingImportData(null);
                }}
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
